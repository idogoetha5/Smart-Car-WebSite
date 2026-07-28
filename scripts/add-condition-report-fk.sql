-- Run once in the Supabase SQL Editor, after add-condition-reports-table.sql.
--
-- condition_reports.booking_id was a free-text column with no relationship
-- to bookings, because the form accepted any reference the customer typed.
-- Reports are now filed through a signed link that names the booking, and
-- the API verifies the booking exists — this constraint makes the database
-- enforce the same thing, so an orphaned report cannot be created by any
-- other path.
--
-- ON DELETE SET NULL rather than CASCADE: if a booking is ever removed,
-- the condition report is evidence about a vehicle handover and should
-- survive, just without its now-dangling link.
--
-- Safe on a live table: the FK is added NOT VALID first so it does not
-- block on existing rows, then validated separately. If validation fails,
-- there are pre-existing orphans to reconcile before enforcing.

ALTER TABLE condition_reports
  DROP CONSTRAINT IF EXISTS fk_condition_reports_booking;

ALTER TABLE condition_reports
  ADD CONSTRAINT fk_condition_reports_booking
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE condition_reports
  VALIDATE CONSTRAINT fk_condition_reports_booking;
