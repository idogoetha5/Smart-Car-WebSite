import { normalizeWhatsAppPhone } from '@/lib/rental-quote';

/**
 * Provider transport is selected at deployment time. YCloud Coexistence is
 * the preferred path because it keeps the existing WhatsApp Business App on
 * the owner's phone while exposing the official API and webhook events.
 * The other transports remain as tested fallbacks until live onboarding.
 */

export type WhatsAppTransport = 'ycloud' | '360dialog' | 'meta_direct';

function transport(): WhatsAppTransport {
  const t = process.env.WHATSAPP_TRANSPORT;
  if (t === 'ycloud' || t === '360dialog' || t === 'meta_direct') return t;
  throw new Error('[whatsapp] WHATSAPP_TRANSPORT must be set to "ycloud", "360dialog" or "meta_direct"');
}

export { normalizeWhatsAppPhone as normalizeWhatsAppSender };

export interface SendWhatsAppResult {
  ok: boolean;
  waMessageId: string | null;
  status: number | null;
  /** Acceptance is not device delivery. Never blindly retry an uncertain result. */
  outcome: 'accepted' | 'rejected' | 'uncertain' | 'not_sent';
}

const SEND_DEADLINE_MS = 8000;

async function providerRequest(url: string, init: RequestInit, messageId: (data: unknown) => string | null): Promise<SendWhatsAppResult> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(SEND_DEADLINE_MS) });
    if (!res.ok) {
      const uncertain = res.status >= 500 || res.status === 408;
      return { ok: false, waMessageId: null, status: res.status, outcome: uncertain ? 'uncertain' : 'rejected' };
    }
    const data: unknown = await res.json().catch(() => null);
    const id = messageId(data);
    return id
      ? { ok: true, waMessageId: id, status: res.status, outcome: 'accepted' }
      : { ok: false, waMessageId: null, status: res.status, outcome: 'uncertain' };
  } catch {
    console.error('[whatsapp][ALERT] provider response unavailable; delivery is uncertain');
    return { ok: false, waMessageId: null, status: null, outcome: 'uncertain' };
  }
}

function metaMessageId(data: unknown): string | null {
  const id = (data as { messages?: { id?: unknown }[] } | null)?.messages?.[0]?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

async function send360dialog(recipient: string, body: string): Promise<SendWhatsAppResult> {
  const apiKey = process.env.WHATSAPP_D360_API_KEY;
  if (!apiKey) throw new Error('[whatsapp] WHATSAPP_D360_API_KEY is not configured');

  return providerRequest('https://waba.360dialog.io/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
    body: JSON.stringify({ to: recipient, type: 'text', text: { body } }),
  }, metaMessageId);
}

async function sendYCloud(recipient: string, body: string): Promise<SendWhatsAppResult> {
  const apiKey = process.env.WHATSAPP_YCLOUD_API_KEY;
  const sender = normalizeWhatsAppPhone(process.env.WHATSAPP_BUSINESS_PHONE ?? '');
  if (!apiKey) throw new Error('[whatsapp] WHATSAPP_YCLOUD_API_KEY is not configured');
  if (!sender) throw new Error('[whatsapp] WHATSAPP_BUSINESS_PHONE is not configured');

  return providerRequest('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      from: `+${sender}`,
      to: `+${recipient}`,
      type: 'text',
      text: { body },
    }),
  }, data => {
    const value = data as { id?: unknown; wamid?: unknown } | null;
    const id = value?.wamid ?? value?.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  });
}

async function sendMetaDirect(recipient: string, body: string): Promise<SendWhatsAppResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId) throw new Error('[whatsapp] WHATSAPP_PHONE_NUMBER_ID is not configured');
  if (!token) throw new Error('[whatsapp] WHATSAPP_ACCESS_TOKEN is not configured');

  return providerRequest(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body } }),
  }, metaMessageId);
}

/**
 * Sends a free-form text reply. Only valid inside the 24h customer-service
 * window (a customer-initiated conversation) — proactive/template sends are
 * a Phase 2 concern and go through a different endpoint (message
 * templates), not this function.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<SendWhatsAppResult> {
  const recipient = normalizeWhatsAppPhone(to);
  if (!recipient || !body.trim() || body.length > 4096) {
    console.error('[whatsapp] refusing invalid recipient or message');
    return { ok: false, waMessageId: null, status: null, outcome: 'not_sent' };
  }

  try {
    const selected = transport();
    if (selected === 'ycloud') return await sendYCloud(recipient, body);
    if (selected === '360dialog') return await send360dialog(recipient, body);
    return await sendMetaDirect(recipient, body);
  } catch {
    console.error('[whatsapp][ALERT] transport configuration unavailable; message not sent');
    return { ok: false, waMessageId: null, status: null, outcome: 'not_sent' };
  }
}
