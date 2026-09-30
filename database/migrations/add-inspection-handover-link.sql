-- A return inspection can point at the handover (pickup) inspection it's
-- compared with — chosen by the driver by customer name when the return
-- isn't on the same booking (e.g. a walk-in return). Used for the grey
-- "already recorded" damage, and the mileage/fuel/checklist comparison.
-- Run once in the Supabase SQL Editor. Safe to run more than once.
ALTER TABLE vehicle_inspections
  ADD COLUMN IF NOT EXISTS handover_inspection_id TEXT REFERENCES vehicle_inspections(id) ON DELETE SET NULL;
