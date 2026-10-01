-- Operational fleet details used by the branch-manager vehicle screen.
-- Safe to run more than once.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS test_due_date DATE,
  ADD COLUMN IF NOT EXISTS current_odometer_km INTEGER;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_current_odometer_km_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_current_odometer_km_check
  CHECK (current_odometer_km IS NULL OR current_odometer_km >= 0);

CREATE INDEX IF NOT EXISTS idx_vehicles_test_due_date
  ON vehicles(test_due_date)
  WHERE test_due_date IS NOT NULL;
