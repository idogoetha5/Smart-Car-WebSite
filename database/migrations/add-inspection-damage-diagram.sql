-- Damage diagram for vehicle inspections (tap-to-mark damage on car
-- outlines, with note + optional photo), "no damage" + 4 side photos, and a
-- media-complete marker so a video is no longer the only way to document
-- the car's condition. See src/lib/inspection-damage.ts.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

ALTER TABLE vehicle_inspections
  ADD COLUMN IF NOT EXISTS damage_marks       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS no_damage          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS side_photos        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS media_completed_at TIMESTAMPTZ;

-- Existing video inspections that were already completed.
UPDATE vehicle_inspections
SET media_completed_at = COALESCE(media_completed_at, created_at)
WHERE video_sha256 IS NOT NULL AND media_completed_at IS NULL;

-- Damage/side photos are uploaded as JPEG.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/png', 'image/jpeg', 'application/pdf']
WHERE id = 'vehicle-inspections';
