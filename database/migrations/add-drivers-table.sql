-- Driver app (/driver): per-driver PIN login, separate from admin.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

CREATE TABLE IF NOT EXISTS drivers (
  id         TEXT PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  name       TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON drivers;
CREATE POLICY "service role only" ON drivers
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_drivers_updated_at ON drivers;
CREATE TRIGGER trg_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Which driver ran an inspection — shown on the signed PDF and in the
-- office notification email. NULL for admin-created inspections.
ALTER TABLE vehicle_inspections ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL;

-- Housekeeping: pickup_time/return_time are real bookings columns already
-- used throughout the app (booking form, admin bookings API, confirmation
-- email) but were never committed in any migration in this repo — they
-- exist in production but had no tracked source of truth. Documented here
-- (idempotent) since the driver "Today" screen sorts by them.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_time TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_time TIME;
