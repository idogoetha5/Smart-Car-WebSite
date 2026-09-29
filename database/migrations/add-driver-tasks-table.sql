-- Driver tasks: phone-booked rentals assigned to drivers, not dependent
-- on a booking ever coming through the public website.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('open', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A task is a driver's job (pickup or return) on a rental — the rental
-- itself is a normal bookings row (see add-booking-source-columns.sql),
-- so the existing inspection flow, PDF and office email work unchanged.
-- No separate date/address columns here: a pickup task's schedule is
-- bookings.pickup_date/pickup_location, a return task's is
-- bookings.dropoff_date/dropoff_location. A return task "linked to" an
-- earlier pickup task is simply a second row with the same booking_id.
CREATE TABLE IF NOT EXISTS driver_tasks (
  id                 TEXT PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  booking_id         TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type               inspection_type NOT NULL,
  assigned_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  status             task_status NOT NULL DEFAULT 'open',
  notes              TEXT,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_tasks_booking_id ON driver_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_driver_tasks_assigned_driver_id ON driver_tasks(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_tasks_status ON driver_tasks(status);

ALTER TABLE driver_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON driver_tasks;
CREATE POLICY "service role only" ON driver_tasks
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_driver_tasks_updated_at ON driver_tasks;
CREATE TRIGGER trg_driver_tasks_updated_at
  BEFORE UPDATE ON driver_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
