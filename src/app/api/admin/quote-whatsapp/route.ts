import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { archiveQuotePdf } from '@/lib/quote-history';
import { createRentalQuoteLink, rentalQuoteLinkExpiry, rentalQuoteShortLink } from '@/lib/quote-link';
import { normalizeWhatsAppPhone } from '@/lib/rental-quote';
import type { QuoteData } from '@/lib/quote-pdf';
import { renderQuotePdf } from '@/lib/quote-pdf-server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

function publicOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
}

function validQuote(data: QuoteData | null): data is QuoteData {
  return Boolean(
    data?.id &&
      data.quoteNumber &&
      data.customerName?.trim() &&
      data.customerPhone?.trim() &&
      data.vehicles?.some((vehicle) => vehicle.name?.trim())
  );
}

function message(data: QuoteData, link: string): string {
  if (data.language === 'en') {
    return `Hello ${data.customerName.trim()},\nAttached is SmartCar leasing quotation no. ${data.quoteNumber}.\n${link}\n\nWe will be happy to answer any questions.\nSmartCar`;
  }
  return `שלום ${data.customerName.trim()},\nמצורפת הצעת ליסינג מס׳ ${data.quoteNumber} מבית SmartCar.\n${link}\n\nנשמח לעמוד לרשותך בכל שאלה.\nצוות SmartCar`;
}

/** Creates the exact leasing PDF and opens a branded customer link in WhatsApp. */
export async function POST(request: Request) {
  if (!(await requireManagerOrAdmin()).ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = (await request.json().catch(() => null)) as QuoteData | null;
  if (!validQuote(data)) {
    return NextResponse.json(
      { error: 'יש למלא שם לקוח, מספר WhatsApp ולפחות רכב אחד' },
      { status: 400 }
    );
  }
  const phone = normalizeWhatsAppPhone(data.customerPhone ?? '');
  if (!phone) {
    return NextResponse.json({ error: 'מספר הטלפון אינו תקין ל-WhatsApp' }, { status: 400 });
  }

  try {
    const pdf = await renderQuotePdf(data);
    await archiveQuotePdf(data, pdf);

    const expiresAt = rentalQuoteLinkExpiry(null);
    const { token, storagePath } = createRentalQuoteLink(
      data.quoteNumber,
      'leasing',
      expiresAt
    );
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from('quote-pdfs').upload(storagePath, pdf, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    });
    if (error) throw error;

    const documentUrl = rentalQuoteShortLink(publicOrigin(request), token);
    return NextResponse.json(
      {
        ok: true,
        documentUrl,
        whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message(data, documentUrl))}`,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[quote-whatsapp] failed:', (error as Error)?.message);
    return NextResponse.json(
      { error: 'יצירת הצעת הליסינג או קישור ה-WhatsApp נכשלה' },
      { status: 500 }
    );
  }
}
