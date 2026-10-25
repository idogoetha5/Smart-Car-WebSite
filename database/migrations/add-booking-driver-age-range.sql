-- The public booking request records only the main driver's age group.
-- It stays nullable so existing bookings remain valid and readable.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS driver_age_range TEXT
  CHECK (driver_age_range IN ('21-23', '24-plus'));

