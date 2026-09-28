-- Run once in the Supabase SQL Editor.
--
-- Backing store for the WhatsApp bot (see AGENTS.md / plan for context).
-- Two tables:
--
-- whatsapp_messages logs every inbound customer message, every bot reply,
-- and every human reply Daniel sends from the agent inbox (a PWA in this
-- app — the number is migrated off the WhatsApp Business App, so there is
-- no phone app to echo from; `human_reply` rows are written directly by the
-- inbox's reply endpoint, not derived from a webhook event). `source` is
-- three-valued rather than a boolean direction because the silence rule
-- needs to ask "was the most recent thing in this phone's history a human
-- reply, and if so when" as a single cheap query — collapsing bot and human
-- into one "outbound" value would make that unanswerable. `wa_message_id`
-- is unique so a redelivered webhook (Meta retry) cannot produce a double
-- reply. `escalated_at` lives here rather than on a separate conversations
-- table because there is no conversations table — a phone number's own
-- message history, filtered by `source` and ordered by `created_at`, is
-- the conversation.
--
-- whatsapp_bot_settings is a single-row kill switch. Flipping `enabled`
-- is a Supabase row edit, not a redeploy, so it works as an actual
-- emergency stop: the webhook still logs inbound messages while off, it
-- just never calls the AI or auto-replies.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone         TEXT        NOT NULL,
  source        TEXT        NOT NULL
                              CHECK (source IN ('customer_inbound', 'bot_outbound', 'human_reply')),
  wa_message_id TEXT        UNIQUE,
  body          TEXT        NOT NULL,
  booking_id    TEXT        REFERENCES bookings(id),
  escalated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports the silence-rule lookup: "most recent row for this phone".
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_created
  ON whatsapp_messages(phone, created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Service role manages whatsapp_messages"
  ON whatsapp_messages FOR ALL
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS whatsapp_bot_settings (
  id         BOOLEAN     PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE), -- enforces a single row
  enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO whatsapp_bot_settings (id, enabled)
VALUES (TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE whatsapp_bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages whatsapp_bot_settings" ON whatsapp_bot_settings;
CREATE POLICY "Service role manages whatsapp_bot_settings"
  ON whatsapp_bot_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Persists the short, deterministic WhatsApp intake flow across messages.
-- It contains only rental preferences; the formal request remains on the
-- secure website, where customers choose a vehicle and accept the terms.
CREATE TABLE IF NOT EXISTS whatsapp_conversation_states (
  phone      TEXT        PRIMARY KEY,
  state      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Canonical lookup key for matching a WhatsApp sender to an existing booking.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone_normalized TEXT;
UPDATE bookings
SET customer_phone_normalized = CASE
  WHEN regexp_replace(customer_phone, '[^0-9]', '', 'g') LIKE '00%' THEN substring(regexp_replace(customer_phone, '[^0-9]', '', 'g') FROM 3)
  WHEN regexp_replace(customer_phone, '[^0-9]', '', 'g') LIKE '0%' THEN '972' || substring(regexp_replace(customer_phone, '[^0-9]', '', 'g') FROM 2)
  ELSE regexp_replace(customer_phone, '[^0-9]', '', 'g')
END
WHERE customer_phone_normalized IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone_normalized ON bookings(customer_phone_normalized);

-- Rental requests completed entirely in WhatsApp. They are deliberately
-- separate from bookings: no exact vehicle, availability or price has been
-- approved yet. A representative converts an accepted request into a formal
-- booking only after checking the full fleet and confirming in writing.
CREATE TABLE IF NOT EXISTS whatsapp_rental_requests (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone               TEXT        NOT NULL,
  customer_name       TEXT        NOT NULL,
  customer_email      TEXT        NOT NULL,
  pickup_date         DATE        NOT NULL,
  dropoff_date        DATE        NOT NULL,
  pickup_time         TIME        NOT NULL,
  return_time         TIME        NOT NULL,
  pickup_location     TEXT        NOT NULL,
  dropoff_location    TEXT        NOT NULL,
  vehicle_preference  TEXT        NOT NULL,
  trip_needs          TEXT,
  locale              TEXT        NOT NULL CHECK (locale IN ('he', 'en')),
  status              TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'CONVERTED', 'CLOSED')),
  terms_version       TEXT        NOT NULL,
  terms_text_hash     TEXT        NOT NULL,
  terms_accepted_at   TIMESTAMPTZ NOT NULL,
  consent_source      TEXT        NOT NULL DEFAULT 'whatsapp',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (dropoff_date > pickup_date OR (dropoff_date = pickup_date AND return_time > pickup_time))
);

-- Safe for installations that already created the table before trip needs
-- were introduced. This contains only customer-provided vehicle-fit context.
ALTER TABLE whatsapp_rental_requests ADD COLUMN IF NOT EXISTS trip_needs TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_rental_requests_created
  ON whatsapp_rental_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_rental_requests_phone
  ON whatsapp_rental_requests(phone, created_at DESC);

ALTER TABLE whatsapp_rental_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages whatsapp_rental_requests" ON whatsapp_rental_requests;
CREATE POLICY "Service role manages whatsapp_rental_requests"
  ON whatsapp_rental_requests FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE whatsapp_conversation_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages whatsapp_conversation_states" ON whatsapp_conversation_states;
CREATE POLICY "Service role manages whatsapp_conversation_states"
  ON whatsapp_conversation_states FOR ALL
  USING (auth.role() = 'service_role');

-- Controlled language-improvement queue. These phrases are deliberately
-- de-identified: no phone, email, name, address, booking number or original
-- customer message is retained. A proposed rule never affects customers until
-- a SmartCar representative marks it APPROVED.
CREATE TABLE IF NOT EXISTS whatsapp_language_candidates (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  normalized_phrase  TEXT NOT NULL CHECK (char_length(normalized_phrase) BETWEEN 2 AND 80),
  field              TEXT NOT NULL CHECK (field IN ('vehicle', 'time', 'location')),
  proposed_value     TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
  occurrences        INTEGER NOT NULL DEFAULT 1 CHECK (occurrences BETWEEN 1 AND 20),
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at        TIMESTAMPTZ,
  reviewed_by        TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_language_candidates_unique
  ON whatsapp_language_candidates(normalized_phrase, field, COALESCE(proposed_value, ''));
CREATE INDEX IF NOT EXISTS idx_whatsapp_language_candidates_review
  ON whatsapp_language_candidates(status, last_seen_at DESC);

ALTER TABLE whatsapp_language_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages whatsapp_language_candidates" ON whatsapp_language_candidates;
CREATE POLICY "Service role manages whatsapp_language_candidates"
  ON whatsapp_language_candidates FOR ALL
  USING (auth.role() = 'service_role');
