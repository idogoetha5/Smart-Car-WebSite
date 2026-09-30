-- Licence plate for a car that isn't in the fleet list ("רכב שלא ברשימה").
-- The driver/manager can enter a plate, a name, or both.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_license_plate TEXT;
