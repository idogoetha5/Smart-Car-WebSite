-- Run once in the Supabase SQL Editor before deploying the durable Resend
-- customer-email retry flow. Payloads contain customer contact information,
-- so this queue is service-role only and rows are removed after delivery.

CREATE TABLE IF NOT EXISTS booking_customer_email_outbox (
  idempotency_key TEXT        PRIMARY KEY,
  kind            TEXT        NOT NULL CHECK (kind IN ('request_received', 'confirmed')),
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dead')),
  attempts        INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_customer_email_outbox_pending
  ON booking_customer_email_outbox(next_attempt_at) WHERE status = 'pending';

ALTER TABLE booking_customer_email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages booking_customer_email_outbox" ON booking_customer_email_outbox;
CREATE POLICY "Service role manages booking_customer_email_outbox"
  ON booking_customer_email_outbox FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
