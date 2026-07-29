import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { sendQuoteEmail } from '@/lib/quote-email-server';
import { archiveQuotePdf, markQuoteSent } from '@/lib/quote-history';
import type { QuoteData } from '@/lib/quote-pdf';
import { renderQuotePdf } from '@/lib/quote-pdf-server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validQuoteData(value: unknown): value is QuoteData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<QuoteData>;
  return Boolean(
    data.quoteNumber &&
    data.date &&
    data.customerName?.trim() &&
    data.customerEmail?.trim() &&
    EMAIL_PATTERN.test(data.customerEmail) &&
    Array.isArray(data.vehicles) &&
    data.vehicles.some((vehicle) => vehicle?.name?.trim())
  );
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = (await request.json().catch(() => null)) as unknown;
  if (!validQuoteData(data)) {
    return NextResponse.json(
      { error: 'יש למלא שם לקוח, כתובת מייל תקינה ולפחות רכב אחד לפני השליחה' },
      { status: 400 }
    );
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[quote-email] Resend is not configured');
    return NextResponse.json(
      { error: 'שירות שליחת הצעות המחיר עדיין לא הוגדר' },
      { status: 503 }
    );
  }

  try {
    const pdf = await renderQuotePdf(data);
    await archiveQuotePdf(data, pdf);
    const sent = await sendQuoteEmail(data, pdf);

    try {
      await markQuoteSent(data.quoteNumber, sent.id);
    } catch (statusError) {
      // The PDF and quote data were already archived before sending.
      // A status-write failure must not tell the admin that a delivered
      // customer email failed and invite an accidental duplicate.
      console.error('[quote-email] sent status was not saved:', (statusError as Error)?.message);
    }

    return NextResponse.json({ ok: true, quoteNumber: data.quoteNumber });
  } catch (error) {
    console.error('[quote-email] send failed:', (error as Error)?.message);
    return NextResponse.json(
      { error: 'שמירת ההצעה, יצירת הקובץ או שליחת המייל נכשלה. אפשר לנסות שוב' },
      { status: 500 }
    );
  }
}
