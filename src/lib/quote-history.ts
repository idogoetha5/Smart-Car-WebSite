import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { quoteValidUntil, type QuoteData } from '@/lib/quote-pdf';

export type QuoteHistoryStatus = 'saved' | 'sent';

export interface QuoteHistoryRow {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  customer_name: string;
  customer_email: string;
  company_name: string | null;
  company_id: string | null;
  vehicle_summary: string;
  pdf_path: string;
  pdf_size: number;
  status: QuoteHistoryStatus;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function safeQuotePart(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\-_.]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'quote';
}

export function quotePdfFilename(
  data: Pick<QuoteData, 'customerName' | 'quoteNumber'>
): string {
  return `SmartCar_Quote_${safeQuotePart(data.customerName)}_${safeQuotePart(data.quoteNumber)}.pdf`;
}

/**
 * The six-digit `quote_number` is a customer-facing display value only — it
 * is expected to repeat over time and across customers (900,000 possible
 * values, no dedup). The real identity of a saved quotation is `data.id`, a
 * client-generated UUID stable for one quote-builder session: every
 * "regenerate PDF" click while the admin keeps editing the same draft
 * reuses it, so those saves correctly update one row in place, while two
 * genuinely different quotations — even for the same customer, same email,
 * created at the same moment, or landing on the same random six-digit
 * number — always get distinct ids and therefore distinct rows and PDFs.
 * Email equality is never used as evidence of "same quote".
 *
 * The upsert is keyed on the DB's own PRIMARY KEY (id), so there is no
 * unique constraint left for two different quotations to conflict on — the
 * insert-or-update either creates a fresh row or updates the exact row this
 * session already owns. The retry loop below exists only for the
 * astronomically unlikely case of a client (or a caller with a bug) supplying
 * an id that collides with an unrelated existing quote — it never fires in
 * normal operation.
 */
async function insertOrUpdateQuote(
  supabase: ReturnType<typeof createAdminClient>,
  data: QuoteData,
  pdfPath: string,
  pdf: Buffer
): Promise<QuoteHistoryRow> {
  const vehicleSummary = data.vehicles
    .filter((vehicle) => vehicle.name?.trim())
    .map((vehicle) => vehicle.name.trim())
    .join(', ');

  let id = data.id;

  for (let tries = 0; tries < 5; tries++) {
    const { data: existing } = await supabase
      .from('quotes')
      .select('status, sent_at, provider_message_id, customer_email')
      .eq('id', id)
      .maybeSingle();

    // Defends against an id that already belongs to a *different* customer's
    // quote — should never happen with a real UUID, but if it did, silently
    // overwriting their row would be exactly the bug this exists to prevent.
    if (existing && existing.customer_email.trim().toLowerCase() !== data.customerEmail.trim().toLowerCase()) {
      id = randomUUID();
      continue;
    }

    const { data: saved, error: saveError } = await supabase
      .from('quotes')
      .upsert(
        {
          id,
          quote_number: data.quoteNumber,
          quote_date: data.date,
          valid_until: quoteValidUntil(data),
          customer_name: data.customerName.trim(),
          customer_email: data.customerEmail.trim(),
          company_name: data.companyName?.trim() || null,
          company_id: data.companyId?.trim() || null,
          vehicle_summary: vehicleSummary,
          quote_data: { ...data, id },
          pdf_path: pdfPath,
          pdf_size: pdf.byteLength,
          status: existing?.status === 'sent' ? 'sent' : 'saved',
          sent_at: existing?.sent_at ?? null,
          provider_message_id: existing?.provider_message_id ?? null,
        },
        { onConflict: 'id' }
      )
      .select(
        'id, quote_number, quote_date, valid_until, customer_name, customer_email, company_name, company_id, vehicle_summary, pdf_path, pdf_size, status, provider_message_id, sent_at, created_at, updated_at'
      )
      .single();

    if (saveError) {
      // 23505 = unique_violation. The only remaining unique constraint is
      // the id primary key itself; retrying with a fresh id is the atomic,
      // race-safe response to a genuine conflict there.
      if ((saveError as { code?: string }).code === '23505') {
        id = randomUUID();
        continue;
      }
      throw new Error(`quote history save failed: ${saveError.message}`);
    }
    if (!saved) throw new Error('quote history save failed: missing row');

    return saved as QuoteHistoryRow;
  }

  throw new Error('quote history save failed: id collision, exhausted retries');
}

export async function archiveQuotePdf(
  data: QuoteData,
  pdf: Buffer
): Promise<QuoteHistoryRow> {
  const supabase = createAdminClient();
  // Keyed by id, never by the display quote_number: two different customers
  // can legitimately share a six-digit number, and their PDFs must never
  // land on the same storage object.
  const pdfPath = `${safeQuotePart(data.id)}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('quote-pdfs')
    .upload(pdfPath, pdf, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`quote PDF archive failed: ${uploadError.message}`);
  }

  return insertOrUpdateQuote(supabase, data, pdfPath, pdf);
}

export async function markQuoteSent(
  id: string,
  providerMessageId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'sent',
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`quote sent status update failed: ${error.message}`);
  }
}

export async function downloadArchivedQuotePdf(
  pdfPath: string
): Promise<Buffer> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from('quote-pdfs')
    .download(pdfPath);

  if (error || !data) {
    throw new Error(`quote PDF download failed: ${error?.message ?? 'missing file'}`);
  }

  return Buffer.from(await data.arrayBuffer());
}
