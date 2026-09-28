-- Run once in the Supabase SQL Editor before publishing the branch QR form.

CREATE TABLE IF NOT EXISTS customer_details_forms (
  id                          TEXT        PRIMARY KEY DEFAULT 'f' || replace(gen_random_uuid()::TEXT, '-', ''),
  branch_id                   TEXT        NOT NULL CHECK (branch_id IN ('herzliya', 'telaviv', 'jerusalem', 'airport')),
  full_name                   TEXT        NOT NULL,
  date_of_birth               DATE        NOT NULL,
  passport_number             TEXT        NOT NULL,
  driver_license_number       TEXT        NOT NULL,
  country                     TEXT        NOT NULL,
  city                        TEXT        NOT NULL,
  address                     TEXT        NOT NULL,
  postal_code                 TEXT,
  phone                       TEXT        NOT NULL,
  israel_address              TEXT,
  email                       TEXT        NOT NULL,
  locale                      TEXT        NOT NULL CHECK (locale IN ('he', 'en')),
  source                      TEXT        NOT NULL DEFAULT 'branch_qr',
  status                      TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
  invoice_notice_accepted_at  TIMESTAMPTZ NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_details_forms_branch_created
  ON customer_details_forms(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_details_forms_status
  ON customer_details_forms(status);

ALTER TABLE customer_details_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages customer details forms" ON customer_details_forms;
CREATE POLICY "Service role manages customer details forms"
  ON customer_details_forms FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE customer_details_forms IS 'Sensitive branch rental intake forms. Service-role access only.';
