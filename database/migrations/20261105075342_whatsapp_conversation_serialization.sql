-- Text V1: serialize distinct customer messages, not merely duplicate events.
-- No domain, provider, transport, or customer-enabled setting changes.
CREATE TABLE IF NOT EXISTS public.whatsapp_phone_turns (
  phone TEXT PRIMARY KEY,
  message_id TEXT,
  owner_token UUID,
  lease_until TIMESTAMPTZ,
  hard_deadline TIMESTAMPTZ,
  manual_required_since TIMESTAMPTZ,
  manual_event_message_id TEXT
);
ALTER TABLE public.whatsapp_phone_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_phone_turns FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_phone_turns TO service_role;
ALTER TABLE public.whatsapp_inbound_journal ADD COLUMN IF NOT EXISTS owner_token UUID;
ALTER TABLE public.whatsapp_inbound_journal ADD COLUMN IF NOT EXISTS preparation_deadline TIMESTAMPTZ;
ALTER TABLE public.whatsapp_inbound_journal ADD COLUMN IF NOT EXISTS send_attempt_token UUID;
CREATE INDEX IF NOT EXISTS whatsapp_inbound_journal_phone_queue
  ON public.whatsapp_inbound_journal(phone, created_at, message_id)
  WHERE status IN ('preparing', 'prepared', 'sending', 'uncertain');

-- The row lock remains held by the calling RPC transaction until its mutation
-- commits. Checking ownership in a separate HTTP request would not fence writes.
CREATE OR REPLACE FUNCTION public.lock_whatsapp_phone_turn(p_phone TEXT, p_message_id TEXT, p_owner_token UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE owned public.whatsapp_phone_turns%ROWTYPE;
BEGIN
  SELECT * INTO owned FROM public.whatsapp_phone_turns WHERE phone = p_phone FOR UPDATE;
  IF NOT FOUND OR owned.message_id IS DISTINCT FROM p_message_id
    OR owned.owner_token IS DISTINCT FROM p_owner_token OR p_owner_token IS NULL
    OR owned.lease_until IS NULL OR owned.lease_until <= clock_timestamp()
    OR owned.hard_deadline IS NULL OR owned.hard_deadline <= clock_timestamp() THEN
    RAISE EXCEPTION 'whatsapp turn ownership expired';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_phone_turn(p_message_id TEXT, p_phone TEXT, p_emergency BOOLEAN DEFAULT FALSE)
RETURNS TABLE(action TEXT, saved_reply TEXT, should_escalate BOOLEAN, saved_provider_reply_id TEXT, turn_token UUID, attempt_token UUID, manual_event_id TEXT)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE owned public.whatsapp_phone_turns%ROWTYPE;
DECLARE job public.whatsapp_inbound_journal%ROWTYPE;
DECLARE head public.whatsapp_inbound_journal%ROWTYPE;
DECLARE token UUID;
DECLARE failed_id TEXT;
DECLARE unresolved_id TEXT;
DECLARE event_id TEXT;
DECLARE event_key TEXT;
DECLARE deadline TIMESTAMPTZ;
BEGIN
  IF NULLIF(trim(p_message_id), '') IS NULL OR p_phone IS NULL OR p_phone !~ '^\d{8,15}$' THEN RAISE EXCEPTION 'invalid whatsapp turn'; END IF;
  INSERT INTO public.whatsapp_inbound_journal(message_id, phone, status)
    VALUES(p_message_id, p_phone, 'preparing') ON CONFLICT(message_id) DO NOTHING;
  INSERT INTO public.whatsapp_phone_turns(phone) VALUES(p_phone) ON CONFLICT(phone) DO NOTHING;
  SELECT * INTO owned FROM public.whatsapp_phone_turns WHERE phone = p_phone FOR UPDATE;
  SELECT * INTO job FROM public.whatsapp_inbound_journal WHERE message_id = p_message_id FOR UPDATE;
  IF job.phone <> p_phone THEN RAISE EXCEPTION 'message belongs to another phone'; END IF;
  IF job.status IN ('accepted', 'rejected', 'suppressed') THEN
    RETURN QUERY SELECT CASE WHEN job.status='accepted' THEN 'accepted' ELSE 'done' END::TEXT,
      job.reply_body,job.escalate,job.provider_reply_id,NULL::UUID,job.send_attempt_token,NULL::TEXT; RETURN;
  END IF;
  -- Never preempt a still-live writer, including for a new incident.
  IF owned.owner_token IS NOT NULL AND owned.lease_until > clock_timestamp() THEN
    RETURN QUERY SELECT 'busy'::TEXT,NULL::TEXT,FALSE,NULL::TEXT,NULL::UUID,NULL::UUID,NULL::TEXT; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM public.whatsapp_inbound_journal WHERE phone=p_phone AND status='sending' AND lease_until>clock_timestamp()) THEN
    RETURN QUERY SELECT 'busy'::TEXT,NULL::TEXT,FALSE,NULL::TEXT,NULL::UUID,NULL::UUID,NULL::TEXT; RETURN;
  END IF;
  -- A later phone/inbox human reply acknowledges staff takeover. It does not
  -- claim delivery of any uncertain attempt; old events are never resent.
  IF owned.manual_required_since IS NOT NULL AND EXISTS(SELECT 1 FROM public.whatsapp_messages
    WHERE phone=p_phone AND source='human_reply' AND created_at>=owned.manual_required_since) THEN
    UPDATE public.whatsapp_phone_turns SET manual_required_since=NULL,manual_event_message_id=NULL WHERE phone=p_phone;
    owned.manual_required_since:=NULL; owned.manual_event_message_id:=NULL;
  END IF;
  UPDATE public.whatsapp_inbound_journal SET status='uncertain',updated_at=clock_timestamp()
    WHERE phone=p_phone AND status='sending' AND (lease_until IS NULL OR lease_until<=clock_timestamp());
  -- Provider retries are not assumed to last forever. Once the fixed overall
  -- preparation deadline is exhausted, retain the facts and yield to staff;
  -- do not leave a dead FIFO head returning 503 indefinitely or silently let
  -- ordinary AI continue as though those older customer messages were handled.
  SELECT message_id INTO failed_id FROM public.whatsapp_inbound_journal
    WHERE phone=p_phone AND status IN ('preparing','prepared')
      AND COALESCE(preparation_deadline,created_at+INTERVAL '90 seconds')<=clock_timestamp()
    ORDER BY created_at,message_id LIMIT 1;
  IF failed_id IS NOT NULL THEN
    UPDATE public.whatsapp_inbound_journal SET status='suppressed',lease_until=NULL,updated_at=clock_timestamp()
      WHERE phone=p_phone AND status IN ('preparing','prepared')
        AND COALESCE(preparation_deadline,created_at+INTERVAL '90 seconds')<=clock_timestamp();
  END IF;
  SELECT j.message_id INTO unresolved_id FROM public.whatsapp_inbound_journal j
    WHERE j.phone=p_phone AND j.status='uncertain' AND NOT EXISTS(SELECT 1 FROM public.whatsapp_messages m
      WHERE m.phone=p_phone AND m.source='human_reply' AND m.created_at>=j.created_at)
    ORDER BY j.created_at,j.message_id LIMIT 1;
  IF failed_id IS NOT NULL OR unresolved_id IS NOT NULL THEN
    event_id:=COALESCE(owned.manual_event_message_id,failed_id,unresolved_id);
    UPDATE public.whatsapp_phone_turns SET manual_required_since=COALESCE(manual_required_since,clock_timestamp()),manual_event_message_id=event_id
      WHERE phone=p_phone RETURNING manual_required_since INTO owned.manual_required_since;
    owned.manual_event_message_id:=event_id;
    event_key:='whatsapp_handoff:'||encode(sha256(convert_to(event_id,'UTF8')),'hex');
    IF NOT EXISTS(SELECT 1 FROM public.email_deliveries WHERE idempotency_key=event_key AND delivered=TRUE) THEN
      INSERT INTO public.email_outbox(idempotency_key,event,template_id,payload,status)
      VALUES(event_key,'whatsapp_handoff','whatsapp_handoff_resend_v1',jsonb_build_object('messageId',event_id,'phone',p_phone),'pending')
      ON CONFLICT(idempotency_key) DO NOTHING;
    END IF;
  END IF;
  SELECT * INTO job FROM public.whatsapp_inbound_journal WHERE message_id=p_message_id;
  IF job.status='uncertain' THEN
    RETURN QUERY SELECT 'uncertain'::TEXT,job.reply_body,job.escalate,job.provider_reply_id,NULL::UUID,job.send_attempt_token,owned.manual_event_message_id; RETURN;
  END IF;
  IF owned.manual_required_since IS NOT NULL AND NOT p_emergency THEN
    UPDATE public.whatsapp_inbound_journal SET status='suppressed',lease_until=NULL,updated_at=clock_timestamp() WHERE message_id=p_message_id AND status IN ('preparing','prepared');
    RETURN QUERY SELECT 'manual'::TEXT,NULL::TEXT,FALSE,NULL::TEXT,NULL::UUID,NULL::UUID,owned.manual_event_message_id; RETURN;
  END IF;
  -- Never resurrect this event after its own exhausted unsent deadline, even
  -- for safety: new trusted incident events still bypass a manual phone block.
  IF job.status='suppressed' THEN
    RETURN QUERY SELECT 'manual'::TEXT,NULL::TEXT,FALSE,NULL::TEXT,NULL::UUID,NULL::UUID,owned.manual_event_message_id; RETURN;
  END IF;
  SELECT * INTO head FROM public.whatsapp_inbound_journal
    WHERE phone=p_phone AND status IN ('preparing','prepared','sending') ORDER BY created_at,message_id LIMIT 1;
  IF NOT p_emergency AND head.message_id IS DISTINCT FROM p_message_id THEN
    RETURN QUERY SELECT 'busy'::TEXT,NULL::TEXT,FALSE,NULL::TEXT,NULL::UUID,NULL::UUID,NULL::TEXT; RETURN;
  END IF;
  -- New genuine incidents may bypass manual/uncertain older turns only with
  -- no active writer. External late delivery order cannot be guaranteed; we
  -- do not withhold urgent fixed safety instructions for that reason.
  token:=gen_random_uuid();
  deadline:=COALESCE(job.preparation_deadline,clock_timestamp()+INTERVAL '90 seconds');
  UPDATE public.whatsapp_phone_turns SET message_id=p_message_id,owner_token=token,
    lease_until=LEAST(deadline,clock_timestamp()+INTERVAL '40 seconds'),hard_deadline=deadline WHERE phone=p_phone;
  UPDATE public.whatsapp_inbound_journal SET owner_token=token,preparation_deadline=deadline,
    lease_until=LEAST(deadline,clock_timestamp()+INTERVAL '40 seconds'),updated_at=clock_timestamp() WHERE message_id=p_message_id;
  RETURN QUERY SELECT CASE WHEN job.status='prepared' THEN 'prepared' ELSE 'prepare' END::TEXT,
    job.reply_body,job.escalate,job.provider_reply_id,token,job.send_attempt_token,owned.manual_event_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_whatsapp_phone_turn(p_phone TEXT,p_message_id TEXT,p_owner_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.lock_whatsapp_phone_turn(p_phone,p_message_id,p_owner_token);
  UPDATE public.whatsapp_phone_turns SET lease_until=LEAST(hard_deadline,clock_timestamp()+INTERVAL '40 seconds') WHERE phone=p_phone;
  RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.release_whatsapp_phone_turn(p_phone TEXT,p_message_id TEXT,p_owner_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.whatsapp_phone_turns SET owner_token=NULL,lease_until=NULL,hard_deadline=NULL
    WHERE phone=p_phone AND message_id=p_message_id AND owner_token=p_owner_token;
  RETURN FOUND;
END;
$$;

-- Only backend-constructed, whitelisted mutations are accepted. The phone-row
-- lock is shared by every state/action/journal mutation and lease replacement.
CREATE OR REPLACE FUNCTION public.mutate_whatsapp_phone_turn(p_phone TEXT,p_message_id TEXT,p_owner_token UUID,p_kind TEXT,p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE request_id BIGINT;
DECLARE existing_phone TEXT;
DECLARE attempt UUID;
DECLARE changed TEXT;
BEGIN
  PERFORM public.lock_whatsapp_phone_turn(p_phone,p_message_id,p_owner_token);
  IF NOT EXISTS(SELECT 1 FROM public.whatsapp_inbound_journal WHERE message_id=p_message_id AND phone=p_phone AND owner_token=p_owner_token) THEN
    RAISE EXCEPTION 'journal ownership mismatch';
  END IF;
  IF p_kind='assert' THEN RETURN '{}'::JSONB;
  ELSIF p_kind='state' THEN
    IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR (p_payload->>'version') IS DISTINCT FROM '2'
      OR p_payload->>'locale' IS NULL OR p_payload->>'locale' NOT IN ('he','en')
      OR jsonb_typeof(p_payload->'history') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid state'; END IF;
    INSERT INTO public.whatsapp_conversation_states(phone,state,updated_at) VALUES(p_phone,p_payload,clock_timestamp())
      ON CONFLICT(phone) DO UPDATE SET state=EXCLUDED.state,updated_at=EXCLUDED.updated_at;
  ELSIF p_kind='request' THEN
    IF p_payload->>'phone' IS DISTINCT FROM p_phone OR NULLIF(p_payload->>'request_key','') IS NULL THEN RAISE EXCEPTION 'invalid request'; END IF;
    SELECT id,phone INTO request_id,existing_phone FROM public.whatsapp_rental_requests WHERE request_key=(p_payload->>'request_key')::UUID;
    IF FOUND THEN
      IF existing_phone<>p_phone THEN RAISE EXCEPTION 'request belongs to another phone'; END IF;
    ELSE
      INSERT INTO public.whatsapp_rental_requests(request_key,phone,customer_name,customer_email,pickup_date,dropoff_date,
        pickup_location,dropoff_location,vehicle_preference,driver_age_range,trip_needs,locale,status,
        terms_version,terms_text_hash,terms_accepted_at,consent_source)
      VALUES((p_payload->>'request_key')::UUID,p_phone,p_payload->>'customer_name',p_payload->>'customer_email',
        (p_payload->>'pickup_date')::DATE,(p_payload->>'dropoff_date')::DATE,p_payload->>'pickup_location',p_payload->>'dropoff_location',
        p_payload->>'vehicle_preference',p_payload->>'driver_age_range',p_payload->>'trip_needs',p_payload->>'locale','PENDING',
        p_payload->>'terms_version',p_payload->>'terms_text_hash',clock_timestamp(),'whatsapp') RETURNING id INTO request_id;
    END IF;
    RETURN jsonb_build_object('id',request_id::TEXT);
  ELSIF p_kind='handoff' THEN
    IF p_payload->>'key' IS DISTINCT FROM 'whatsapp_handoff:'||encode(sha256(convert_to(p_message_id,'UTF8')),'hex') THEN RAISE EXCEPTION 'invalid handoff key'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.email_deliveries WHERE idempotency_key=p_payload->>'key' AND delivered=TRUE) THEN
      INSERT INTO public.email_outbox(idempotency_key,event,template_id,payload,status)
      VALUES(p_payload->>'key','whatsapp_handoff','whatsapp_handoff_resend_v1',jsonb_build_object('messageId',p_message_id,'phone',p_phone),'pending')
      ON CONFLICT(idempotency_key) DO NOTHING;
    END IF;
  ELSIF p_kind='prepare' THEN
    UPDATE public.whatsapp_inbound_journal SET status=CASE WHEN COALESCE(p_payload->>'reply','')='' THEN 'suppressed' ELSE 'prepared' END,
      reply_body=NULLIF(p_payload->>'reply',''),escalate=COALESCE((p_payload->>'escalate')::BOOLEAN,FALSE),lease_until=NULL,updated_at=clock_timestamp()
      WHERE message_id=p_message_id AND owner_token=p_owner_token AND status='preparing' RETURNING message_id INTO changed;
    IF changed IS NULL THEN RAISE EXCEPTION 'could not prepare owned reply'; END IF;
  ELSIF p_kind='send' THEN
    attempt:=gen_random_uuid();
    UPDATE public.whatsapp_inbound_journal SET status='sending',send_attempt_token=attempt,
      lease_until=clock_timestamp()+INTERVAL '40 seconds',updated_at=clock_timestamp()
      WHERE message_id=p_message_id AND owner_token=p_owner_token AND status='prepared' AND NULLIF(reply_body,'') IS NOT NULL RETURNING message_id INTO changed;
    IF changed IS NULL THEN RAISE EXCEPTION 'could not claim owned send'; END IF;
    RETURN jsonb_build_object('attemptToken',attempt);
  ELSIF p_kind='suppress' THEN
    UPDATE public.whatsapp_inbound_journal SET status='suppressed',lease_until=NULL,updated_at=clock_timestamp()
      WHERE message_id=p_message_id AND owner_token=p_owner_token AND status='sending' RETURNING message_id INTO changed;
    IF changed IS NULL THEN RAISE EXCEPTION 'could not suppress owned send'; END IF;
  ELSE RAISE EXCEPTION 'unsupported whatsapp mutation'; END IF;
  RETURN '{}'::JSONB;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_whatsapp_phone_send(p_message_id TEXT,p_attempt_token UUID,p_status TEXT,p_provider_reply_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE changed TEXT;
BEGIN
  IF p_attempt_token IS NULL OR p_status NOT IN ('accepted','uncertain','rejected')
    OR p_status='accepted' AND NULLIF(p_provider_reply_id,'') IS NULL THEN RAISE EXCEPTION 'invalid send outcome'; END IF;
  -- Outcomes belong to the immutable send attempt, even when its phone lease
  -- expired. A late accepted response can reconcile uncertainty, never resend.
  UPDATE public.whatsapp_inbound_journal SET status=p_status,provider_reply_id=p_provider_reply_id,lease_until=NULL,updated_at=clock_timestamp()
    WHERE message_id=p_message_id AND send_attempt_token=p_attempt_token AND status IN ('sending','uncertain') RETURNING message_id INTO changed;
  IF changed IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.whatsapp_inbound_journal WHERE message_id=p_message_id AND send_attempt_token=p_attempt_token
      AND status=p_status AND provider_reply_id IS NOT DISTINCT FROM p_provider_reply_id) THEN RETURN TRUE; END IF;
    RAISE EXCEPTION 'send attempt no longer matches';
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_whatsapp_phone_turn(TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_whatsapp_phone_turn(TEXT,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.renew_whatsapp_phone_turn(TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_whatsapp_phone_turn(TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mutate_whatsapp_phone_turn(TEXT,TEXT,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_whatsapp_phone_send(TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_whatsapp_phone_turn(TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_phone_turn(TEXT,TEXT,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_whatsapp_phone_turn(TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_whatsapp_phone_turn(TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mutate_whatsapp_phone_turn(TEXT,TEXT,UUID,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_phone_send(TEXT,UUID,TEXT,TEXT) TO service_role;
