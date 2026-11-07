-- Apply before deploying rejection emails. The status transition and retry
-- entry are one transaction, so a process crash cannot lose the email.
-- The table and service-role-only RLS policy already exist.
ALTER TABLE public.booking_customer_email_outbox
  DROP CONSTRAINT IF EXISTS booking_customer_email_outbox_kind_check;

ALTER TABLE public.booking_customer_email_outbox
  ADD CONSTRAINT booking_customer_email_outbox_kind_check
  CHECK (kind IN ('request_received', 'confirmed', 'rejected'));

CREATE OR REPLACE FUNCTION public.reject_booking_with_email(
  p_booking_id TEXT,
  p_email_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_booking_id TEXT;
BEGIN
  IF p_email_payload->>'kind' IS DISTINCT FROM 'rejected'
     OR p_email_payload->>'idempotencyKey' IS DISTINCT FROM 'booking_rejected:' || p_booking_id
     OR p_email_payload->>'toEmail' IS NULL THEN
    RAISE EXCEPTION 'Invalid rejection email payload';
  END IF;

  UPDATE public.bookings
  SET status = 'REJECTED'
  WHERE id = p_booking_id AND status = 'PENDING'
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    RETURN 'NOT_PENDING';
  END IF;

  INSERT INTO public.booking_customer_email_outbox
    (idempotency_key, kind, payload, status, next_attempt_at)
  VALUES
    ('booking_rejected:' || p_booking_id, 'rejected', p_email_payload, 'pending', NOW() + INTERVAL '5 minutes')
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN 'REJECTED';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_booking_with_email(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_booking_with_email(TEXT, JSONB) TO service_role;
