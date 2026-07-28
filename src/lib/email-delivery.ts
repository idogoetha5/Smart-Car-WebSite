import { createAdminClient } from '@/lib/supabase/server';

/**
 * Single path for every transactional email.
 *
 * Previously each route called the EmailJS endpoint inline: one attempt,
 * no record of whether it arrived, and failures visible only as a line in
 * the function log. A provider blip silently cost a customer their
 * confirmation.
 *
 * This adds a bounded retry, a persisted delivery record and a clearly
 * marked alert line, and keeps personal data out of the logs — the log
 * carries the event, the template and the booking reference, never the
 * recipient's address, name or phone.
 */

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

/** Retries only on transient failures; a 4xx is a bad request, not a blip. */
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [400, 1200];

export type EmailEvent =
  | 'booking_request_received'
  | 'booking_confirmed'
  | 'contact_lead'
  | 'newsletter_signup'
  | 'condition_report';

export interface SendResult {
  ok: boolean;
  attempts: number;
  status: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Records the outcome so a missing email can be found after the fact.
 * `idempotency_key` is unique, so a retried request that already
 * succeeded cannot produce a second row — and callers can check for an
 * existing row before sending again.
 *
 * Degrades quietly if the table hasn't been created yet: losing the audit
 * row must never cost the customer the email itself.
 */
async function recordDelivery(params: {
  event: EmailEvent;
  idempotencyKey: string;
  templateId: string;
  ok: boolean;
  attempts: number;
  status: number | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('email_deliveries').upsert(
      {
        idempotency_key: params.idempotencyKey,
        event: params.event,
        template_id: params.templateId,
        delivered: params.ok,
        attempts: params.attempts,
        last_status: params.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'idempotency_key' }
    );
  } catch (err) {
    console.error('[email] delivery record failed:', (err as Error)?.message);
  }
}

/**
 * True when this exact event was already delivered — used to make a retry
 * or a double-click a no-op rather than a duplicate email.
 */
export async function alreadyDelivered(idempotencyKey: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('email_deliveries')
      .select('delivered')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    return data?.delivered === true;
  } catch {
    // Unknown means "not proven delivered". Sending again is the safer
    // failure here than silently skipping a customer's only notification.
    return false;
  }
}

export async function sendTemplateEmail({
  event,
  idempotencyKey,
  templateId,
  params,
}: {
  event: EmailEvent;
  /** Stable per event+entity, e.g. `booking_confirmed:<bookingId>`. */
  idempotencyKey: string;
  templateId: string | undefined;
  params: Record<string, unknown>;
}): Promise<SendResult> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    // Deliberately does not name which value is missing beyond the fact
    // that config is incomplete.
    console.error(`[email][ALERT] ${event} not sent — EmailJS not fully configured (ref ${idempotencyKey})`);
    return { ok: false, attempts: 0, status: null };
  }

  let lastStatus: number | null = null;
  let attempts = 0;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts = i + 1;
    try {
      const res = await fetch(EMAILJS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: params,
        }),
      });
      lastStatus = res.status;

      if (res.ok) {
        await recordDelivery({ event, idempotencyKey, templateId, ok: true, attempts, status: lastStatus });
        return { ok: true, attempts, status: lastStatus };
      }

      // 4xx is our fault (bad template/params) — retrying can't help.
      if (res.status < 500) {
        console.error(`[email][ALERT] ${event} rejected with ${res.status} (ref ${idempotencyKey}) — not retrying`);
        break;
      }
      console.warn(`[email] ${event} attempt ${attempts} failed with ${res.status} (ref ${idempotencyKey})`);
    } catch (err) {
      // Network-level failure — worth another attempt.
      console.warn(`[email] ${event} attempt ${attempts} errored (ref ${idempotencyKey}):`, (err as Error)?.message);
    }

    if (i < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[i] ?? 1200);
  }

  console.error(`[email][ALERT] ${event} undelivered after ${attempts} attempt(s), last status ${lastStatus ?? 'network error'} (ref ${idempotencyKey})`);
  await recordDelivery({ event, idempotencyKey, templateId, ok: false, attempts, status: lastStatus });
  return { ok: false, attempts, status: lastStatus };
}
