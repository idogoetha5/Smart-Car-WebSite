-- Run once in the Supabase SQL Editor.
--
-- Durable retry queue for transactional email. `email_deliveries` already
-- records the outcome of every send, but nothing retries a failure past the
-- 3 in-request attempts `sendTemplateEmail` already makes — a transient
-- EmailJS outage today permanently loses the email unless a human notices
-- the `[email][ALERT]` log line and resends by hand.
--
-- Deliberately a SEPARATE table from email_deliveries rather than an added
-- column there: email_deliveries is intentionally PII-free (see
-- add-email-deliveries-table.sql) so it can be read broadly as an audit
-- trail. Retrying later means resending the original `params`, which does
-- contain customer PII (email, name, sometimes phone) — that payload stays
-- isolated here instead of leaking into the audit table's design.
--
-- A row here is transient: it exists only between a failed send and either
-- a successful retry (row deleted) or a permanent give-up (status='dead',
-- left for manual inspection). It is not a historical record — that's what
-- email_deliveries is for.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS email_outbox (
  idempotency_key TEXT        PRIMARY KEY,
  event           TEXT        NOT NULL,
  template_id     TEXT        NOT NULL,
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'dead')),
  attempts        INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports the sweep's "what's due" query.
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON email_outbox(next_attempt_at) WHERE status = 'pending';

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages email_outbox" ON email_outbox;
CREATE POLICY "Service role manages email_outbox"
  ON email_outbox FOR ALL
  USING (auth.role() = 'service_role');
