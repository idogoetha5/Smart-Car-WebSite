import { createAdminClient } from '@/lib/supabase/server';
import { generateQuoteNumber, quoteValidUntil, type QuoteData } from '@/lib/quote-pdf';

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
 * `quote_number` is UNIQUE in the database and `archiveQuotePdf` upserts on
 * it, so two unrelated quotations that randomly draw the same six digits
 * would otherwise have the second one silently overwrite the first
 * customer's saved row and archived PDF. Re-saving the *same* quotation
 * (matched by customer email) is meant to update its own row in place, so
 * that case returns the candidate unchanged; a genuine collision with a
 * different customer draws a fresh number and checks again.
 */
export async function resolveUniqueQuoteNumber(
  candidate: string,
  customerEmail: string
): Promise<string> {
  const supabase = createAdminClient();
  const normalizedEmail = customerEmail.trim().toLowerCase();
  let attempt = candidate;

  for (let tries = 0; tries < 20; tries++) {
    const { data: existing } = await supabase
      .from('quotes')
      .select('customer_email')
      .eq('quote_number', attempt)
      .maybeSingle();

    if (!existing || existing.customer_email.trim().toLowerCase() === normalizedEmail) {
      return attempt;
    }

    attempt = generateQuoteNumber();
  }

  throw new Error('quote number collision: no free number found after 20 attempts');
}

export async function archiveQuotePdf(
  data: QuoteData,
  pdf: Buffer
): Promise<QuoteHistoryRow> {
  const supabase = createAdminClient();
  const pdfPath = `${safeQuotePart(data.quoteNumber)}.pdf`;

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

  const { data: existing } = await supabase
    .from('quotes')
    .select('status, sent_at, provider_message_id')
    .eq('quote_number', data.quoteNumber)
    .maybeSingle();

  const vehicleSummary = data.vehicles
    .filter((vehicle) => vehicle.name?.trim())
    .map((vehicle) => vehicle.name.trim())
    .join(', ');

  const { data: saved, error: saveError } = await supabase
    .from('quotes')
    .upsert(
      {
        quote_number: data.quoteNumber,
        quote_date: data.date,
        valid_until: quoteValidUntil(data),
        customer_name: data.customerName.trim(),
        customer_email: data.customerEmail.trim(),
        company_name: data.companyName?.trim() || null,
        company_id: data.companyId?.trim() || null,
        vehicle_summary: vehicleSummary,
        quote_data: data,
        pdf_path: pdfPath,
        pdf_size: pdf.byteLength,
        status: existing?.status === 'sent' ? 'sent' : 'saved',
        sent_at: existing?.sent_at ?? null,
        provider_message_id: existing?.provider_message_id ?? null,
      },
      { onConflict: 'quote_number' }
    )
    .select(
      'id, quote_number, quote_date, valid_until, customer_name, customer_email, company_name, company_id, vehicle_summary, pdf_path, pdf_size, status, provider_message_id, sent_at, created_at, updated_at'
    )
    .single();

  if (saveError || !saved) {
    throw new Error(`quote history save failed: ${saveError?.message ?? 'missing row'}`);
  }

  return saved as QuoteHistoryRow;
}

export async function markQuoteSent(
  quoteNumber: string,
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
    .eq('quote_number', quoteNumber);

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
