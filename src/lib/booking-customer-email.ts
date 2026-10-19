import { Resend } from 'resend';
import { OFFICE_EMAIL } from '@/lib/constants';

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface BookingCustomerEmailParams {
  kind: 'request_received' | 'confirmed';
  idempotencyKey: string;
  locale: 'he' | 'en';
  toEmail: string;
  customerName: string;
  orderId: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  returnLocation: string;
  totalPrice: string;
  extras?: string;
  downPayment?: string;
  paymentLink?: string;
}

function row(
  label: string,
  value: string,
  options: { english: boolean; valueDirection?: 'ltr' | 'rtl' },
): string {
  const labelAlign = options.english ? 'left' : 'right';
  const valueAlign = options.english ? 'right' : 'left';
  const valueDirection = options.valueDirection ?? (options.english ? 'ltr' : 'rtl');
  return `<tr>
    <td width="38%" style="padding:11px 0;color:#5B6B6B;font-size:14px;text-align:${labelAlign};vertical-align:top;">${escapeHtml(label)}</td>
    <td width="62%" style="padding:11px 0;text-align:${valueAlign};font-weight:700;font-size:15px;color:#0D2B2B;vertical-align:top;">
      <bdi dir="${valueDirection}" style="unicode-bidi:isolate;">${escapeHtml(value)}</bdi>
    </td>
  </tr>`;
}

/** Sends a polished booking message in the exact language used for the booking. */
export async function sendBookingCustomerEmail(
  params: BookingCustomerEmailParams
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'Resend is not configured' };

  const english = params.locale === 'en';
  const request = params.kind === 'request_received';
  const heading = request
    ? (english ? 'We received your request' : 'קיבלנו את הבקשה שלך')
    : (english ? 'Your booking is confirmed' : 'ההזמנה שלך אושרה');
  const intro = request
    ? (english
      ? 'Thank you for choosing SmartCar. Our team is reviewing your request and will contact you shortly to complete the rental process.'
      : 'תודה שבחרת ב-SmartCar. הצוות שלנו עובר על הבקשה שלך וייצור איתך קשר בקרוב כדי להשלים את תהליך ההשכרה.')
    : (english
      ? 'Great news — your booking has been confirmed. We look forward to welcoming you to SmartCar.'
      : 'בשורות טובות — ההזמנה שלך אושרה. אנחנו מחכים לקבל את פניך ב-SmartCar.');
  const rowOptions = { english };
  const rows = [
    row(english ? 'Booking number' : 'מספר הזמנה', `#${params.orderId}`, { ...rowOptions, valueDirection: 'ltr' }),
    row(english ? 'Vehicle' : 'רכב', params.vehicleName, { ...rowOptions, valueDirection: 'ltr' }),
    row(english ? 'Pickup' : 'איסוף', `${params.startDate} · ${params.pickupLocation}`, rowOptions),
    row(english ? 'Return' : 'החזרה', `${params.endDate} · ${params.returnLocation}`, rowOptions),
    row(english ? 'Estimated total' : 'מחיר משוער כולל', params.totalPrice, { ...rowOptions, valueDirection: 'ltr' }),
    ...(params.extras ? [row(english ? 'Extras' : 'תוספות', params.extras, rowOptions)] : []),
    ...(!request && params.downPayment ? [row(english ? 'Deposit due' : 'מקדמה לתשלום', params.downPayment, { ...rowOptions, valueDirection: 'ltr' })] : []),
  ].join('');
  const notice = request
    ? (english
      ? 'This email confirms that we received your request. The vehicle is reserved only after a written confirmation from SmartCar.'
      : 'מייל זה מאשר שקיבלנו את הבקשה. הרכב ישוריין רק לאחר אישור בכתב מצוות SmartCar.')
    : (english
      ? 'To arrange your deposit, simply reply to this email or contact us on WhatsApp.'
      : 'לתיאום המקדמה אפשר פשוט להשיב למייל הזה או ליצור איתנו קשר ב-WhatsApp.');
  const cta = !request && params.paymentLink
    ? `<p style="text-align:center;margin:26px 0 8px;"><a href="${escapeHtml(params.paymentLink)}" style="display:inline-block;background:#E8743B;color:#FFFFFF;text-decoration:none;font-weight:700;padding:14px 25px;border-radius:10px;">${english ? 'Continue your booking & arrange the deposit on WhatsApp' : 'להמשך ההזמנה ותשלום המקדמה ב-WhatsApp'}</a></p>`
    : '';
  const direction = english ? 'ltr' : 'rtl';
  const align = english ? 'left' : 'right';
  const greeting = english ? `Hello ${escapeHtml(params.customerName)},` : `שלום ${escapeHtml(params.customerName)},`;
  const html = `
    <div dir="${direction}" style="font-family:Arial,Helvetica,sans-serif;background:#F4F7F7;padding:28px 14px;color:#0D2B2B;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DCE7E7;">
        <div style="padding:25px 32px 17px;text-align:center;border-bottom:4px solid #E8743B;"><img src="${LOGO_URL}" alt="SmartCar" style="width:154px;height:auto;display:inline-block;"></div>
        <div style="padding:30px 32px;text-align:${align};">
          <h1 style="font-size:25px;line-height:1.2;margin:0 0 14px;color:#0D2B2B;">${heading}</h1>
          <p style="font-size:16px;line-height:1.65;margin:0 0 11px;">${greeting}</p>
          <p style="font-size:16px;line-height:1.65;margin:0 0 21px;">${intro}</p>
          <table role="presentation" dir="${direction}" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #DCE7E7;border-bottom:1px solid #DCE7E7;">${rows}</table>
          ${cta}
          <div style="margin-top:24px;padding:14px 16px;background:#FFF7F1;border:1px solid #F2C7AC;border-radius:10px;font-size:13px;line-height:1.55;color:#5B4638;">${notice}</div>
          <p style="font-size:14px;line-height:1.6;margin:24px 0 0;color:#526363;">${english ? 'We are here for anything you need.' : 'אנחנו כאן לכל שאלה ונשמח לעזור לאורך כל הדרך.'}</p>
        </div>
        <div style="padding:17px 28px;background:#0D2B2B;color:#FFFFFF;text-align:center;font-size:13px;line-height:1.65;">SmartCar · 09-9509757 · <a href="mailto:${OFFICE_EMAIL}" style="color:#FFFFFF;">${OFFICE_EMAIL}</a><br><a href="https://www.smartcar.co.il" style="color:#FFFFFF;">www.smartcar.co.il</a></div>
      </div>
    </div>`;
  const subject = request
    ? (english ? `SmartCar — We received your request for ${params.vehicleName}` : `SmartCar — קיבלנו את בקשת ההשכרה שלך עבור ${params.vehicleName}`)
    : (english ? `SmartCar — Your booking is confirmed: ${params.vehicleName}` : `SmartCar — ההזמנה שלך אושרה: ${params.vehicleName}`);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `SmartCar <${OFFICE_EMAIL}>`,
      to: params.toEmail,
      replyTo: OFFICE_EMAIL,
      subject,
      html,
      text: `${heading}\n\n${english ? 'Hello' : 'שלום'} ${params.customerName},\n${intro}\n\n${english ? 'Booking number' : 'מספר הזמנה'}: #${params.orderId}\n${english ? 'Vehicle' : 'רכב'}: ${params.vehicleName}\n${english ? 'Pickup' : 'איסוף'}: ${params.startDate}, ${params.pickupLocation}\n${english ? 'Return' : 'החזרה'}: ${params.endDate}, ${params.returnLocation}\n${english ? 'Estimated total' : 'סה״כ משוער'}: ${params.totalPrice}\n\nSmartCar · 09-9509757`,
      tags: [{ name: 'category', value: `booking-${params.kind}` }],
    }, { idempotencyKey: params.idempotencyKey });
    if (error) return { ok: false, error: `${error.name}: ${error.message}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
