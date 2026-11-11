-- =============================================================
-- Customer verification (רישיון נהיגה ופרטי אשראי)
-- A personal link sent over WhatsApp; the customer photographs the
-- driving licence and enters card details. The card number, expiry and
-- holder ID are stored encrypted (AES-256-GCM, key in the
-- CARD_ENCRYPTION_KEY env var, never in the database). CVV is never
-- collected or stored.
-- Run once in the Supabase SQL editor.
-- =============================================================

CREATE SEQUENCE IF NOT EXISTS customer_verification_seq START 1;

CREATE TABLE IF NOT EXISTS customer_verifications (
  id                 TEXT        PRIMARY KEY
                     DEFAULT 'CV-' || to_char(NOW() AT TIME ZONE 'Asia/Jerusalem', 'YYYY') || '-' ||
                             lpad(nextval('customer_verification_seq')::TEXT, 4, '0'),
  token              TEXT        NOT NULL UNIQUE,
  status             TEXT        NOT NULL DEFAULT 'SENT'
                     CHECK (status IN ('SENT', 'COMPLETED', 'CANCELLED')),
  customer_name      TEXT,
  customer_phone     TEXT        NOT NULL,
  booking_ref        TEXT,
  locale             TEXT        NOT NULL DEFAULT 'he',
  expires_at         TIMESTAMPTZ NOT NULL,
  completed_at       TIMESTAMPTZ,

  -- Driving licence photos (private bucket `customer-verifications`)
  license_front_path TEXT,
  license_back_path  TEXT,

  -- Card: full details only as ciphertext; display fields in clear
  card_ciphertext    TEXT,
  card_last4         TEXT,
  card_brand         TEXT,
  card_expiry        TEXT,        -- MM/YY
  card_holder_name   TEXT,
  card_holder_id_type TEXT,       -- il | passport

  consent_at         TIMESTAMPTZ,
  consent_version    TEXT,
  submit_ip          TEXT,
  user_agent         TEXT,
  internal_notes     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_verifications_created_idx ON customer_verifications (created_at DESC);
CREATE INDEX IF NOT EXISTS customer_verifications_phone_idx   ON customer_verifications (customer_phone);

DROP TRIGGER IF EXISTS trg_customer_verifications_updated_at ON customer_verifications;
CREATE TRIGGER trg_customer_verifications_updated_at
  BEFORE UPDATE ON customer_verifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Who opened a record and who revealed a full card number, and when
CREATE TABLE IF NOT EXISTS customer_verification_access_log (
  id               BIGSERIAL   PRIMARY KEY,
  verification_id  TEXT        NOT NULL REFERENCES customer_verifications (id) ON DELETE CASCADE,
  action           TEXT        NOT NULL CHECK (action IN ('VIEW', 'REVEAL_CARD', 'DELETE_CARD')),
  ip               TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cv_access_log_verification_idx ON customer_verification_access_log (verification_id, created_at DESC);

-- All access goes through the server (service role). No public access.
ALTER TABLE customer_verifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_verification_access_log ENABLE ROW LEVEL SECURITY;

-- Private storage bucket for licence photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('customer-verifications', 'customer-verifications', FALSE, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
