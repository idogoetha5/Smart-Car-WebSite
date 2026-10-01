-- Garage / tyre-shop jobs ("מוסך / פנצ'רייה") for drivers, created by branch
-- managers. Unlike handovers and returns they belong to a car, not to a
-- rental, so they carry their own car, day, time and address.
-- Run once in the Supabase SQL Editor. Safe to run more than once.

ALTER TABLE driver_tasks ALTER COLUMN booking_id DROP NOT NULL;

-- 'service' joins 'pickup' / 'return' (was the inspection_type enum).
ALTER TABLE driver_tasks ALTER COLUMN type TYPE TEXT USING type::TEXT;
ALTER TABLE driver_tasks DROP CONSTRAINT IF EXISTS driver_tasks_type_check;
ALTER TABLE driver_tasks ADD CONSTRAINT driver_tasks_type_check CHECK (type IN ('pickup', 'return', 'service'));

ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS vehicle_id           TEXT REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS custom_vehicle_name  TEXT;
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS custom_license_plate TEXT;
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS scheduled_at         TIMESTAMPTZ;
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS scheduled_time       TIME;
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS location             TEXT;
-- garage | tire | wash | test | other
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS service_kind         TEXT;
-- maintenance | fault | tires | bodywork | test | wash | other
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS service_reason       TEXT;
-- Name of the garage / tyre shop (optional)
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS service_place        TEXT;

-- A handover/return always has its rental; a service job always has a day and a reason.
ALTER TABLE driver_tasks DROP CONSTRAINT IF EXISTS driver_tasks_booking_check;
ALTER TABLE driver_tasks ADD CONSTRAINT driver_tasks_booking_check CHECK (type = 'service' OR booking_id IS NOT NULL);
ALTER TABLE driver_tasks DROP CONSTRAINT IF EXISTS driver_tasks_service_check;
ALTER TABLE driver_tasks ADD CONSTRAINT driver_tasks_service_check
  CHECK (type <> 'service' OR (scheduled_at IS NOT NULL AND service_kind IS NOT NULL AND service_reason IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_driver_tasks_scheduled_at ON driver_tasks(scheduled_at) WHERE type = 'service';
