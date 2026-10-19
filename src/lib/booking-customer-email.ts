import { Resend } from 'resend';
import { OFFICE_EMAIL } from '@/lib/constants';
import { createAdminClient } from '@/lib/supabase/server';

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

export interface BookingCustomerEmailRetryResult {
  swept: number;
  delivered: number;
  dead: number;
  pending: number;
}

const MAX_SEND_ATTEMPTS = 3;
const SEND_BACKOFF_MS = [400, 1200];
const MAX_OUTBOX_ATTEMPTS = 5;
const MAX_OUTBOX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recordDelivery(params: { idempotencyKey: string; kind: BookingCustomerEmailParams['kind']; ok: boolean; attempts: number; status: number | null }) {
  try {
    await createAdminClient().from('email_deliveries').upsert({
      idempotency_key: params.idempotencyKey,
      event: params.kind === 'confirmed' ? 'booking_confirmed' : 'booking_request_received',
      template_id: 'resend_customer_booking',
      delivered: params.ok,
      attempts: params.attempts,
      last_status: params.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'idempotency_key' });
  } catch (error) {
    console.error('[booking-email] delivery record failed:', (error as Error).message);
  }
}

async function enqueueRetry(params: BookingCustomerEmailParams) {
  try {
    await createAdminClient().from('booking_customer_email_outbox').upsert({
      idempotency_key: params.idempotencyKey,
      kind: params.kind,
      payload: params,
      status: 'pending',
      next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  } catch (error) {
    console.error('[booking-email] retry queue failed:', (error as Error).message);
  }
}

async function resolveRetry(idempotencyKey: string) {
  try {
    await createAdminClient().from('booking_customer_email_outbox').delete().eq('idempotency_key', idempotencyKey);
  } catch (error) {
    console.error('[booking-email] retry resolution failed:', (error as Error).message);
  }
}

/** A separate office alert makes a customer-email failure visible without exposing customer PII. */
async function alertOfficeOfPermanentFailure(params: { idempotencyKey: string; kind: BookingCustomerEmailParams['kind'] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[booking-email][ALERT] customer email permanently undelivered and Resend is unavailable (ref %s)', params.idempotencyKey);
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const label = params.kind === 'confirmed' ? 'אישור הזמנה' : 'קבלת בקשת הזמנה';
    const { error } = await resend.emails.send({
      from: `SmartCar <${OFFICE_EMAIL}>`,
      to: OFFICE_EMAIL,
      replyTo: OFFICE_EMAIL,
      subject: 'SmartCar — נדרשת בדיקה: מייל ללקוח לא נשלח',
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;color:#0D2B2B;"><h2>נדרשת בדיקה ידנית</h2><p>מייל לקוח מסוג <strong>${label}</strong> לא נשלח גם לאחר ניסיונות חוזרים במשך עד שבוע.</p><p>מזהה פנימי: <strong dir="ltr">${escapeHtml(params.idempotencyKey)}</strong></p><p>נא לפתוח את ההזמנה בפאנל וליצור קשר עם הלקוח ידנית.</p></div>`,
      text: `נדרשת בדיקה ידנית: מייל לקוח מסוג ${label} לא נשלח לאחר ניסיונות חוזרים. מזהה פנימי: ${params.idempotencyKey}. נא לפתוח את ההזמנה בפאנל וליצור קשר עם הלקוח ידנית.`,
      tags: [{ name: 'category', value: 'booking-email-alert' }],
    });
    if (error) console.error('[booking-email][ALERT] office alert failed:', error.message);
  } catch (error) {
    console.error('[booking-email][ALERT] office alert failed:', (error as Error).message);
  }
}

function englishRow(
  label: string,
  value: string,
  valueDirection: 'ltr' | 'rtl' = 'ltr',
): string {
  return `<tr>
    <td width="38%" style="padding:11px 0;color:#5B6B6B;font-size:14px;text-align:left;vertical-align:top;">${escapeHtml(label)}</td>
    <td width="62%" style="padding:11px 0;text-align:right;font-weight:700;font-size:15px;color:#0D2B2B;vertical-align:top;">
      <bdi dir="${valueDirection}" style="unicode-bidi:isolate;">${escapeHtml(value)}</bdi>
    </td>
  </tr>`;
}

/** Hebrew gets a deliberately single-column summary: bilingual values never fight in two columns. */
function hebrewRow(label: string, values: Array<{ text: string; direction: 'ltr' | 'rtl' }>): string {
  const valueLines = values.map(({ text, direction }) => `<div dir="${direction}" style="unicode-bidi:isolate;margin-top:4px;font-weight:700;font-size:17px;line-height:1.35;color:#0D2B2B;text-align:right;">${escapeHtml(text)}</div>`).join('');
  return `<tr><td style="padding:13px 0;border-bottom:1px solid #E2ECEC;text-align:right;"><div style="color:#6B7B7B;font-size:13px;font-weight:700;">${escapeHtml(label)}</div>${valueLines}</td></tr>`;
}

/** Sends a polished booking message in the exact language used for the booking. */
export async function sendBookingCustomerEmail(
  params: BookingCustomerEmailParams
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await enqueueRetry(params);
    return { ok: false, error: 'Resend is not configured' };
  }

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
  const rows = english
    ? [
      englishRow('Booking number', `#${params.orderId}`),
      englishRow('Vehicle', params.vehicleName),
      englishRow('Pickup', `${params.startDate} · ${params.pickupLocation}`),
      englishRow('Return', `${params.endDate} · ${params.returnLocation}`),
      englishRow('Estimated total', params.totalPrice),
      ...(params.extras ? [englishRow('Extras', params.extras)] : []),
      ...(!request && params.downPayment ? [englishRow('Deposit due', params.downPayment)] : []),
    ].join('')
    : [
      hebrewRow('מספר הזמנה', [{ text: `#${params.orderId}`, direction: 'ltr' }]),
      hebrewRow('רכב', [{ text: params.vehicleName, direction: 'ltr' }]),
      hebrewRow('איסוף', [
        { text: params.startDate, direction: 'rtl' },
        { text: params.pickupLocation, direction: 'ltr' },
      ]),
      hebrewRow('החזרה', [
        { text: params.endDate, direction: 'rtl' },
        { text: params.returnLocation, direction: 'ltr' },
      ]),
      hebrewRow('מחיר משוער כולל', [{ text: params.totalPrice, direction: 'ltr' }]),
      ...(params.extras ? [hebrewRow('תוספות', [{ text: params.extras, direction: 'rtl' }])] : []),
      ...(!request && params.downPayment ? [hebrewRow('מקדמה לתשלום', [{ text: params.downPayment, direction: 'ltr' }])] : []),
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

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    const resend = new Resend(apiKey);
    try {
      const { error } = await resend.emails.send({
        from: `SmartCar <${OFFICE_EMAIL}>`,
        to: params.toEmail,
        replyTo: OFFICE_EMAIL,
        subject,
        html,
        text: `${heading}\n\n${english ? 'Hello' : 'שלום'} ${params.customerName},\n${intro}\n\n${english ? 'Booking number' : 'מספר הזמנה'}: #${params.orderId}\n${english ? 'Vehicle' : 'רכב'}: ${params.vehicleName}\n${english ? 'Pickup' : 'איסוף'}: ${params.startDate}, ${params.pickupLocation}\n${english ? 'Return' : 'החזרה'}: ${params.endDate}, ${params.returnLocation}\n${english ? 'Estimated total' : 'סה״כ משוער'}: ${params.totalPrice}\n\nSmartCar · 09-9509757`,
        tags: [{ name: 'category', value: `booking-${params.kind}` }],
      }, { idempotencyKey: params.idempotencyKey });
      if (!error) {
        await recordDelivery({ idempotencyKey: params.idempotencyKey, kind: params.kind, ok: true, attempts: attempt, status: 200 });
        await resolveRetry(params.idempotencyKey);
        return { ok: true };
      }
      lastError = `${error.name}: ${error.message}`;
    } catch (error) {
      lastError = (error as Error).message;
    }
    if (attempt < MAX_SEND_ATTEMPTS) await sleep(SEND_BACKOFF_MS[attempt - 1] ?? 1200);
  }

  await recordDelivery({ idempotencyKey: params.idempotencyKey, kind: params.kind, ok: false, attempts: MAX_SEND_ATTEMPTS, status: null });
  await enqueueRetry(params);
  return { ok: false, error: lastError ?? 'Unable to send customer email' };
}

/** Invoked by the daily cron: retries failed Resend booking emails, then alerts the office if they cannot be delivered. */
export async function retryPendingBookingCustomerEmails(): Promise<BookingCustomerEmailRetryResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('booking_customer_email_outbox')
    .select('idempotency_key, kind, payload, attempts, created_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(20);
  if (error) throw new Error(`booking customer email retry read failed: ${error.message}`);

  let delivered = 0;
  let dead = 0;
  let pending = 0;
  for (const row of data ?? []) {
    const payload = row.payload as BookingCustomerEmailParams;
    const result = await sendBookingCustomerEmail(payload);
    if (result.ok) { delivered++; continue; }

    const attempts = Number(row.attempts) + 1;
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    if (attempts >= MAX_OUTBOX_ATTEMPTS || ageMs >= MAX_OUTBOX_AGE_MS) {
      dead++;
      await supabase.from('booking_customer_email_outbox').update({ status: 'dead', attempts, updated_at: new Date().toISOString() }).eq('idempotency_key', row.idempotency_key);
      await alertOfficeOfPermanentFailure({ idempotencyKey: row.idempotency_key, kind: row.kind as BookingCustomerEmailParams['kind'] });
      continue;
    }

    pending++;
    await supabase.from('booking_customer_email_outbox').update({
      attempts,
      next_attempt_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('idempotency_key', row.idempotency_key);
  }
  return { swept: data?.length ?? 0, delivered, dead, pending };
}
