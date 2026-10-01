-- Manager acknowledgement state for rental mileage, fuel and new-damage alerts.
-- Alert details are derived from the immutable signed pickup and return
-- inspections; this table only records that a manager handled the case.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS rental_alert_reviews (
  return_inspection_id  TEXT PRIMARY KEY REFERENCES vehicle_inspections(id) ON DELETE CASCADE,
  resolved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by_driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  resolved_by_role      TEXT NOT NULL DEFAULT 'manager'
    CHECK (resolved_by_role IN ('manager', 'admin')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_alert_reviews_resolved_at
  ON rental_alert_reviews(resolved_at DESC);

ALTER TABLE rental_alert_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON rental_alert_reviews;
CREATE POLICY "service role only" ON rental_alert_reviews
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_rental_alert_reviews_updated_at ON rental_alert_reviews;
CREATE TRIGGER trg_rental_alert_reviews_updated_at
  BEFORE UPDATE ON rental_alert_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
