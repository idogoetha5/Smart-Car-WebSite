import { OFFICE_EMAIL } from '@/lib/constants';
import { createHash } from 'node:crypto';

export type BotIncident = 'processing_failed' | 'delivery_failed' | 'handoff_alert_failed' | 'settings_unavailable' | 'ai_unavailable' | 'ai_recovered' | 'test';
const LABELS: Record<BotIncident, string> = {
  processing_failed: 'תקלה בעיבוד הודעת WhatsApp',
  delivery_failed: 'שליחת תשובת הבוט לספק WhatsApp לא אושרה',
  handoff_alert_failed: 'התרעת המעבר לנציג לא נשלחה ב־SMS',
  settings_unavailable: 'לא ניתן לבדוק אם המענה האוטומטי מופעל',
  ai_unavailable: 'Gemini לא זמין — הבוט עבר למענה הגיבוי',
  ai_recovered: 'Gemini חזר לענות לאחר תקלה',
  test: 'בדיקת מנגנון התרעות — אין תקלה אמיתית',
};

/** Independent of the conversation DB. No customer text, keys or raw errors.
 * Provider idempotency deduplicates identical incident classes for 15 minutes,
 * across server instances. A full hosting outage still needs external monitoring.
 */
export async function reportBotIncident(kind: BotIncident): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.WHATSAPP_INCIDENT_EMAIL;
  if (!apiKey || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error('[whatsapp][incident] notification configuration missing');
    return false;
  }
  const bucket = Math.floor(Date.now() / 900000);
  const guidance = kind === 'test'
    ? 'זו בדיקה יזומה של התרעת המייל, ללא תקלה אמיתית. יש לוודא שההודעה התקבלה בתיבה; קבלת ההודעה אינה בדיקה של יתר רכיבי הבוט.'
    : kind === 'ai_recovered'
      ? 'התקבלה תשובה תקינה מהמודל בניסיון הבא. אין בכך אישור שכל רכיבי המערכת תקינים או שהודעות קודמות נמסרו.'
      : 'יש לבדוק את המערכת ואת השיחות הממתינות. אין בהודעה זו אישור שהתקלה תוקנה.';
  // Body must remain identical for the idempotency key, including across workers.
  const body = JSON.stringify({ from: `SmartCar <${OFFICE_EMAIL}>`, to: [to],
    subject: `[SmartCar] ${LABELS[kind]}`,
    text: `${LABELS[kind]}\nקוד: ${kind}\nחלון האירוע: ${new Date(bucket * 900000).toISOString()}\n${guidance}\nhttps://www.smartcar.co.il/he/admin/inbox\nהודעה זו אינה כוללת תוכן שיחות או פרטי לקוחות.`,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `smartcar-bot/${kind}/${bucket}` },
        body, signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const result = await response.json().catch(() => null) as { id?: string } | null;
        return Boolean(result?.id);
      }
      if (response.status !== 429 && response.status < 500) break;
    } catch { /* Same idempotency key makes an ambiguous email retry safe. */ }
  }
  console.error(`[whatsapp][incident] email notification failed: ${kind}`);
  return false;
}

/** Existing approved operator inbox is the handoff fallback when SMS is unavailable. */
export async function sendHandoffEmail(messageId: string, customerPhone: string, test = false): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = [...new Set([process.env.WHATSAPP_ALERT_EMAIL, process.env.WHATSAPP_INCIDENT_EMAIL]
    .filter((address): address is string => Boolean(address && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))))];
  if (!apiKey || recipients.length === 0) return false;
  const key = createHash('sha256').update(messageId).digest('hex').slice(0, 32);
  const body = JSON.stringify({
    from: `SmartCar <${OFFICE_EMAIL}>`, to: recipients,
    subject: test ? '[SmartCar] בדיקת התרעת נציג — אין פנייה אמיתית' : '[SmartCar] שיחת WhatsApp ממתינה לנציג',
    text: test ? 'זו בדיקת התרעת נציג בלבד. אין פנייה אמיתית ואין לקוח שצריך לחזור אליו.' : `נדרשת בדיקת נציג לשיחת WhatsApp. סיומת מספר הלקוח: ${customerPhone.slice(-4)}.\nפתחו את תיבת השיחות: https://www.smartcar.co.il/he/admin/inbox\nתוכן השיחה אינו נשלח במייל.`,
  });
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `smartcar-handoff/${key}` },
      body, signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.error(`[whatsapp][handoff-email] provider rejected test or alert: ${response.status}`);
      return false;
    }
    const result = await response.json().catch(() => null) as { id?: string } | null;
    return Boolean(result?.id);
  } catch { return false; }
}
