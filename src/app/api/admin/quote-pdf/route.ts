import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import type { QuoteData } from '@/lib/quote-pdf';
import { archiveQuotePdf } from '@/lib/quote-history';
import { renderQuotePdf } from '@/lib/quote-pdf-server';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = (await request.json().catch(() => null)) as QuoteData | null;
  if (!data || !data.customerName || !data.vehicles?.length) {
    return NextResponse.json({ error: 'Missing quote data' }, { status: 400 });
  }

  try {
    const pdf = await renderQuotePdf(data);
    await archiveQuotePdf(data, pdf);

    // Content-Disposition header values must be ASCII (ByteString) — a
    // Hebrew customer name would otherwise throw at the header-set call.
    // Use a plain ASCII fallback name plus the RFC 5987 filename* form so
    // browsers still show the real (Unicode) name when they support it.
    const asciiName = (data.customerName || 'Client').replace(/[^\x20-\x7E]/g, '').trim().replace(/[\s/\\]/g, '_') || 'Client';
    const utf8Name = encodeURIComponent(`SmartCar_Quote_${data.customerName || 'Client'}.pdf`);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SmartCar_Quote_${asciiName}.pdf"; filename*=UTF-8''${utf8Name}`,
      },
    });
  } catch (err) {
    console.error('[quote-pdf] render error:', err);
    return NextResponse.json({ error: 'PDF generation or archive failed' }, { status: 500 });
  }
}
