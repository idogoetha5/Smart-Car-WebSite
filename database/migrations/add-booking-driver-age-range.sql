-- The public booking request records only the main driver's age group.
-- It stays nullable so existing bookings remain valid and readable.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS driver_age_range TEXT
  CHECK (driver_age_range IN ('21-23', '24-plus'));

-- The earlier birth-date field was never used in a submitted booking.
ALTER TABLE bookings
  DROP COLUMN IF EXISTS driver_date_of_birth;
