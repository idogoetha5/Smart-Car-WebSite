import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sendQuoteEmail } from '@/lib/quote-email-server';
import { downloadArchivedQuotePdf, markQuoteSent } from '@/lib/quote-history';
import type { QuoteData } from '@/lib/quote-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('quote_number, quote_data, pdf_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: 'הצעת המחיר לא נמצאה' }, { status: 404 });
  }

  try {
    const pdf = await downloadArchivedQuotePdf(quote.pdf_path);
    const sent = await sendQuoteEmail(
      quote.quote_data as QuoteData,
      pdf,
      `resend-${Date.now()}`
    );
    try {
      await markQuoteSent(quote.quote_number, sent.id);
    } catch (statusError) {
      // The email has already been accepted by the provider. Returning an
      // error here would encourage an accidental duplicate send.
      console.error('[quotes] resend status was not saved:', (statusError as Error)?.message);
    }
    return NextResponse.json({ ok: true });
  } catch (sendError) {
    console.error('[quotes] resend failed:', (sendError as Error)?.message);
    return NextResponse.json({ error: 'שליחת ההצעה נכשלה, נסה שוב' }, { status: 500 });
  }
}
