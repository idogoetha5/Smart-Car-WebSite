-- Driver walk-in quick bookings: track which bookings the driver app
-- created on the spot, and which driver created them.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL;
