-- SmartCar quote history and private PDF archive.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.quotes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number        TEXT NOT NULL UNIQUE,
  quote_date          TEXT NOT NULL,
  valid_until         TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,
  company_name        TEXT,
  company_id          TEXT,
  vehicle_summary     TEXT NOT NULL,
  quote_data          JSONB NOT NULL,
  pdf_path            TEXT NOT NULL,
  pdf_size            INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'saved'
                      CHECK (status IN ('saved', 'sent')),
  provider_message_id TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_created_at
  ON public.quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_name
  ON public.quotes (customer_name);
CREATE INDEX IF NOT EXISTS idx_quotes_company_name
  ON public.quotes (company_name);

CREATE OR REPLACE FUNCTION public.set_quote_history_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_quote_history_updated_at();

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: all access is through authenticated admin
-- routes using the service-role client, which bypasses RLS.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'quote-pdfs',
  'quote-pdfs',
  FALSE,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
