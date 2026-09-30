-- Branch managers: people without admin access who assign tasks to
-- drivers from /driver/manage. They log in exactly like drivers (name +
-- 4-digit PIN), so they're rows in the drivers table with role 'manager'.
-- Run once in the Supabase SQL Editor. Safe to run more than once.
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'driver';

DO $$ BEGIN
  ALTER TABLE drivers ADD CONSTRAINT drivers_role_check CHECK (role IN ('driver', 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
