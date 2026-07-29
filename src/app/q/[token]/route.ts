import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import {
  rentalQuotePdfPath,
  verifyRentalQuoteLinkToken,
} from '@/lib/quote-link';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * The customer-facing rental document link.
 *
 * The token is the entire authorisation: it is verified here, the PDF is read
 * from the private `quote-pdfs` bucket with the service role, and the bytes are
 * streamed straight back. The bucket itself is never made public and no row is
 * written anywhere — a link resolves to a storage path derived from the signed
 * quote number.
 */

function message(hebrew: string, english: string, status: number) {
  return new NextResponse(`${hebrew}\n${english}\n`, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
      // A stale or forged document link has nothing for a crawler.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit } = await checkRateLimit(
    `quote-link:${ip}`,
    60,
    60 * 60 * 1000
  );
  if (!withinLimit) {
    return message(
      'יותר מדי בקשות. נסו שוב בעוד כמה דקות.',
      'Too many requests. Please try again in a few minutes.',
      429
    );
  }

  const { token } = await context.params;
  const link = verifyRentalQuoteLinkToken(token);

  if (!link.valid) {
    if (link.reason === 'expired') {
      return message(
        'הקישור פג תוקף. נשמח לשלוח לכם מסמך מעודכן — 09-9509757.',
        'This link has expired. Contact us and we will send an updated document.',
        410
      );
    }
    return message(
      'הקישור אינו תקין. יש להשתמש בקישור שנשלח אליכם מ-SmartCar.',
      'This link is not valid. Please use the link SmartCar sent you.',
      404
    );
  }

  const isConfirmation = link.mode === 'confirmation';
  const asciiName = `${
    isConfirmation ? 'SmartCar_Booking_Confirmation' : 'SmartCar_Rental_Quote'
  }_${link.quoteNumber}.pdf`;
  const utf8Name = encodeURIComponent(
    `${isConfirmation ? 'אישור הזמנה SmartCar' : 'הצעת מחיר SmartCar'} ${link.quoteNumber}.pdf`
  );

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from('quote-pdfs')
      .download(rentalQuotePdfPath(link.quoteNumber!, link.slot));

    if (error || !data) {
      console.error(
        '[quote-link] PDF not available:',
        link.quoteNumber,
        error?.message
      );
      return message(
        'המסמך אינו זמין יותר. פנו אלינו ונשלח אותו מחדש — 09-9509757.',
        'This document is no longer available. Contact us and we will resend it.',
        404
      );
    }

    return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
      headers: {
        'Content-Type': 'application/pdf',
        // Opens in the browser's own viewer; the customer can still save it.
        'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (unexpected) {
    console.error('[quote-link] failed:', (unexpected as Error)?.message);
    return message(
      'לא ניתן לפתוח את המסמך כרגע. נסו שוב בעוד רגע.',
      'The document could not be opened right now. Please try again shortly.',
      500
    );
  }
}
