-- The WhatsApp intake collects dates, never pickup or return hours. Keep
-- unknown times NULL instead of inserting a fictitious 09:00 appointment.
ALTER TABLE public.whatsapp_rental_requests
  ALTER COLUMN pickup_time DROP NOT NULL,
  ALTER COLUMN return_time DROP NOT NULL;
