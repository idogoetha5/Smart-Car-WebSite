import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { verifyAdminToken } from '@/lib/admin-auth';
import { OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';
import { buildQuoteEmailContent } from '@/lib/quote-email';
import { quoteValidUntil, type QuoteData } from '@/lib/quote-pdf';
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

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\-_.]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Client';
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[quote-email] Resend is not configured');
    return NextResponse.json(
      { error: 'שירות שליחת הצעות המחיר עדיין לא הוגדר' },
      { status: 503 }
    );
  }

  try {
    const pdf = await renderQuotePdf(data);
    const filename = `SmartCar_Quote_${safeFilenamePart(data.customerName)}_${safeFilenamePart(data.quoteNumber)}.pdf`;
    const validUntil = quoteValidUntil(data);
    const content = buildQuoteEmailContent({
      customerName: data.customerName,
      quoteNumber: data.quoteNumber,
      validUntil,
      officePhone: OFFICE_PHONE,
      officeEmail: OFFICE_EMAIL,
    });
    const payloadDigest = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .slice(0, 32);
    const resend = new Resend(apiKey);
    const { data: sent, error } = await resend.emails.send(
      {
        from: `SmartCar <${OFFICE_EMAIL}>`,
        to: data.customerEmail.trim(),
        bcc: OFFICE_EMAIL,
        replyTo: OFFICE_EMAIL,
        subject: content.subject,
        html: content.html,
        text: content.text,
        attachments: [
          {
            content: pdf,
            filename,
            contentType: 'application/pdf',
          },
        ],
        tags: [
          { name: 'category', value: 'quote' },
        ],
      },
      {
        idempotencyKey: `quote-${safeFilenamePart(data.quoteNumber)}-${payloadDigest}`,
      }
    );

    if (error || !sent?.id) {
      console.error(
        '[quote-email] provider rejected send:',
        error?.name ?? 'missing_message_id',
        error?.message ?? ''
      );
      return NextResponse.json(
        { error: 'המייל לא נשלח. הצעת המחיר נשמרה ולא אבדה — אפשר לנסות שוב' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[quote-email] send failed:', (error as Error)?.message);
    return NextResponse.json(
      { error: 'יצירת הקובץ או שליחת המייל נכשלה. אפשר לנסות שוב' },
      { status: 500 }
    );
  }
}
