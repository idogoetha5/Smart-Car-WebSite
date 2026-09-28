-- Run once in the Supabase SQL Editor.
--
-- Adds an optional fleet-wide fixed price to pricing_seasons, alongside the
-- existing adjustment_percent. Lets the admin set a season's default as
-- either "+13% off the regular price" (existing behavior) or "₪X/day for
-- the whole fleet" (new) instead of only a percentage.
--
-- Nullable, defaults to NULL on every existing row — every season created
-- before this migration keeps using adjustment_percent exactly as before;
-- see priceForSeason() in src/lib/seasonal.ts for the resolution order
-- (per-vehicle override > season fixed_price > season adjustment_percent).
--
-- Additive and idempotent. Does not touch any existing row's data.

ALTER TABLE pricing_seasons
  ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10,2);
