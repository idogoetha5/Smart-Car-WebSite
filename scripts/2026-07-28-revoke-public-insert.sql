-- Finding 72 (P0): close direct anonymous writes to bookings and leasing_requests.
--
-- Production currently carries two policies, "Public can create bookings" and
-- "Public can submit leasing requests", both INSERT to role public with
-- WITH CHECK (true), and anon/authenticated hold INSERT grants on both tables.
-- The anon key is published to every browser by design, so anyone holding it
-- can POST straight to PostgREST and bypass Turnstile, rate limiting, the input
-- schema, server-side pricing, the consent record, attribution and the
-- notification path.
--
-- Safe to apply: every write in the app goes through src/app/api/** using
-- createAdminClient() (SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS. No
-- client component references either table. Verified before writing this file.
--
-- This touches permissions only. It deletes no data and drops no table.
-- Run STEP 1 first and keep the output — that is the rollback.

-- ============================================================================
-- STEP 1 — SNAPSHOT (read-only; save the output before running STEP 2)
-- ============================================================================

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'leasing_requests')
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('bookings', 'leasing_requests')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('bookings', 'leasing_requests');

-- Row counts, so STEP 3 can prove nothing was lost.
SELECT 'bookings' AS table_name, count(*) AS rows FROM public.bookings
UNION ALL
SELECT 'leasing_requests', count(*) FROM public.leasing_requests;

-- ============================================================================
-- STEP 2 — APPLY (idempotent; safe to re-run)
-- ============================================================================

BEGIN;

-- Drop the two public INSERT policies by name.
DROP POLICY IF EXISTS "Public can create bookings"          ON public.bookings;
DROP POLICY IF EXISTS "Public can submit leasing requests"  ON public.leasing_requests;

-- Belt and braces: remove ANY remaining permissive INSERT policy that grants
-- the anon or authenticated roles on these two tables, whatever it is called.
-- Naming has drifted across supabase-setup.sql, rls_migration.sql and
-- hotfix-rls.sql, so matching on name alone would leave duplicates behind.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bookings', 'leasing_requests')
      AND cmd = 'INSERT'
      AND (roles::text[] && ARRAY['public', 'anon', 'authenticated'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'dropped INSERT policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- Remove the underlying grants as well. Without this, re-adding any permissive
-- policy would immediately reopen the hole.
--
-- The snapshot showed this is broader than the audit recorded: anon and
-- authenticated hold DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
-- and UPDATE on both tables, not INSERT alone. RLS currently masks the rest
-- because no permissive policy exists for those commands, so only INSERT is
-- reachable today — but the grants sit one careless policy away from
-- anonymous DELETE or TRUNCATE on the bookings table.
--
-- Neither role needs any access: every query in the app goes through
-- createAdminClient() (service_role), and the anon client is used only for
-- auth.getUser() session checks in the my-bookings routes. Verified across
-- all 13 files that reference these tables before writing this.
REVOKE ALL ON public.bookings         FROM anon, authenticated;
REVOKE ALL ON public.leasing_requests FROM anon, authenticated;

-- RLS must stay on; service_role bypasses it, the app is unaffected.
ALTER TABLE public.bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leasing_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- STEP 3 — VERIFY (all four must hold)
-- ============================================================================

-- 3a. No INSERT policy for public/anon/authenticated remains. Expect 0 rows.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'leasing_requests')
  AND cmd = 'INSERT'
  AND (roles::text[] && ARRAY['public', 'anon', 'authenticated']);

-- 3b. No grant of any kind for anon/authenticated remains. Expect 0 rows.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('bookings', 'leasing_requests')
  AND grantee IN ('anon', 'authenticated');

-- 3c. service_role still holds INSERT, so the server routes keep working.
-- Expect one row per table.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('bookings', 'leasing_requests')
  AND grantee = 'service_role'
  AND privilege_type = 'INSERT';

-- 3d. Row counts unchanged from STEP 1.
SELECT 'bookings' AS table_name, count(*) AS rows FROM public.bookings
UNION ALL
SELECT 'leasing_requests', count(*) FROM public.leasing_requests;

-- ============================================================================
-- ROLLBACK — only if a real regression appears. Restores the exact prior state
-- shown in the STEP 1 snapshot. Note that doing so reopens finding 72.
-- ============================================================================
--
-- GRANT INSERT ON public.bookings         TO anon, authenticated;
-- GRANT INSERT ON public.leasing_requests TO anon, authenticated;
-- CREATE POLICY "Public can create bookings"         ON public.bookings
--   FOR INSERT TO public WITH CHECK (true);
-- CREATE POLICY "Public can submit leasing requests" ON public.leasing_requests
--   FOR INSERT TO public WITH CHECK (true);
