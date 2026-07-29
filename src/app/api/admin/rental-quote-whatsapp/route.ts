import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import {
  createRentalQuoteLinkToken,
  rentalQuotePdfPath,
  rentalQuoteShortLink,
} from '@/lib/quote-link';
import {
  normalizeWhatsAppPhone,
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

function whatsappMessage(
  data: RentalQuoteData,
  link: string
): string {
  const isConfirmation = data.documentMode === 'confirmation';

  if (data.locale === 'he') {
    const documentName = isConfirmation
      ? 'אישור ההזמנה וסיכום העסקה'
      : 'הצעת המחיר';
    const action = isConfirmation
      ? 'לצפייה ולהורדת אישור ההזמנה:'
      : 'לצפייה ולהורדת הצעת המחיר:';
    return [
      `שלום ${data.customerName},`,
      '',
      `הכנו עבורך את ${documentName} מספר ${data.quoteNumber} להשכרת רכב מ־SmartCar.`,
      '',
      action,
      link,
      '',
      'הקישור זמין למשך 7 ימים. נשמח לעמוד לרשותך לכל שאלה.',
    ].join('\n');
  }

  const documentName = isConfirmation
    ? 'booking confirmation and deal summary'
    : 'quotation';
  return [
    `Hello ${data.customerName},`,
    '',
    `We have prepared your car rental ${documentName} number ${data.quoteNumber} from SmartCar.`,
    '',
    `To view and download the ${isConfirmation ? 'booking confirmation' : 'quotation'}:`,
    link,
    '',
    'The link is available for 7 days. We will be happy to help with any questions.',
  ].join('\n');
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

  try {
    const pdf = await renderRentalQuotePdf(data);
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('quote-pdfs')
      .upload(rentalQuotePdfPath(data.quoteNumber), pdf, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });
    if (uploadError) throw uploadError;

    // A branded /q/<token> link rather than a Supabase signed URL: the bucket
    // stays private, and what the customer receives reads as SmartCar instead
    // of a storage hostname with an access token attached.
    const token = createRentalQuoteLinkToken(
      data.quoteNumber,
      data.documentMode
    );
    const link = rentalQuoteShortLink(publicOrigin(request), token);

    return NextResponse.json(
      {
        ok: true,
        documentUrl: link,
        whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(data, link))}`,
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
