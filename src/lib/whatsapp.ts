import { normalizeWhatsAppPhone } from '@/lib/rental-quote';

/**
 * Two send transports, kept side by side on purpose: the onboarding path
 * (Coexistence via 360dialog, keeping the number in Daniel's phone app —
 * reversible, €49/month — vs. direct Meta Cloud API, migrating the number
 * off the app permanently — free, irreversible) is not decided yet. Ido is
 * running a two/three-day cheap test of the agent-inbox concept on a
 * non-production number before committing either way. `WHATSAPP_TRANSPORT`
 * picks which one is active; do not delete either branch until that
 * decision is made — see the plan.
 */

export type WhatsAppTransport = '360dialog' | 'meta_direct';

function transport(): WhatsAppTransport {
  const t = process.env.WHATSAPP_TRANSPORT;
  if (t === '360dialog' || t === 'meta_direct') return t;
  throw new Error('[whatsapp] WHATSAPP_TRANSPORT must be set to "360dialog" or "meta_direct"');
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
    return transport() === '360dialog' ? await send360dialog(recipient, body) : await sendMetaDirect(recipient, body);
  } catch (err) {
    console.error('[whatsapp][ALERT] send errored:', (err as Error)?.message);
    return { ok: false, waMessageId: null, status: null };
  }
}
