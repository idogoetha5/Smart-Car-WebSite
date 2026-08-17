import { normalizeWhatsAppPhone } from '@/lib/rental-quote';

/**
 * Thin client for 360dialog's WhatsApp Cloud API proxy — chosen over
 * talking to Meta's Graph API directly because Coexistence onboarding (the
 * business number stays live in the WhatsApp Business App on Daniel's
 * phone, see the plan) can only be run through an approved BSP/Tech
 * Provider. Endpoint shape follows docs.360dialog.com; re-check against
 * their current API reference if this ever needs to change versions.
 */

const D360_BASE_URL = 'https://waba.360dialog.io/v1';

function apiKey(): string {
  const key = process.env.WHATSAPP_D360_API_KEY;
  if (!key) throw new Error('[whatsapp] WHATSAPP_D360_API_KEY is not configured');
  return key;
}

export { normalizeWhatsAppPhone as normalizeWhatsAppSender };

export interface SendWhatsAppResult {
  ok: boolean;
  waMessageId: string | null;
  status: number | null;
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
    const res = await fetch(`${D360_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey(),
      },
      body: JSON.stringify({
        to: recipient,
        type: 'text',
        text: { body },
      }),
    });

    const status = res.status;
    if (!res.ok) {
      console.error(`[whatsapp][ALERT] send failed with ${status}`);
      return { ok: false, waMessageId: null, status };
    }

    const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
    return { ok: true, waMessageId: data?.messages?.[0]?.id ?? null, status };
  } catch (err) {
    console.error('[whatsapp][ALERT] send errored:', (err as Error)?.message);
    return { ok: false, waMessageId: null, status: null };
  }
}
