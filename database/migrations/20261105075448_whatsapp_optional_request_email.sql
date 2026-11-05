-- WhatsApp already supplies the reply phone. The accepted intake/store contract
-- permits a customer to decline email; keep the physical table consistent.
-- No rows, identifiers, permissions or customer activation are changed.
ALTER TABLE public.whatsapp_rental_requests
  ALTER COLUMN customer_email DROP NOT NULL;
