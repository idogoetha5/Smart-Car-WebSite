-- One durable decision per provider message. A send that may have reached the
-- provider is never retried automatically; staff must reconcile it instead.
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_journal (
  message_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'prepared', 'sending', 'accepted', 'uncertain', 'rejected', 'suppressed')),
  reply_body TEXT,
  escalate BOOLEAN NOT NULL DEFAULT FALSE,
  provider_reply_id TEXT,
  lease_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_journal_attention
  ON public.whatsapp_inbound_journal (updated_at)
  WHERE status IN ('sending', 'uncertain', 'rejected');

ALTER TABLE public.whatsapp_inbound_journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages whatsapp_inbound_journal" ON public.whatsapp_inbound_journal;
CREATE POLICY "Service role manages whatsapp_inbound_journal"
  ON public.whatsapp_inbound_journal FOR ALL USING (auth.role() = 'service_role');

-- Row locking serializes parallel webhook deliveries and stale-lease recovery.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_inbound(
  p_message_id TEXT, p_phone TEXT
) RETURNS TABLE(action TEXT, saved_reply TEXT, should_escalate BOOLEAN, saved_provider_reply_id TEXT)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE job public.whatsapp_inbound_journal%ROWTYPE;
DECLARE inserted_id TEXT;
BEGIN
  IF NULLIF(trim(p_message_id), '') IS NULL OR NULLIF(trim(p_phone), '') IS NULL THEN
    RAISE EXCEPTION 'message id and phone required';
  END IF;
  INSERT INTO public.whatsapp_inbound_journal (message_id, phone, status, lease_until)
  VALUES (p_message_id, p_phone, 'preparing', NOW() + INTERVAL '40 seconds')
  ON CONFLICT (message_id) DO NOTHING RETURNING message_id INTO inserted_id;
  IF inserted_id IS NOT NULL THEN
    RETURN QUERY SELECT 'prepare'::TEXT, NULL::TEXT, FALSE, NULL::TEXT;
    RETURN;
  END IF;
  SELECT * INTO job FROM public.whatsapp_inbound_journal
    WHERE message_id = p_message_id FOR UPDATE;
  IF job.phone <> p_phone THEN RAISE EXCEPTION 'message id belongs to another phone'; END IF;
  IF job.status = 'preparing' THEN
    IF job.lease_until > NOW() THEN
      RETURN QUERY SELECT 'busy'::TEXT, NULL::TEXT, FALSE, NULL::TEXT;
      RETURN;
    END IF;
    UPDATE public.whatsapp_inbound_journal SET lease_until = NOW() + INTERVAL '40 seconds', updated_at = NOW()
      WHERE message_id = p_message_id;
    RETURN QUERY SELECT 'prepare'::TEXT, NULL::TEXT, FALSE, NULL::TEXT;
    RETURN;
  END IF;
  IF job.status = 'prepared' THEN
    UPDATE public.whatsapp_inbound_journal SET status = 'sending', lease_until = NOW() + INTERVAL '40 seconds', updated_at = NOW()
      WHERE message_id = p_message_id;
    RETURN QUERY SELECT 'send'::TEXT, job.reply_body, job.escalate, NULL::TEXT;
    RETURN;
  END IF;
  IF job.status = 'sending' AND job.lease_until < NOW() THEN
    UPDATE public.whatsapp_inbound_journal SET status = 'uncertain', updated_at = NOW()
      WHERE message_id = p_message_id;
    RETURN QUERY SELECT 'uncertain'::TEXT, job.reply_body, job.escalate, NULL::TEXT;
    RETURN;
  END IF;
  RETURN QUERY SELECT CASE WHEN job.status = 'sending' THEN 'busy' WHEN job.status = 'accepted' THEN 'accepted' ELSE 'done' END::TEXT,
    job.reply_body, job.escalate, job.provider_reply_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_inbound(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_inbound(TEXT, TEXT) TO service_role;
