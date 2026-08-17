import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { sendWhatsAppMessage, normalizeWhatsAppSender } from '@/lib/whatsapp';
import { getWhatsAppAiReply } from '@/lib/whatsapp-ai';
import { sendEscalationSms } from '@/lib/sms-alert';

/**
 * Inbound WhatsApp webhook, routed through 360dialog (see the plan doc —
 * the business number stays live on Daniel's phone via WhatsApp
 * Coexistence, so this can't go through a plain Meta Graph API webhook).
 *
 * Payload shape assumed to mirror Meta's Cloud API webhook format (which
 * 360dialog proxies): entry[].changes[].value.messages[], with `field` on
 * each change distinguishing standard messages from the Coexistence-only
 * events (`smb_message_echoes`, `history`, `smb_app_state_sync`). This is
 * the best-effort shape from 360dialog's docs at plan time — verify against
 * real payloads once Phase 0 credentials exist and adjust field paths here
 * if they differ, especially the echo events' customer-phone field.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const SILENCE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

type MessageSource = 'customer_inbound' | 'bot_outbound' | 'human_echo';

async function logMessage(
  supabase: ReturnType<typeof createAdminClient>,
  params: { phone: string; source: MessageSource; body: string; waMessageId?: string | null; escalatedAt?: string | null }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .upsert(
      {
        phone: params.phone,
        source: params.source,
        body: params.body,
        wa_message_id: params.waMessageId ?? null,
        escalated_at: params.escalatedAt ?? null,
      },
      { onConflict: 'wa_message_id', ignoreDuplicates: true }
    )
    .select('id');

  if (error) {
    console.error('[whatsapp][ALERT] failed to log message:', error.message);
    return false;
  }
  // ignoreDuplicates: an empty result means the wa_message_id already existed —
  // this delivery is a provider retry of one we already processed.
  return (data?.length ?? 0) > 0;
}

/** Was this phone's conversation handed to a human in the last 24h? */
async function isSilenced(supabase: ReturnType<typeof createAdminClient>, phone: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - SILENCE_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('source, created_at, escalated_at')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(20);

  for (const row of (data ?? []) as { source: string; created_at: string; escalated_at: string | null }[]) {
    if (row.source === 'human_echo' && row.created_at > cutoff) return true;
    if (row.escalated_at && row.escalated_at > cutoff) return true;
  }
  return false;
}

async function handleEcho(supabase: ReturnType<typeof createAdminClient>, msg: InboundMessage) {
  const customerPhone = normalizeWhatsAppSender(msg.to ?? msg.from ?? '');
  if (!customerPhone) return;
  await logMessage(supabase, {
    phone: customerPhone,
    source: 'human_echo',
    body: messageBody(msg),
    waMessageId: msg.id,
  });
}

async function handleCustomerMessage(supabase: ReturnType<typeof createAdminClient>, msg: InboundMessage, botEnabled: boolean) {
  const phone = normalizeWhatsAppSender(msg.from ?? '');
  if (!phone) return;
  const body = messageBody(msg);

  const isNew = await logMessage(supabase, { phone, source: 'customer_inbound', body, waMessageId: msg.id });
  if (!isNew) return; // provider retry of an already-processed delivery

  if (!botEnabled) return; // kill switch — logged above, no auto-reply

  const { success: withinLimit } = await checkRateLimit(`whatsapp:${phone}`, 20, 10 * 60_000);
  if (!withinLimit) {
    console.warn(`[whatsapp] rate limit hit for ${phone}`);
    return;
  }

  if (await isSilenced(supabase, phone)) return;

  const ai = await getWhatsAppAiReply(phone, body);
  await sendWhatsAppMessage(phone, ai.reply);
  await logMessage(supabase, {
    phone,
    source: 'bot_outbound',
    body: ai.reply,
    escalatedAt: ai.escalate ? new Date().toISOString() : null,
  });

  if (ai.escalate) {
    await sendEscalationSms({
      customerPhone: phone,
      reason: ai.escalateReason ?? 'לא צוינה סיבה',
      lastMessage: body,
    });
  }
}

async function handleChange(supabase: ReturnType<typeof createAdminClient>, change: WebhookChange, botEnabled: boolean) {
  const messages = change.value?.messages ?? [];
  if (change.field === 'smb_message_echoes') {
    for (const msg of messages) await handleEcho(supabase, msg);
    return;
  }
  if (change.field === 'history' || change.field === 'smb_app_state_sync') {
    return; // required for Coexistence sync to complete — nothing else to do
  }
  for (const msg of messages) await handleCustomerMessage(supabase, msg, botEnabled);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode && challenge) {
    if (token !== process.env.WHATSAPP_VERIFY_TOKEN) {
      return NextResponse.json({ error: 'invalid verify token' }, { status: 403 });
    }
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (configuredSecret) {
    const provided = request.headers.get('x-webhook-secret');
    if (provided !== configuredSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from('whatsapp_bot_settings').select('enabled').eq('id', true).maybeSingle();
  const botEnabled = settings?.enabled !== false;

  for (const change of extractChanges(payload)) {
    await handleChange(supabase, change, botEnabled);
  }

  return NextResponse.json({ ok: true });
}
