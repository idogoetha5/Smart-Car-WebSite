import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendTemplateEmail, OUTBOX_BACKOFF_MS, type EmailEvent } from '@/lib/email-delivery';

/**
 * Sweeps the email outbox (see scripts/add-email-outbox-table.sql) for
 * sends that exhausted their in-request retries and are now due for
 * another attempt. Triggered by Vercel Cron (see the `crons` entry in
 * vercel.json) roughly every 10 minutes.
 *
 * Vercel signs cron-triggered requests with `Authorization: Bearer
 * $CRON_SECRET` when that env var is set — this route refuses everything
 * else, including a public hit on the same URL.
 */

const BATCH_SIZE = 20;
const MAX_SWEEP_ATTEMPTS = 5;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
      await supabase
        .from('email_outbox')
        .update({ status: 'dead', attempts, updated_at: new Date().toISOString() })
        .eq('idempotency_key', row.idempotency_key);
      continue;
    }

    stillPending++;
    const backoff = OUTBOX_BACKOFF_MS[Math.min(attempts, OUTBOX_BACKOFF_MS.length - 1)];
    await supabase
      .from('email_outbox')
      .update({
        attempts,
        next_attempt_at: new Date(Date.now() + backoff).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('idempotency_key', row.idempotency_key);
  }

  return NextResponse.json({
    success: true,
    swept: rows?.length ?? 0,
    delivered,
    dead,
    stillPending,
  });
}
