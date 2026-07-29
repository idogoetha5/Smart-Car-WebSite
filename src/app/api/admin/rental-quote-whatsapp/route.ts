import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import {
  createRentalQuoteLink,
  rentalQuoteLinkExpiry,
  rentalQuoteShortLink,
  rentalQuoteValidityIsExpired,
} from '@/lib/quote-link';
import {
  normalizeWhatsAppPhone,
  rentalQuoteWhatsAppMessage,
  type RentalQuoteData,
} from '@/lib/rental-quote';
import { renderRentalQuotePdf } from '@/lib/rental-quote-server';
import { validRentalQuoteData } from '@/lib/rental-quote-validation';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** The customer sees this host, so prefer the configured public domain. */
function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = (await request.json().catch(() => null)) as RentalQuoteData | null;
  if (!validRentalQuoteData(data)) {
    return NextResponse.json(
      { error: 'יש למלא לקוח, טלפון, תאריכים, מיקומים ולפחות רכב אחד' },
      { status: 400 }
    );
  }

  const phone = normalizeWhatsAppPhone(data.customerPhone);
  if (!phone) {
    return NextResponse.json({ error: 'מספר הטלפון אינו תקין ל-WhatsApp' }, { status: 400 });
  }

  // The link expires with the quotation, so a validity date that has already
  // passed would send the customer a document they cannot open. Refuse rather
  // than silently extend it — the date printed on the PDF has to be true.
  if (rentalQuoteValidityIsExpired(data.validUntil)) {
    return NextResponse.json(
      {
        error:
          'תאריך התוקף של ההצעה כבר עבר. יש לבחור תאריך תוקף עתידי לפני השליחה ללקוח.',
      },
      { status: 400 }
    );
  }

  try {
    const pdf = await renderRentalQuotePdf(data);

    // A branded /q/<token> link rather than a Supabase signed URL: the bucket
    // stays private, and what the customer receives reads as SmartCar instead
    // of a storage hostname with an access token attached. The link lives
    // exactly as long as the quotation it carries, and its slot decides where
    // this send's PDF is stored — so a six-digit number that comes round again
    // never overwrites an earlier customer's document.
    const expiresAt = rentalQuoteLinkExpiry(data.validUntil);
    const { token, storagePath } = createRentalQuoteLink(
      data.quoteNumber,
      data.documentMode,
      expiresAt
    );

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('quote-pdfs')
      .upload(storagePath, pdf, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });
    if (uploadError) throw uploadError;

    const link = rentalQuoteShortLink(publicOrigin(request), token);

    return NextResponse.json(
      {
        ok: true,
        documentUrl: link,
        expiresAt: new Date(expiresAt).toISOString(),
        whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(rentalQuoteWhatsAppMessage(data, link))}`,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[rental-quote-whatsapp] failed:', (error as Error)?.message);
    return NextResponse.json(
      { error: 'יצירת הקובץ או הקישור ל-WhatsApp נכשלה' },
      { status: 500 }
    );
  }
}
