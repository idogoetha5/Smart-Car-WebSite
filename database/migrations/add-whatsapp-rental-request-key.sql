-- One persisted key per confirmed conversation draft prevents duplicate rental
-- requests when a webhook retries after the insert but before state is saved.
ALTER TABLE public.whatsapp_rental_requests
  ADD COLUMN IF NOT EXISTS request_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_rental_requests_request_key_unique
  ON public.whatsapp_rental_requests (request_key);
