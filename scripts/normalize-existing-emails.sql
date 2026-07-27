-- Run this in the Supabase SQL Editor BEFORE deploying the change that
-- switches "my bookings" lookups from ilike() to an exact eq() match.
--
-- Why it is required: lookups now compare against the normalized
-- (trimmed + lowercased) address. Any existing row stored with different
-- casing or stray whitespace would stop matching, and that customer would
-- no longer see their own bookings until this runs.
--
-- Non-destructive: only rewrites the formatting of the email column.

BEGIN;

-- Preview first — run this SELECT alone and check the count is what you expect:
--   SELECT count(*) FROM bookings WHERE customer_email <> lower(btrim(customer_email));

UPDATE bookings
   SET customer_email = lower(btrim(customer_email))
 WHERE customer_email IS NOT NULL
   AND customer_email <> lower(btrim(customer_email));

UPDATE newsletter_subscribers
   SET email = lower(btrim(email))
 WHERE email IS NOT NULL
   AND email <> lower(btrim(email));

-- Verify no rows remain un-normalized (both should return 0):
--   SELECT count(*) FROM bookings WHERE customer_email <> lower(btrim(customer_email));
--   SELECT count(*) FROM newsletter_subscribers WHERE email <> lower(btrim(email));

COMMIT;
