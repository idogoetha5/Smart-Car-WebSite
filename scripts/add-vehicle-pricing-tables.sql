-- Run once in the Supabase SQL Editor.
--
-- Backs the admin "Vehicle pricing" page: seasonal pricing used to be
-- hardcoded in src/lib/seasonal.ts (fixed summer/winter date windows, a
-- manually maintained holiday list, a per-make/model summer price table) —
-- any change meant editing code and redeploying. This moves that config into
-- two tables the admin UI reads and writes directly.
--
-- pricing_seasons: admin-defined date ranges with a fleet-wide default %
-- adjustment. recurs_annually seasons (summer, winter) are matched by
-- month/day only, so they don't need re-entering every year; one-off
-- seasons (a specific holiday window) are matched by exact date.
--
-- vehicle_price_overrides: optional per-vehicle override for a given season
-- — either an exact price or a different %, replacing the season default
-- for that one vehicle. Deleting the row reverts the vehicle to the
-- season's default.
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS pricing_seasons (
  id                  TEXT          PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  name_he             TEXT          NOT NULL,
  name_en             TEXT          NOT NULL,
  start_date          DATE          NOT NULL,
  end_date            DATE          NOT NULL,
  -- true: only the month/day of start_date/end_date matter, repeats every
  -- year (handles a Dec -> Feb wraparound). false: exact one-off range.
  recurs_annually     BOOLEAN       NOT NULL DEFAULT FALSE,
  -- Default % applied fleet-wide in this season, e.g. 13 or -10.
  adjustment_percent  NUMERIC(6,2)  NOT NULL DEFAULT 0,
  -- Highest wins when two seasons' ranges overlap on the same date; ties
  -- prefer the more specific (non-recurring) season — see resolveSeason()
  -- in src/lib/seasonal.ts.
  priority            INTEGER       NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_price_overrides (
  id                  TEXT          PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  vehicle_id          TEXT          NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  season_id           TEXT          NOT NULL REFERENCES pricing_seasons(id) ON DELETE CASCADE,
  -- Exactly one of the two is set: a fixed price is used verbatim, a
  -- percent replaces the season's own adjustment_percent for this vehicle.
  fixed_price         NUMERIC(10,2),
  adjustment_percent  NUMERIC(6,2),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, season_id),
  CHECK ((fixed_price IS NOT NULL) <> (adjustment_percent IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_vehicle_price_overrides_vehicle ON vehicle_price_overrides(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_price_overrides_season ON vehicle_price_overrides(season_id);

ALTER TABLE pricing_seasons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_price_overrides  ENABLE ROW LEVEL SECURITY;

-- No public Supabase policy, same as vehicles since scripts/hotfix-rls.sql:
-- every read goes through a Next.js route using the service-role client,
-- which explicitly allowlists the columns it returns.
DROP POLICY IF EXISTS "Service role manages pricing_seasons" ON pricing_seasons;
CREATE POLICY "Service role manages pricing_seasons"
  ON pricing_seasons FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages vehicle_price_overrides" ON vehicle_price_overrides;
CREATE POLICY "Service role manages vehicle_price_overrides"
  ON vehicle_price_overrides FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================
-- Seed data — reproduces today's hardcoded seasonal.ts behavior exactly,
-- so nothing changes the moment this ships. Seed rows get explicit,
-- readable ids (rather than the usual random default) purely so the
-- override inserts below can reference 'season-summer' directly.
--
-- Known, deliberate behavior change: the old summer fallback already
-- rounded to the nearest ₪10; winter rounded to the nearest ₪1. The new
-- engine rounds every %-based adjustment to the nearest ₪10 for
-- consistency, so a winter price may shift by up to a few ₪. Fixed-price
-- overrides (below) are unaffected — they're used verbatim either way.
-- =============================================================

INSERT INTO pricing_seasons (id, name_he, name_en, start_date, end_date, recurs_annually, adjustment_percent, priority)
VALUES
  ('season-summer', 'קיץ', 'Summer', '2000-07-01', '2000-08-31', TRUE, 13, 0),
  ('season-winter', 'חורף', 'Winter', '2000-12-15', '2000-02-28', TRUE, -10, 0),
  ('season-holiday-2025-09-rh-sukkot', 'ראש השנה–סוכות 2025', 'Rosh Hashana-Sukkot 2025', '2025-09-22', '2025-10-13', FALSE, 13, 0),
  ('season-holiday-2026-04-passover',  'פסח 2026',              'Passover 2026',            '2026-04-01', '2026-04-09', FALSE, 13, 0),
  ('season-holiday-2026-05-shavuot',   'שבועות 2026',           'Shavuot 2026',             '2026-05-21', '2026-05-23', FALSE, 13, 0),
  ('season-holiday-2026-09-rh-sukkot', 'ראש השנה–סוכות 2026',   'Rosh Hashana-Sukkot 2026', '2026-09-11', '2026-10-02', FALSE, 13, 0),
  ('season-holiday-2027-03-passover',  'פסח 2027',              'Passover 2027',            '2027-03-21', '2027-03-29', FALSE, 13, 0),
  ('season-holiday-2027-05-shavuot',   'שבועות 2027',           'Shavuot 2027',             '2027-05-09', '2027-05-11', FALSE, 13, 0)
ON CONFLICT (id) DO NOTHING;

-- Explicit summer prices from the old SUMMER_PRICES table (src/lib/seasonal.ts),
-- matched onto live vehicles by make/model. Anything not listed here keeps
-- using season-summer's adjustment_percent (13%, rounded to nearest ₪10) —
-- the same fallback getSummerPrice() used.
INSERT INTO vehicle_price_overrides (vehicle_id, season_id, fixed_price)
SELECT veh.id, 'season-summer', x.fixed_price
FROM vehicles veh
JOIN (VALUES
  ('Kia', 'Picanto', 250), ('Kia', 'Stonic', 330), ('Kia', 'Seltos', 390),
  ('Kia', 'Sportage', 550), ('Kia', 'Sorento', 650), ('Kia', 'Carnival', 780),
  ('Mazda', '2', 290), ('Mazda', '3', 390),
  ('Toyota', 'Yaris', 290), ('Toyota', 'Yaris Cross', 390),
  ('Mitsubishi', 'Eclipse Cross', 550),
  ('Nissan', 'Sentra', 390), ('Nissan', 'Juke', 380),
  ('Chery', 'FX', 360), ('Chery', 'Tiggo 4 Pro', 390), ('Chery', 'Tiggo 7', 490), ('Chery', 'Tiggo 8', 650),
  ('BMW', 'X1', 850),
  ('Mercedes', 'C180', 1150),
  ('Chevrolet', 'Traverse', 750),
  ('Renault', 'Kangoo', 490),
  ('Citroen', 'Berlingo', 390),
  ('Fiat', 'Doblo', 490),
  ('Ford', 'Transit', 570),
  ('Hyundai', 'Ioniq', 360),
  ('Seres', '3', 330)
) AS x(make, model, fixed_price) ON veh.make = x.make AND veh.model = x.model
ON CONFLICT (vehicle_id, season_id) DO NOTHING;
