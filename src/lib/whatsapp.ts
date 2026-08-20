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
}

async function send360dialog(recipient: string, body: string): Promise<SendWhatsAppResult> {
  const apiKey = process.env.WHATSAPP_D360_API_KEY;
  if (!apiKey) throw new Error('[whatsapp] WHATSAPP_D360_API_KEY is not configured');

  const res = await fetch('https://waba.360dialog.io/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'D360-API-KEY': apiKey },
    body: JSON.stringify({ to: recipient, type: 'text', text: { body } }),
  });

  const status = res.status;
  if (!res.ok) {
    console.error(`[whatsapp][ALERT] 360dialog send failed with ${status}`);
    return { ok: false, waMessageId: null, status };
  }
  const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
  return { ok: true, waMessageId: data?.messages?.[0]?.id ?? null, status };
}

async function sendYCloud(recipient: string, body: string): Promise<SendWhatsAppResult> {
  const apiKey = process.env.WHATSAPP_YCLOUD_API_KEY;
  const sender = normalizeWhatsAppPhone(process.env.WHATSAPP_BUSINESS_PHONE ?? '');
  if (!apiKey) throw new Error('[whatsapp] WHATSAPP_YCLOUD_API_KEY is not configured');
  if (!sender) throw new Error('[whatsapp] WHATSAPP_BUSINESS_PHONE is not configured');

  const res = await fetch('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      from: `+${sender}`,
      to: `+${recipient}`,
      type: 'text',
      text: { body },
    }),
  });

  const status = res.status;
  if (!res.ok) {
    console.error(`[whatsapp][ALERT] YCloud send failed with ${status}`);
    return { ok: false, waMessageId: null, status };
  }
  const data = (await res.json().catch(() => null)) as { id?: string; wamid?: string } | null;
  return { ok: true, waMessageId: data?.wamid ?? data?.id ?? null, status };
}

async function sendMetaDirect(recipient: string, body: string): Promise<SendWhatsAppResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId) throw new Error('[whatsapp] WHATSAPP_PHONE_NUMBER_ID is not configured');
  if (!token) throw new Error('[whatsapp] WHATSAPP_ACCESS_TOKEN is not configured');

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body } }),
  });

  const status = res.status;
  if (!res.ok) {
    console.error(`[whatsapp][ALERT] Meta direct send failed with ${status}`);
    return { ok: false, waMessageId: null, status };
  }
  const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
  return { ok: true, waMessageId: data?.messages?.[0]?.id ?? null, status };
}

/**
 * Sends a free-form text reply. Only valid inside the 24h customer-service
 * window (a customer-initiated conversation) — proactive/template sends are
 * a Phase 2 concern and go through a different endpoint (message
 * templates), not this function.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<SendWhatsAppResult> {
  const recipient = normalizeWhatsAppPhone(to);
  if (!recipient) {
    console.error('[whatsapp] refusing to send — invalid recipient phone');
    return { ok: false, waMessageId: null, status: null };
  }

  try {
    const selected = transport();
    if (selected === 'ycloud') return await sendYCloud(recipient, body);
    if (selected === '360dialog') return await send360dialog(recipient, body);
    return await sendMetaDirect(recipient, body);
  } catch (err) {
    console.error('[whatsapp][ALERT] send errored:', (err as Error)?.message);
    return { ok: false, waMessageId: null, status: null };
  }
}
