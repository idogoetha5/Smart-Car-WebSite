-- Urgent tasks ("עכשיו" / "תוך שעה" / "תוך שעתיים"): highlighted for the
-- driver and the manager, and — when no driver was chosen — offered to every
-- active driver; the first to tap "אני לוקח" gets it.
-- Run once in the Supabase SQL Editor (after add-service-tasks.sql). Safe to run more than once.
ALTER TABLE driver_tasks ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_driver_tasks_urgent_open ON driver_tasks(created_at) WHERE urgent AND status = 'open';
