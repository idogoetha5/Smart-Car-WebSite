-- ============================================================
-- SmartCar RLS Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- All server-side routes now use service_role (createAdminClient)
-- which bypasses RLS. The anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
-- is no longer used for any direct table reads/writes.
-- ============================================================

-- 1. BOOKINGS — contains customer PII; deny all anon access
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- No permissive policies for anon or authenticated; service_role bypasses RLS

-- 2. LEASING_REQUESTS — sensitive; deny all anon access
ALTER TABLE public.leasing_requests ENABLE ROW LEVEL SECURITY;
-- No permissive policies; service_role bypasses RLS

-- 3. REVIEWS — deny all anon direct access (all via server routes)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
-- No permissive policies; service_role bypasses RLS

-- 4. CARS_FOR_SALE — deny all anon access (route switched to service_role)
ALTER TABLE public.cars_for_sale ENABLE ROW LEVEL SECURITY;
-- No permissive policies; service_role bypasses RLS

-- 5. VEHICLES — deny all anon access (catalog route uses service_role)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
-- No permissive policies; service_role bypasses RLS

-- ============================================================
-- WHAT TO VERIFY AFTER RUNNING:
-- 1. Public vehicle catalog (/he/rental) loads correctly
-- 2. My-bookings page shows bookings for logged-in user
-- 3. Submitting a review works
-- 4. Creating a booking works
-- 5. Admin can read/write all tables via admin panel
-- 6. Cars for sale page (/he/cars-for-sale) loads correctly
-- ============================================================
