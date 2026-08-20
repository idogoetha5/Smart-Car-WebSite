import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { sendWhatsAppMessage, normalizeWhatsAppSender } from '@/lib/whatsapp';
import { logWhatsAppMessage, isConversationSilenced } from '@/lib/whatsapp-conversations';
import { classifyWhatsAppInitialRoute, getWhatsAppFlowReply } from '@/lib/whatsapp-flow';
import { sendEscalationSms } from '@/lib/sms-alert';

/**
 * Inbound WhatsApp webhook. Handles the preferred YCloud Coexistence path
 * plus the previously tested provider fallbacks:
 *
 * - `ycloud`: YCloud v2 event envelopes, including
 *   `whatsapp.smb.message.echoes` when the owner replies from the phone app.
 *   Verified with YCloud's timestamped HMAC-SHA256 signature.
 * - `meta_direct`: raw Meta Cloud API, entry[].changes[].value.messages[],
 *   verified via the real X-Hub-Signature-256 HMAC against WHATSAPP_APP_SECRET.
 * - `360dialog`: same shape (360dialog proxies Meta's), plus Coexistence-only
 *   change fields (`smb_message_echoes`, `history`, `smb_app_state_sync`) —
 *   retained as a fallback Coexistence provider.
 *   360dialog is configured to forward a private custom header that this
 *   endpoint verifies before accepting any payload.
 *
 * `smb_message_echoes` (a reply sent from Daniel's phone app, only relevant
 * under Coexistence) and a reply sent from the not-yet-built agent inbox
 * both resolve to the same `source: 'human_reply'` row — the silence rule
 * doesn't care which path produced it.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

interface InboundMessage {
  from?: string;
  to?: string;
  id?: string;
  text?: { body?: string };
  type?: string;
}

interface WebhookChange {
  field?: string;
  value?: {
    messages?: InboundMessage[];
    message_echoes?: InboundMessage[];
  };
}

interface YCloudPayload {
  id?: string;
  type?: string;
  whatsappInboundMessage?: InboundMessage & { wamid?: string };
  whatsappMessage?: InboundMessage & { wamid?: string };
}

function extractChanges(payload: unknown): WebhookChange[] {
  const entries = (payload as { entry?: { changes?: WebhookChange[] }[] })?.entry ?? [];
  return entries.flatMap((entry) => entry.changes ?? []);
}

function messageBody(msg: InboundMessage): string {
  return msg.text?.body?.trim() || '[הודעה לא טקסטואלית]';
}

function hexDecode(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  // `.buffer` is typed ArrayBufferLike (ArrayBuffer | SharedArrayBuffer) in
  // the DOM lib; `.slice()` narrows back to a plain ArrayBuffer.
  return bytes.buffer instanceof ArrayBuffer ? bytes.buffer.slice(0) : new Uint8Array(bytes).buffer;
}

/** Meta signs the raw request body with the app secret — `sha256=<hex>`. */
async function verifyMetaSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('[whatsapp][ALERT] WHATSAPP_APP_SECRET not configured — refusing webhook');
    return false;
  }
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const providedHex = signatureHeader.slice('sha256='.length);
  const sigBuffer = hexDecode(providedHex);
  return crypto.subtle.verify('HMAC', key, sigBuffer, new TextEncoder().encode(rawBody));
}

/**
 * 360dialog supports custom headers on webhook delivery. Fail closed unless
 * the private header is configured and matches exactly.
 */
function verify360dialogWebhook(request: NextRequest): boolean {
  const configuredSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!configuredSecret) {
    console.error('[whatsapp][ALERT] WHATSAPP_WEBHOOK_SECRET not configured — refusing 360dialog webhook');
    return false;
  }
  const received = request.headers.get('x-webhook-secret') ?? '';
  const expectedBytes = Buffer.from(configuredSecret);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function verifyYCloudWebhook(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET;
  const header = request.headers.get('ycloud-signature');
  if (!secret || !header) {
    console.error('[whatsapp][ALERT] YCloud webhook secret or signature missing — refusing webhook');
    return false;
  }

  const values = Object.fromEntries(header.split(',').map((part) => {
    const [key, ...rest] = part.trim().split('=');
    return [key, rest.join('=')];
  }));
  const timestamp = values.t;
  const received = values.s;
  if (!timestamp || !received || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(received)) return false;

  // Reject replayed deliveries outside a short tolerance. YCloud signs each
  // delivery and retries failed endpoints with a fresh request.
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (ageSeconds > 5 * 60) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

async function verifyWebhook(request: NextRequest, rawBody: string): Promise<boolean> {
  if (process.env.WHATSAPP_TRANSPORT === 'ycloud') return verifyYCloudWebhook(request, rawBody);
  if (process.env.WHATSAPP_TRANSPORT === '360dialog') return verify360dialogWebhook(request);
  return verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'));
}

/** Coexistence-only: a reply Daniel sent from the WhatsApp Business App. */
async function handleEcho(msg: InboundMessage) {
  const customerPhone = normalizeWhatsAppSender(msg.to ?? msg.from ?? '');
  if (!customerPhone) return;
  await logWhatsAppMessage({ phone: customerPhone, source: 'human_reply', body: messageBody(msg), waMessageId: msg.id });
}

async function handleCustomerMessage(msg: InboundMessage, botEnabled: boolean) {
  const phone = normalizeWhatsAppSender(msg.from ?? '');
  if (!phone) return;
  const body = messageBody(msg);

  const isNew = await logWhatsAppMessage({ phone, source: 'customer_inbound', body, waMessageId: msg.id });
  if (!isNew) return; // provider retry of an already-processed delivery

  // TODO(pwa-inbox): push a "new message" notification to Daniel here once
  // the agent inbox exists — see the plan's PWA-inbox section.

  if (!botEnabled) return; // kill switch — logged above, no auto-reply

  const { success: withinLimit } = await checkRateLimit(`whatsapp:${phone}`, 20, 10 * 60_000);
  if (!withinLimit) {
    console.warn(`[whatsapp] rate limit hit for ${phone}`);
    return;
  }

  // A recent human reply normally silences the bot, but a new accident or
  // roadside failure must always produce the fixed safety reply and a fresh
  // alert even inside that 24-hour handoff window.
  const route = classifyWhatsAppInitialRoute(body, false);
  const isEmergency = route === 'accident' || route === 'breakdown';
  if (!isEmergency && await isConversationSilenced(phone)) return;

  // Every inbound message stays in the deterministic service flow. The bot
  // never asks an AI model to select a route, assess an emergency, or make a
  // booking decision.
  const flow = await getWhatsAppFlowReply(phone, body);
  if (flow.handled && flow.reply) {
    const send = await sendWhatsAppMessage(phone, flow.reply);
    if (send.ok) {
      await logWhatsAppMessage({
        phone,
        source: 'bot_outbound',
        body: flow.reply,
        waMessageId: send.waMessageId,
        escalatedAt: flow.escalate ? new Date().toISOString() : null,
      });
    } else {
      console.error(`[whatsapp][ALERT] structured reply could not be delivered to ${phone}`);
    }
    if (flow.escalate) {
      await sendEscalationSms({
        customerPhone: phone,
        reason: send.ok ? (flow.escalateReason ?? 'לא צוינה סיבה') : `שליחת WhatsApp נכשלה: ${flow.escalateReason ?? 'לא צוינה סיבה'}`,
        lastMessage: body,
      });
    }
    return;
  }

  // getWhatsAppFlowReply always handles the normal path. This fallback is
  // intentionally deterministic in case a future flow branch is incomplete.
  const reply = 'לא הצלחנו להבין את הבקשה. כתבו "תפריט" כדי להתחיל מחדש, או "נציג" כדי לעבור לצוות SmartCar.';
  const send = await sendWhatsAppMessage(phone, reply);
  if (send.ok) await logWhatsAppMessage({ phone, source: 'bot_outbound', body: reply, waMessageId: send.waMessageId });
}

async function handleChange(change: WebhookChange, botEnabled: boolean) {
  if (change.field === 'smb_message_echoes') {
    for (const msg of change.value?.message_echoes ?? []) await handleEcho(msg);
    return;
  }
  if (change.field === 'history' || change.field === 'smb_app_state_sync') {
    return; // Coexistence sync events — nothing to do beyond acking
  }
  if (change.field && change.field !== 'messages') return; // status updates, template events, etc.
  const messages = change.value?.messages ?? [];
  for (const msg of messages) await handleCustomerMessage(msg, botEnabled);
}

async function handleYCloudEvent(payload: YCloudPayload, botEnabled: boolean) {
  if (payload.type === 'whatsapp.inbound_message.received' && payload.whatsappInboundMessage) {
    const msg = payload.whatsappInboundMessage;
    await handleCustomerMessage({ ...msg, id: msg.wamid ?? msg.id }, botEnabled);
    return;
  }
  if (payload.type === 'whatsapp.smb.message.echoes' && payload.whatsappMessage) {
    const msg = payload.whatsappMessage;
    await handleEcho({ ...msg, id: msg.wamid ?? msg.id });
  }
  // History, delivery status and account-sync events are acknowledged only.
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    if (token !== process.env.WHATSAPP_VERIFY_TOKEN) {
      return NextResponse.json({ error: 'invalid verify token' }, { status: 403 });
    }
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!(await verifyWebhook(request, rawBody))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody || 'null');
  if (!payload) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from('whatsapp_bot_settings').select('enabled').eq('id', true).maybeSingle();
  const botEnabled = settings?.enabled !== false;

  if (process.env.WHATSAPP_TRANSPORT === 'ycloud') {
    await handleYCloudEvent(payload as YCloudPayload, botEnabled);
    return NextResponse.json({ ok: true });
  }

  for (const change of extractChanges(payload)) {
    await handleChange(change, botEnabled);
  }

  return NextResponse.json({ ok: true });
}
