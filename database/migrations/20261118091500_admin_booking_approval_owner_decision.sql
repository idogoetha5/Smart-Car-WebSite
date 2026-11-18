-- The office decides whether a car can be supplied. Online availability is
-- advisory and must never prevent an authenticated admin from approving a
-- booking. Preserve the atomic transition and retry-safe result so a double
-- click cannot send two confirmation emails.
CREATE OR REPLACE FUNCTION approve_booking(p_booking_id TEXT)
RETURNS TABLE (result TEXT, units INT, conflicts INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_status TEXT;
BEGIN
  SELECT b.status::TEXT INTO v_status
    FROM bookings b
   WHERE b.id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::TEXT, 0, 0;
    RETURN;
  END IF;

  IF v_status = 'CONFIRMED' THEN
    RETURN QUERY SELECT 'ALREADY_CONFIRMED'::TEXT, 0, 0;
    RETURN;
  END IF;

  UPDATE bookings SET status = 'CONFIRMED' WHERE id = p_booking_id;
  RETURN QUERY SELECT 'CONFIRMED'::TEXT, 0, 0;
END;
$fn$;

REVOKE ALL ON FUNCTION approve_booking(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_booking(TEXT) TO service_role;
