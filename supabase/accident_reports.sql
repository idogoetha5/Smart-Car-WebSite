-- =============================================================
-- Accident reports (דו"ח תאונה דיגיטלי)
-- Run once in the Supabase SQL editor.
-- =============================================================

-- Report numbers: SC-2026-0001, SC-2026-0002, ...
CREATE SEQUENCE IF NOT EXISTS accident_report_seq START 1;

CREATE TABLE IF NOT EXISTS accident_reports (
  id              TEXT        PRIMARY KEY
                  DEFAULT 'SC-' || to_char(NOW() AT TIME ZONE 'Asia/Jerusalem', 'YYYY') || '-' ||
                          lpad(nextval('accident_report_seq')::TEXT, 4, '0'),
  status          TEXT        NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW', 'IN_PROGRESS', 'SENT_TO_INSURANCE', 'CLOSED')),
  -- Searchable summary columns (the full answers live in `data`)
  car_plate       TEXT        NOT NULL,
  car_model       TEXT,
  driver_name     TEXT        NOT NULL,
  driver_phone    TEXT        NOT NULL,
  accident_date   DATE,
  other_vehicle   BOOLEAN     NOT NULL DEFAULT FALSE,
  branch          TEXT,
  locale          TEXT        NOT NULL DEFAULT 'he',
  data            JSONB       NOT NULL,
  pdf_path        TEXT,
  email_sent      BOOLEAN     NOT NULL DEFAULT FALSE,
  internal_notes  TEXT,
  link_token      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accident_reports_created_idx ON accident_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS accident_reports_plate_idx   ON accident_reports (car_plate);

DROP TRIGGER IF EXISTS trg_accident_reports_updated_at ON accident_reports;
CREATE TRIGGER trg_accident_reports_updated_at
  BEFORE UPDATE ON accident_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Personal links sent to customers over WhatsApp (pre-filled form)
CREATE TABLE IF NOT EXISTS accident_report_links (
  token         TEXT        PRIMARY KEY,
  car_plate     TEXT,
  car_model     TEXT,
  driver_name   TEXT,
  driver_phone  TEXT,
  driver_id     TEXT,
  branch        TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email recipients, editable from the admin screen
CREATE TABLE IF NOT EXISTS accident_report_settings (
  id          INTEGER     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  recipients  TEXT[]      NOT NULL DEFAULT ARRAY['office@smartcar.co.il'],
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO accident_report_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- All access goes through the server (service role). No public access.
ALTER TABLE accident_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accident_report_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accident_report_settings ENABLE ROW LEVEL SECURITY;

-- Private storage bucket for photos, signatures and PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('accident-reports', 'accident-reports', FALSE, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
