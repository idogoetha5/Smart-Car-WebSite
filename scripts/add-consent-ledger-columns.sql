-- Run this once in the Supabase SQL Editor (same way the other scripts
-- in this folder were run).
--
-- 1) Booking consent ledger: the booking form requires checking "I agree
--    to the terms" / "I want marketing emails", but neither the terms
--    version the customer actually agreed to, the timestamp, nor the
--    marketing opt-in itself were ever stored.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS terms_version      TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_consent  BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Newsletter signups had NO database record at all — the API only
--    sent a notification email to the marketing inbox, so there was no
--    stored list of subscribers, no evidence of consent, and no way to
--    honor an unsubscribe request. This creates a minimal real ledger.
--    (Full double opt-in / unsubscribe-link automation is a separate,
--    bigger feature — not built here, flagged as a remaining gap.)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT        PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  email       TEXT        NOT NULL UNIQUE,
  consent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locale      TEXT,
  source      TEXT        NOT NULL DEFAULT 'newsletter_form',
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "Service role manages newsletter_subscribers"
  ON newsletter_subscribers FOR ALL
  USING (auth.role() = 'service_role');

-- 3) Contact-form leads were only ever sent as an email notification —
--    an EmailJS outage silently lost the lead with no stored record.
--    Leads are now saved here BEFORE the notification email is attempted.
CREATE TABLE IF NOT EXISTS contact_leads (
  id          TEXT        PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  name        TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  email       TEXT,
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contact_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages contact_leads" ON contact_leads;
CREATE POLICY "Service role manages contact_leads"
  ON contact_leads FOR ALL
  USING (auth.role() = 'service_role');
