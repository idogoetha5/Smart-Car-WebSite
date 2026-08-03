import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendTemplateEmail, OUTBOX_BACKOFF_MS, type EmailEvent } from '@/lib/email-delivery';

/**
 * Sweeps the email outbox (see scripts/add-email-outbox-table.sql) for
 * sends that exhausted their in-request retries and are now due for
 * another attempt. Triggered by Vercel Cron (see the `crons` entry in
 * vercel.json) once daily at 03:00 — the Hobby plan caps cron frequency
 * at once a day, so the finer OUTBOX_BACKOFF_MS steps mostly collapse
 * into "whatever is due gets swept at the next 03:00 run."
 *
 * Vercel signs cron-triggered requests with `Authorization: Bearer
 * $CRON_SECRET` when that env var is set — this route refuses everything
 * else, including a public hit on the same URL.
 */

const BATCH_SIZE = 20;
// Cron fires once daily (Hobby plan cap), so each sweep attempt is roughly a
// day apart — 5 attempts spans about a working week before giving up.
const MAX_SWEEP_ATTEMPTS = 5;
// A hard backstop independent of attempt count: a row must not be declared
// dead just because it happened to age past one cron cycle (it used to be
// 24h, which killed a message after its very first daily sweep).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface OutboxRow {
  idempotency_key: string;
  event: EmailEvent;
  template_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  created_at: string;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from('email_outbox')
    .select('idempotency_key, event, template_id, payload, attempts, created_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[email][cron] failed to read outbox:', error.message);
    return NextResponse.json({ success: false, error: 'read failed' }, { status: 500 });
  }

  let delivered = 0;
  let dead = 0;
  let stillPending = 0;

  for (const row of (rows ?? []) as OutboxRow[]) {
    // Reuses sendTemplateEmail's own retry/backoff/idempotency logic — on
    // success it deletes this row itself (resolveRetry), so there is
    // nothing left to do here in that case.
    const result = await sendTemplateEmail({
      event: row.event,
      idempotencyKey: row.idempotency_key,
      templateId: row.template_id,
      params: row.payload,
    });

    if (result.ok) {
      delivered++;
      continue;
    }

    const attempts = row.attempts + 1;
    const ageMs = Date.now() - new Date(row.created_at).getTime();

    if (attempts >= MAX_SWEEP_ATTEMPTS || ageMs >= MAX_AGE_MS) {
      dead++;
      console.error(
        `[email][ALERT] ${row.event} permanently undelivered after ${attempts} sweep attempt(s) (ref ${row.idempotency_key})`
      );
      const { error: deadUpdateError } = await supabase
        .from('email_outbox')
        .update({ status: 'dead', attempts, updated_at: new Date().toISOString() })
        .eq('idempotency_key', row.idempotency_key);
      // A failed write here is worse than the send failure itself: the row
      // silently stays 'pending' forever instead of surfacing as 'dead' for
      // manual follow-up. Must not be swallowed.
      if (deadUpdateError) {
        console.error(
          `[email][ALERT] outbox update failed while marking ${row.event} dead (ref ${row.idempotency_key}):`,
          deadUpdateError.message
        );
      }
      continue;
    }

    stillPending++;
    const backoff = OUTBOX_BACKOFF_MS[Math.min(attempts, OUTBOX_BACKOFF_MS.length - 1)];
    const { error: rescheduleError } = await supabase
      .from('email_outbox')
      .update({
        attempts,
        next_attempt_at: new Date(Date.now() + backoff).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('idempotency_key', row.idempotency_key);
    // Same reasoning: an un-logged failure here means the row keeps its old
    // next_attempt_at (already due), so it just gets retried next sweep —
    // harmless, but must be visible rather than silent.
    if (rescheduleError) {
      console.error(
        `[email][ALERT] outbox reschedule failed for ${row.event} (ref ${row.idempotency_key}):`,
        rescheduleError.message
      );
    }
  }

  return NextResponse.json({
    success: true,
    swept: rows?.length ?? 0,
    delivered,
    dead,
    stillPending,
  });
}
