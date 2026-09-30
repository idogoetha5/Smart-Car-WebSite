-- Phone notifications (Web Push) for the driver and manager apps.
-- One row per device/browser a driver or manager turned notifications on in.
-- Only the server (service role) reads or writes this table.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_driver_idx ON push_subscriptions (driver_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get nothing; the service role bypasses RLS.
