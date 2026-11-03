import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sendHandoffEmail, reportBotIncident } from '@/lib/whatsapp-incidents';
import { sendEscalationSms } from '@/lib/sms-alert';

export const HANDOFF_EMAIL_EVENT = 'whatsapp_handoff';
const TEMPLATE = 'whatsapp_handoff_resend_v1';
const MAX_ATTEMPTS = 5;
const LEASE_MS = 45_000;
const RETRY_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
// Resend deduplicates keys for 24h. An interrupted accepted send must not
// become a fresh automatic email after that window; retain it for review.
const SAFE_REPLAY_MS = 23 * 60 * 60_000;

type HandoffRow = {
  idempotency_key: string;
  event: string;
  template_id: string;
  payload: { messageId?: string; phone?: string; firstAttemptAt?: string };
  status: 'pending' | 'dead';
  attempts: number;
  next_attempt_at: string;
};
export type HandoffDispatch = 'absent' | 'delivered' | 'pending' | 'dead';

function eventKey(messageId: string) {
  return `whatsapp_handoff:${createHash('sha256').update(messageId).digest('hex')}`;
}

/** Fail closed before conversation state commits. No customer text is queued. */
export async function enqueueHandoffEmail(messageId: string, phone: string): Promise<void> {
  if (!messageId || !/^\d{8,15}$/.test(phone)) throw new Error('[whatsapp-handoff] invalid event');
  const db = createAdminClient();
  const key = eventKey(messageId);
  const { data: audit, error: auditError } = await db.from('email_deliveries')
    .select('delivered').eq('idempotency_key', key).maybeSingle();
  if (auditError) throw new Error('[whatsapp-handoff] delivery lookup failed');
  if (audit?.delivered) return;
  const { error } = await db.from('email_outbox').upsert({
    idempotency_key: key, event: HANDOFF_EMAIL_EVENT, template_id: TEMPLATE,
    payload: { messageId, phone }, status: 'pending',
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  if (error) throw new Error('[whatsapp-handoff] queue write failed');
}

/** Only this inbound event is eligible; never resends the customer's WhatsApp. */
export async function dispatchHandoffEmail(messageId: string, phone: string): Promise<HandoffDispatch> {
  return dispatchKey(eventKey(messageId), { messageId, phone });
}

/** Cron passes a key, not untrusted provider/message payload or recipients. */
export async function retryHandoffEmail(key: string): Promise<HandoffDispatch> {
  if (!/^whatsapp_handoff:[a-f0-9]{64}$/.test(key)) throw new Error('[whatsapp-handoff] invalid retry key');
  return dispatchKey(key);
}

async function dispatchKey(key: string, expected?: { messageId: string; phone: string }): Promise<HandoffDispatch> {
  const db = createAdminClient();
  const { data, error } = await db.from('email_outbox')
    .select('idempotency_key,event,template_id,payload,status,attempts,next_attempt_at')
    .eq('idempotency_key', key).eq('event', HANDOFF_EMAIL_EVENT).maybeSingle();
  if (error) throw new Error('[whatsapp-handoff] queue lookup failed');
  if (!data) return 'absent';
  const row = data as HandoffRow;
  if (row.status === 'dead') return 'dead';
  const { messageId, phone, firstAttemptAt } = row.payload ?? {};
  if (!messageId || !phone || !/^\d{8,15}$/.test(phone) || eventKey(messageId) !== key
      || row.template_id !== TEMPLATE || expected && (expected.messageId !== messageId || expected.phone !== phone)) {
    throw new Error('[whatsapp-handoff] invalid queued payload');
  }
  const { data: audit, error: auditError } = await db.from('email_deliveries')
    .select('delivered').eq('idempotency_key', key).maybeSingle();
  if (auditError) throw new Error('[whatsapp-handoff] delivery lookup failed');
  if (audit?.delivered) {
    await resolve(key);
    return 'delivered';
  }
  const now = Date.now();
  if (Date.parse(row.next_attempt_at) > now) return 'pending';
  if (row.attempts >= MAX_ATTEMPTS || firstAttemptAt && (!Number.isFinite(Date.parse(firstAttemptAt)) || now - Date.parse(firstAttemptAt) >= SAFE_REPLAY_MS)) {
    const { error: deadError } = await db.from('email_outbox').update({ status: 'dead', updated_at: new Date(now).toISOString() })
      .eq('idempotency_key', key).eq('status', 'pending').eq('attempts', row.attempts).eq('next_attempt_at', row.next_attempt_at);
    if (deadError) throw new Error('[whatsapp-handoff] could not retain exhausted alert');
    await reportBotIncident('handoff_alert_failed');
    return 'dead';
  }
  const attempts = row.attempts + 1;
  const lease = new Date(now + LEASE_MS).toISOString();
  // Existing fields provide a compare-and-update claim: simultaneous webhook
  // and cron workers cannot both own the same due attempt.
  const { data: claimed, error: claimError } = await db.from('email_outbox').update({
    attempts, next_attempt_at: lease, updated_at: new Date(now).toISOString(),
    payload: { messageId, phone, firstAttemptAt: firstAttemptAt ?? new Date(now).toISOString() },
  }).eq('idempotency_key', key).eq('status', 'pending').eq('attempts', row.attempts)
    .eq('next_attempt_at', row.next_attempt_at).select('idempotency_key').maybeSingle();
  if (claimError) throw new Error('[whatsapp-handoff] could not claim alert');
  if (!claimed) return 'pending';
  // Preserve configured SMS as the first-attempt fast path. It has no
  // provider idempotency key, so recovery never repeats that SMS attempt.
  const smsConfigured = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'DANIEL_ALERT_PHONE'].every(name => Boolean(process.env[name]));
  const smsAccepted = row.attempts === 0 && smsConfigured && await sendEscalationSms({
    customerPhone: phone, reason: 'בקשת שירות או בטיחות', lastMessage: 'פנייה ממתינה לבדיקה בתיבת השיחות',
  });
  const accepted = smsAccepted || await sendHandoffEmail(messageId, phone);
  if (accepted) {
    // Record success BEFORE deleting the transient queue. A crash or failed
    // delete then repairs locally without another provider call.
    const { error: recordError } = await db.from('email_deliveries').upsert({
      idempotency_key: key, event: HANDOFF_EMAIL_EVENT, template_id: smsAccepted ? 'whatsapp_handoff_sms_v1' : TEMPLATE,
      delivered: true, attempts, last_status: null, updated_at: new Date().toISOString(),
    }, { onConflict: 'idempotency_key' });
    if (recordError) throw new Error('[whatsapp-handoff] could not record accepted alert');
    await resolve(key);
    return 'delivered';
  }
  const dead = attempts >= MAX_ATTEMPTS;
  const { error: retryError } = await db.from('email_outbox').update({
    status: dead ? 'dead' : 'pending',
    next_attempt_at: new Date(Date.now() + RETRY_MS[Math.min(attempts - 1, RETRY_MS.length - 1)]).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('idempotency_key', key).eq('attempts', attempts).eq('next_attempt_at', lease);
  if (retryError) throw new Error('[whatsapp-handoff] could not reschedule alert');
  await reportBotIncident('handoff_alert_failed');
  return dead ? 'dead' : 'pending';
}

async function resolve(key: string) {
  const { error } = await createAdminClient().from('email_outbox').delete()
    .eq('idempotency_key', key).eq('event', HANDOFF_EMAIL_EVENT);
  if (error) throw new Error('[whatsapp-handoff] could not resolve delivered alert');
}
