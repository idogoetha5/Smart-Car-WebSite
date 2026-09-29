-- Allow operational bookings (driver/admin tasks) to reference a vehicle
-- that is not part of the rentable SmartCar fleet.
-- Run once in Supabase SQL Editor. Safe to run more than once.

ALTER TABLE bookings ALTER COLUMN vehicle_id DROP NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS custom_vehicle_name TEXT;

-- Compatibility with the earlier three-field draft of this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'custom_vehicle_make'
  ) THEN
    EXECUTE $sql$
      UPDATE bookings
      SET custom_vehicle_name = NULLIF(BTRIM(CONCAT_WS(' ', custom_vehicle_make, custom_vehicle_model, custom_vehicle_license_plate)), '')
      WHERE custom_vehicle_name IS NULL AND vehicle_id IS NULL
    $sql$;
  END IF;
END
$$;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_has_vehicle_source;
ALTER TABLE bookings ADD CONSTRAINT bookings_has_vehicle_source CHECK (
  vehicle_id IS NOT NULL
  OR NULLIF(BTRIM(custom_vehicle_name), '') IS NOT NULL
) NOT VALID;

ALTER TABLE bookings VALIDATE CONSTRAINT bookings_has_vehicle_source;
