import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { downloadArchivedQuotePdf, safeQuotePart } from '@/lib/quote-history';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
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
    .select('quote_number, customer_name, pdf_path')
    .eq('id', id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: 'הצעת המחיר לא נמצאה' }, { status: 404 });
  }

  try {
    const pdf = await downloadArchivedQuotePdf(quote.pdf_path);
    const url = new URL(request.url);
    const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
    const filename = `SmartCar_Quote_${safeQuotePart(quote.customer_name)}_${safeQuotePart(quote.quote_number)}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="SmartCar_Quote.pdf"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (downloadError) {
    console.error('[quotes] PDF read failed:', (downloadError as Error)?.message);
    return NextResponse.json({ error: 'לא ניתן לפתוח את קובץ ההצעה' }, { status: 500 });
  }
}
