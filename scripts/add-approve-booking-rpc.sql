-- Run once in the Supabase SQL Editor.
--
-- Makes admin approval atomic. Before this, the admin route ran a SELECT
-- to count overlapping CONFIRMED/ACTIVE bookings, compared that count to
-- vehicles.total_units, and then issued a separate UPDATE. Two admins (or
-- one admin double-clicking) approving different bookings for the same
-- vehicle at the same time could both read a count below the limit and
-- both proceed — overselling the vehicle.
--
-- A single UPDATE ... WHERE (SELECT count ...) < total_units is NOT
-- sufficient under READ COMMITTED: each transaction's count would not see
-- the other's uncommitted row. The fix is to serialise on the vehicle row
-- with SELECT ... FOR UPDATE before counting, so concurrent approvals for
-- the same vehicle queue behind each other and the second one sees the
-- first one's committed result.
--
-- Additive and idempotent: creates a function, touches no existing data.

CREATE OR REPLACE FUNCTION approve_booking(p_booking_id TEXT)
RETURNS TABLE (result TEXT, units INT, conflicts INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_vehicle_id  TEXT;
  v_pickup      DATE;
  v_dropoff     DATE;
  v_status      TEXT;
  v_units       INT;
  v_conflicts   INT;
BEGIN
  -- Lock this booking so the same booking can't be approved twice
  -- concurrently.
  SELECT b.vehicle_id, b.pickup_date, b.dropoff_date, b.status::TEXT
    INTO v_vehicle_id, v_pickup, v_dropoff, v_status
    FROM bookings b
   WHERE b.id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::TEXT, 0, 0;
    RETURN;
  END IF;

  -- Already confirmed: report it so the caller can skip re-sending the
  -- confirmation email. This is what makes the email idempotent.
  IF v_status = 'CONFIRMED' THEN
    RETURN QUERY SELECT 'ALREADY_CONFIRMED'::TEXT, 0, 0;
    RETURN;
  END IF;

  -- Serialise every approval for this vehicle. Must happen BEFORE the
  -- count below, otherwise two transactions could still count in
  -- parallel. Vehicles are never deleted in the approval path, so this
  -- lock is short-lived and contention is limited to one vehicle.
  PERFORM 1 FROM vehicles v WHERE v.id = v_vehicle_id FOR UPDATE;

  SELECT GREATEST(COALESCE(v.total_units, 1), 1)
    INTO v_units
    FROM vehicles v
   WHERE v.id = v_vehicle_id;

  IF v_units IS NULL THEN
    RETURN QUERY SELECT 'VEHICLE_NOT_FOUND'::TEXT, 0, 0;
    RETURN;
  END IF;

  -- Half-open overlap: a booking ending on the day another starts does
  -- not conflict.
  SELECT COUNT(*)
    INTO v_conflicts
    FROM bookings c
   WHERE c.vehicle_id = v_vehicle_id
     AND c.id <> p_booking_id
     AND c.status::TEXT IN ('CONFIRMED', 'ACTIVE')
     AND c.pickup_date < v_dropoff
     AND c.dropoff_date > v_pickup;

  IF v_conflicts >= v_units THEN
    RETURN QUERY SELECT 'NO_UNITS'::TEXT, v_units, v_conflicts::INT;
    RETURN;
  END IF;

  UPDATE bookings SET status = 'CONFIRMED' WHERE id = p_booking_id;

  RETURN QUERY SELECT 'CONFIRMED'::TEXT, v_units, v_conflicts::INT;
END;
$fn$;

-- Only the service role calls this (every admin route uses the
-- service-role client server-side). Explicitly deny the public roles.
REVOKE ALL ON FUNCTION approve_booking(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_booking(TEXT) TO service_role;
