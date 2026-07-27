-- Run this once in the Supabase SQL Editor (same way hotfix-rls.sql and
-- add-condition-reports-table.sql were run).
--
-- The booking form has always collected an additional driver's name/ID
-- when the "additional driver" extra is selected, but the bookings table
-- had no columns for it, so the API silently dropped the data — the
-- customer believed the additional driver was registered, and it wasn't.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS additional_driver_name TEXT,
  ADD COLUMN IF NOT EXISTS additional_driver_id   TEXT;
