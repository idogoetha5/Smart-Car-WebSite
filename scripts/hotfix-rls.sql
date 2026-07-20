-- =============================================================
--  SmartCar — RLS hotfix (2026-07-20)
--  Run once in: Supabase Dashboard → SQL Editor → New Query
--
--  Safe to run on a LIVE database with real data — it never drops
--  a table or a row. It only:
--   1. Enables RLS (idempotent — no-op if already enabled).
--   2. Removes the "Public can read own booking conflicts" policy,
--      which was defined as `USING (TRUE)` and therefore let anyone
--      holding the public anon key read every customer's name,
--      email, phone, and ID number directly from bookings via the
--      Supabase REST API — the app itself never needed this policy;
--      every read goes through service-role API routes.
--   3. Locks reviews/cars_for_sale down to service-role-only, since
--      the app only ever touches them server-side too.
--
--  Do NOT run supabase-setup.sql again to "fix" this — that script
--  DROPs and recreates vehicles/bookings/leasing_requests/
--  seo_redirects and will erase live data.
-- =============================================================

ALTER TABLE vehicles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE leasing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_redirects    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read own booking conflicts" ON bookings;

ALTER TABLE IF EXISTS reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cars_for_sale  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages reviews" ON reviews;
CREATE POLICY "Service role manages reviews"
  ON reviews FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages cars_for_sale" ON cars_for_sale;
CREATE POLICY "Service role manages cars_for_sale"
  ON cars_for_sale FOR ALL
  USING (auth.role() = 'service_role');

-- Verify afterwards — every row should show rowsecurity = true and
-- "bookings" should NOT have any policy with a bare USING (true) on SELECT:
-- select relname, relrowsecurity from pg_class
--   where relname in ('vehicles','bookings','leasing_requests','seo_redirects','reviews','cars_for_sale');
-- select tablename, policyname, cmd, qual from pg_policies where tablename = 'bookings';
