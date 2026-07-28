-- Run once in the Supabase SQL Editor.
--
-- Delivery record for transactional email. Every send previously happened
-- inline with a single attempt and no persisted outcome, so "the customer
-- says they never got the confirmation" was unanswerable.
--
-- idempotency_key is the primary key: it is derived from the event plus
-- the entity it concerns (e.g. 'booking_confirmed:<booking id>'), so the
-- same event can only ever record once, and a retry can check for an
-- existing delivered row instead of sending a duplicate.
--
-- Deliberately holds NO personal data — no recipient address, name or
-- phone. The booking reference in the key is enough to trace a delivery
-- back to its booking.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS email_deliveries (
  idempotency_key TEXT        PRIMARY KEY,
  event           TEXT        NOT NULL,
  template_id     TEXT        NOT NULL,
  delivered       BOOLEAN     NOT NULL DEFAULT FALSE,
  attempts        INTEGER     NOT NULL DEFAULT 0,
  last_status     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports the "what failed to go out" operational query.
CREATE INDEX IF NOT EXISTS idx_email_deliveries_undelivered
  ON email_deliveries(created_at) WHERE delivered = FALSE;

ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages email_deliveries" ON email_deliveries;
CREATE POLICY "Service role manages email_deliveries"
  ON email_deliveries FOR ALL
  USING (auth.role() = 'service_role');
