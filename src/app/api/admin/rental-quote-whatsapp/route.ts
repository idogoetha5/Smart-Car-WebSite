import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import {
  normalizeWhatsAppPhone,
  type RentalQuoteData,
} from '@/lib/rental-quote';
import { renderRentalQuotePdf } from '@/lib/rental-quote-server';
import { validRentalQuoteData } from '@/lib/rental-quote-validation';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const LINK_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function safePathPart(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 100) || 'quote';
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
    const path = `rental/${safePathPart(data.quoteNumber)}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('quote-pdfs')
      .upload(path, pdf, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });
    if (uploadError) throw uploadError;

    const isConfirmation = data.documentMode === 'confirmation';
    const { data: signed, error: signedError } = await supabase.storage
      .from('quote-pdfs')
      .createSignedUrl(path, LINK_LIFETIME_SECONDS, {
        download: `${isConfirmation ? 'SmartCar_Booking_Confirmation' : 'SmartCar_Rental_Quote'}_${safePathPart(data.customerName)}.pdf`,
      });
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Missing signed URL');

    // The message names the document the customer is about to open — sending a
    // settled booking confirmation under the words "price quotation" reads as
    // if nothing was agreed yet.
    const message = data.locale === 'he'
      ? isConfirmation
        ? `שלום ${data.customerName}, מצורף אישור ההזמנה וסיכום העסקה מספר ${data.quoteNumber} מ-SmartCar.\n\nלצפייה ולהורדת ה-PDF:\n${signed.signedUrl}\n\nהקישור מאובטח וזמין למשך 7 ימים. נשמח לעמוד לרשותך לכל שאלה.`
        : `שלום ${data.customerName}, הכנו עבורך הצעת מחיר להשכרת רכב מספר ${data.quoteNumber} מ-SmartCar.\n\nלצפייה ולהורדת ה-PDF:\n${signed.signedUrl}\n\nהקישור מאובטח וזמין למשך 7 ימים. נשמח לעמוד לרשותך לכל שאלה.`
      : isConfirmation
        ? `Hello ${data.customerName}, your SmartCar booking confirmation and deal summary ${data.quoteNumber} is attached.\n\nView and download the PDF:\n${signed.signedUrl}\n\nThis secure link is available for 7 days. We will be happy to help with any questions.`
        : `Hello ${data.customerName}, your SmartCar rental quotation ${data.quoteNumber} is ready.\n\nView and download the PDF:\n${signed.signedUrl}\n\nThis secure link is available for 7 days. We will be happy to help with any questions.`;

    return NextResponse.json(
      { ok: true, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` },
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
