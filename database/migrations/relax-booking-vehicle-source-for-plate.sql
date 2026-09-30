-- A field job can now be created with just a licence plate (no fleet car, no
-- car name). The original check required vehicle_id or custom_vehicle_name;
-- this also accepts custom_license_plate. Run once in the Supabase SQL Editor.
-- (Applied to production on 2026-09-30.)
BEGIN;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_has_vehicle_source;
ALTER TABLE bookings ADD CONSTRAINT bookings_has_vehicle_source CHECK (
  vehicle_id IS NOT NULL
  OR NULLIF(btrim(custom_vehicle_name), '') IS NOT NULL
  OR NULLIF(btrim(custom_license_plate), '') IS NOT NULL
);
COMMIT;
