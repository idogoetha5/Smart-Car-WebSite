-- Reliable Google Sheets delivery queue for Tel Aviv customer forms only.
-- The row is created before the immediate webhook call and removed only
-- after Apps Script confirms that the form id exists in the sheet.

CREATE TABLE IF NOT EXISTS customer_sheet_outbox (
  form_id          TEXT        PRIMARY KEY REFERENCES customer_details_forms(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dead')),
  attempts         INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sheet_outbox_pending
  ON customer_sheet_outbox(status, next_attempt_at);

ALTER TABLE customer_sheet_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customer sheet outbox" ON customer_sheet_outbox;
CREATE POLICY "Service role manages customer sheet outbox"
  ON customer_sheet_outbox FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE customer_sheet_outbox IS 'Retry queue for Tel Aviv customer form delivery to Google Sheets. Service-role access only.';
