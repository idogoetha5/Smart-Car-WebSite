-- Run once in the Supabase SQL Editor.
--
-- quote_number was UNIQUE, and archiveQuotePdf() used to upsert on it — so
-- two genuinely different quotations that happened to draw the same random
-- six-digit number (or the same customer requesting a second, different
-- quote) could silently overwrite each other's saved row and archived PDF.
-- The application now treats `id` (already the primary key) as the sole
-- real identity of a quote and quote_number as a display-only value that is
-- expected to repeat — see src/lib/quote-history.ts.
--
-- This only loosens a constraint; no existing row is modified, moved, or
-- deleted, and today's quote_numbers are already distinct so dropping the
-- constraint is a no-op against current data. A plain (non-unique) index is
-- kept for quote-history search/lookup by number.
--
-- Additive and idempotent.

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;

CREATE INDEX IF NOT EXISTS idx_quotes_quote_number
  ON public.quotes (quote_number);
