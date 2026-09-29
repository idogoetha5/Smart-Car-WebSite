-- Digital vehicle inspection (pickup / return): video walk-around,
-- odometer/fuel, customer e-signature, signed PDF.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

DO $$ BEGIN
  CREATE TYPE inspection_type AS ENUM ('pickup', 'return');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inspection_status AS ENUM ('awaiting_signature', 'signed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id                    TEXT PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  booking_id            TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  type                  inspection_type NOT NULL,
  odometer_km           INTEGER NOT NULL,
  -- Tap-scale fuel gauge: E / ¼ / ½ / ¾ / F → 0 / 2 / 4 / 6 / 8.
  fuel_eighths          SMALLINT NOT NULL CHECK (fuel_eighths BETWEEN 0 AND 8),
  video_path            TEXT,
  video_sha256          TEXT,
  status                inspection_status NOT NULL DEFAULT 'awaiting_signature',
  signed_at             TIMESTAMPTZ,
  signer_ip             TEXT,
  signer_user_agent     TEXT,
  signature_image_path  TEXT,
  signed_pdf_path       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_booking_id ON vehicle_inspections(booking_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_status ON vehicle_inspections(status);

ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON vehicle_inspections;
CREATE POLICY "service role only" ON vehicle_inspections
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_vehicle_inspections_updated_at ON vehicle_inspections;
CREATE TRIGGER trg_vehicle_inspections_updated_at
  BEFORE UPDATE ON vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Pre-authorises exactly one direct-to-storage video upload per inspection.
-- The browser uploads with the (public) anon key, so the storage policy
-- below is what actually gates the write: an insert into storage.objects
-- for this bucket is only allowed while a matching, unexpired row exists
-- here. Rows are single-use in practice — the API route that creates one
-- deletes it once the upload is confirmed.
CREATE TABLE IF NOT EXISTS inspection_upload_slots (
  path          TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inspection_upload_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON inspection_upload_slots;
CREATE POLICY "service role only" ON inspection_upload_slots
  FOR ALL USING (auth.role() = 'service_role');

-- Private bucket for inspection videos, signature images and signed PDFs.
-- Never public — every read goes through a token-gated route (see
-- src/app/insp-video/[token] and src/app/insp-pdf/[token]), same posture
-- as the quote-pdfs bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-inspections',
  'vehicle-inspections',
  FALSE,
  5368709120, -- 5GB; the effective cap is still the project's own max-upload-size setting
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lets the browser's anon-key TUS upload write only the exact object path
-- our API pre-authorised in inspection_upload_slots, and only before it
-- expires. All other writes/reads to this bucket still require the
-- service-role client (no other policy is defined), matching quote-pdfs.
DROP POLICY IF EXISTS "inspection video resumable upload" ON storage.objects;
CREATE POLICY "inspection video resumable upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-inspections'
    AND EXISTS (
      SELECT 1 FROM inspection_upload_slots s
      WHERE s.path = storage.objects.name AND s.expires_at > NOW()
    )
  );

DROP POLICY IF EXISTS "inspection video resumable upload update" ON storage.objects;
CREATE POLICY "inspection video resumable upload update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'vehicle-inspections'
    AND EXISTS (
      SELECT 1 FROM inspection_upload_slots s
      WHERE s.path = storage.objects.name AND s.expires_at > NOW()
    )
  );
