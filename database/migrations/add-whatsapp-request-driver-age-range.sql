-- Older requests may not have an age group; new requests must supply one in the bot.
ALTER TABLE public.whatsapp_rental_requests
  ADD COLUMN IF NOT EXISTS driver_age_range TEXT
  CHECK (driver_age_range IN ('21-23', '24-plus'));
