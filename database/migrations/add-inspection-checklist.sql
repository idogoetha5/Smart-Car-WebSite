-- Optional condition checklist on vehicle inspections
-- ({ item_id: 'ok' | 'bad' }, see src/lib/inspection-checklist.ts).
-- Run once in the Supabase SQL Editor. Safe to run more than once.
ALTER TABLE vehicle_inspections
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '{}'::jsonb;
