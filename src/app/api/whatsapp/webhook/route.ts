import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { sendWhatsAppMessage, normalizeWhatsAppSender } from '@/lib/whatsapp';
import { logWhatsAppMessage, isConversationSilenced } from '@/lib/whatsapp-conversations';
import { getWhatsAppAiReply } from '@/lib/whatsapp-ai';
import { sendEscalationSms } from '@/lib/sms-alert';

/**
 * Inbound WhatsApp webhook. Handles both onboarding paths, kept side by
 * side until the onboarding decision is made (see the plan):
 *
 * - `meta_direct`: raw Meta Cloud API, entry[].changes[].value.messages[],
 *   verified via the real X-Hub-Signature-256 HMAC against WHATSAPP_APP_SECRET.
 * - `360dialog`: same shape (360dialog proxies Meta's), plus Coexistence-only
 *   change fields (`smb_message_echoes`, `history`, `smb_app_state_sync`) —
 *   only possible on this path, since Coexistence is 360dialog-only.
 *   360dialog's own webhook-signing scheme isn't confirmed (see
 *   CREDENTIALS-NEEDED.md); falls back to an optional shared-secret header.
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
  value?: { messages?: InboundMessage[] };
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
 * 360dialog's exact webhook-signing scheme was never confirmed (see
 * CREDENTIALS-NEEDED.md) — this checks an optional shared-secret header if
 * one is configured, and otherwise accepts unverified with a loud warning
 * rather than silently pretending it's secure.
 */
function verify360dialogWebhook(request: NextRequest): boolean {
  const configuredSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!configuredSecret) {
    console.warn('[whatsapp] WHATSAPP_WEBHOOK_SECRET not configured — accepting 360dialog webhook unverified');
    return true;
  }
  return request.headers.get('x-webhook-secret') === configuredSecret;
}

async function verifyWebhook(request: NextRequest, rawBody: string): Promise<boolean> {
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

  if (await isConversationSilenced(phone)) return;

  const ai = await getWhatsAppAiReply(phone, body);
  await sendWhatsAppMessage(phone, ai.reply);
  await logWhatsAppMessage({
    phone,
    source: 'bot_outbound',
    body: ai.reply,
    escalatedAt: ai.escalate ? new Date().toISOString() : null,
  });

  if (ai.escalate) {
    // TODO(pwa-inbox): also push to Daniel here once the inbox exists —
    // push becomes primary (opens straight into the conversation), SMS
    // stays wired as the reliable fallback if push fails or isn't set up.
    await sendEscalationSms({
      customerPhone: phone,
      reason: ai.escalateReason ?? 'לא צוינה סיבה',
      lastMessage: body,
    });
  }
}

async function handleChange(change: WebhookChange, botEnabled: boolean) {
  const messages = change.value?.messages ?? [];
  if (change.field === 'smb_message_echoes') {
    for (const msg of messages) await handleEcho(msg);
    return;
  }
  if (change.field === 'history' || change.field === 'smb_app_state_sync') {
    return; // Coexistence sync events — nothing to do beyond acking
  }
  if (change.field && change.field !== 'messages') return; // status updates, template events, etc.
  for (const msg of messages) await handleCustomerMessage(msg, botEnabled);
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

  for (const change of extractChanges(payload)) {
    await handleChange(change, botEnabled);
  }

  return NextResponse.json({ ok: true });
}
