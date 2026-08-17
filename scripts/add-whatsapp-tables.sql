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
