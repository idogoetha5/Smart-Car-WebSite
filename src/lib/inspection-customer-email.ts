import { Resend } from 'resend';
import { OFFICE_EMAIL } from '@/lib/constants';

/**
 * "Please review and sign" email to the customer after a pickup/return
 * inspection: a link to the walk-around video plus a link to the signing
 * form. Sent via Resend (same verified sender as the office email) so it
 * doesn't depend on a separate EmailJS template being configured. The
 * caller falls back to the EmailJS outbox if this fails.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface InspectionCustomerEmailParams {
  inspectionId: string;
  toEmail: string;
  customerName: string;
  vehicleName: string;
  typeLabel: string;
  signLink: string;
  videoLink: string;
  logoUrl: string;
}

export async function sendInspectionCustomerEmail(
  params: InspectionCustomerEmailParams
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'Resend is not configured' };

  const name = escapeHtml(params.customerName || '');
  const vehicle = escapeHtml(params.vehicleName || '');
  const typeLabel = escapeHtml(params.typeLabel);

  const html = `
  <div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;color:#0D2B2B;max-width:560px;margin:0 auto;">
    <div style="text-align:center;padding:16px 0;"><img src="${params.logoUrl}" alt="SmartCar" style="height:48px;"></div>
    <h2 style="margin:0 0 12px;">שלום ${name},</h2>
    <p style="font-size:16px;line-height:1.6;">
      בוצעה בדיקת ${typeLabel} עבור הרכב <strong>${vehicle}</strong>.
      צילמנו סרטון סיור סביב הרכב ובתוכו, כולל קילומטראז' ומד הדלק.
    </p>
    <p style="font-size:16px;line-height:1.6;">אנא צפו בסרטון ואשרו בחתימה על טופס הבדיקה:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${params.signLink}" style="display:inline-block;background:#E8743B;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:14px 28px;border-radius:10px;">צפייה בסרטון וחתימה על הטופס</a>
    </p>
    <p style="text-align:center;margin:0 0 24px;">
      <a href="${params.videoLink}" style="color:#2D5F5F;font-weight:700;">קישור ישיר לסרטון</a>
    </p>
    <p style="font-size:13px;color:#666;">הקישורים אישיים ותקפים ל-30 יום. לשאלות ניתן להשיב למייל זה.</p>
    <p style="font-size:13px;color:#666;">SmartCar — השכרת רכב</p>
  </div>`;

  const text = `שלום ${params.customerName},\nבוצעה בדיקת ${params.typeLabel} עבור הרכב ${params.vehicleName}.\nצפייה בסרטון וחתימה על הטופס: ${params.signLink}\nקישור ישיר לסרטון: ${params.videoLink}\nSmartCar`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: `SmartCar <${OFFICE_EMAIL}>`,
        to: params.toEmail,
        replyTo: OFFICE_EMAIL,
        subject: `SmartCar — בדיקת ${params.typeLabel}: צפייה בסרטון וחתימה`,
        html,
        text,
        tags: [{ name: 'category', value: 'vehicle-inspection-customer' }],
      },
      { idempotencyKey: `vehicle-inspection-customer-${params.inspectionId}` }
    );
    if (error) {
      const message = `${error.name}: ${error.message}`;
      console.error('[inspection-customer-email] send failed for %s: %s', params.inspectionId, message);
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    console.error('[inspection-customer-email] send threw for %s: %s', params.inspectionId, message);
    return { ok: false, error: message };
  }
}
