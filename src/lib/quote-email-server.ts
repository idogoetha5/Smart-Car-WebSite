import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';
import { logo_png } from '@/lib/quote-assets';
import { buildQuoteEmailContent } from '@/lib/quote-email';
import { quotePdfFilename, safeQuotePart } from '@/lib/quote-history';
import { quoteValidUntil, type QuoteData } from '@/lib/quote-pdf';

export async function sendQuoteEmail(
  data: QuoteData,
  pdf: Buffer,
  deliveryAttempt?: string
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Resend is not configured');
  }

  const content = buildQuoteEmailContent({
    customerName: data.customerName,
    quoteNumber: data.quoteNumber,
    validUntil: quoteValidUntil(data),
    officePhone: OFFICE_PHONE,
    officeEmail: OFFICE_EMAIL,
  });
  const payloadDigest = createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 32);
  const idempotencyKey = [
    'quote',
    safeQuotePart(data.quoteNumber),
    payloadDigest,
    deliveryAttempt ? safeQuotePart(deliveryAttempt) : null,
  ]
    .filter(Boolean)
    .join('-');
  const resend = new Resend(apiKey);
  const { data: sent, error } = await resend.emails.send(
    {
      from: `SmartCar <${OFFICE_EMAIL}>`,
      to: data.customerEmail.trim(),
      replyTo: OFFICE_EMAIL,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments: [
        {
          content: Buffer.from(logo_png, 'base64'),
          filename: 'smartcar-logo.png',
          contentType: 'image/png',
          contentId: 'smartcar-logo',
        },
        {
          content: pdf,
          filename: quotePdfFilename(data),
          contentType: 'application/pdf',
        },
      ],
      tags: [{ name: 'category', value: 'quote' }],
    },
    {
      idempotencyKey,
    }
  );

  if (error || !sent?.id) {
    throw new Error(
      `Resend rejected quote: ${error?.name ?? 'missing_message_id'} ${error?.message ?? ''}`.trim()
    );
  }

  return { id: sent.id };
}
