-- Run this once in the Supabase SQL Editor (same way hotfix-rls.sql was run).
-- Creates the condition_reports table backing /condition-report, which
-- previously had no persistence at all (the form just faked a success
-- message after a timeout — nothing was ever saved).

CREATE TABLE IF NOT EXISTS condition_reports (
  id             TEXT          PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  booking_id     TEXT,
  customer_name  TEXT          NOT NULL,
  mileage        INTEGER,
  fuel_level     TEXT          NOT NULL DEFAULT 'full',
  damages        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condition_reports_booking_id ON condition_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_condition_reports_created_at ON condition_reports(created_at);

ALTER TABLE condition_reports ENABLE ROW LEVEL SECURITY;

-- Service-role only — no public SELECT/INSERT policy. The form submits
-- through /api/condition-reports, which uses the service-role client
-- server-side and bypasses RLS entirely, same as bookings/leasing writes
-- that go through an API route rather than a direct client-side insert.
DROP POLICY IF EXISTS "Service role manages condition_reports" ON condition_reports;
CREATE POLICY "Service role manages condition_reports"
  ON condition_reports FOR ALL
  USING (auth.role() = 'service_role');
