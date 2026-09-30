/**
 * "The driver is on the way" WhatsApp message — opened from the driver's
 * task card as a wa.me link with the text ready, so the driver only taps
 * send in WhatsApp.
 */

/** Israeli/intl phone → digits for wa.me (05x… → 9725x…). Returns '' if unusable. */
export function toWhatsAppNumber(phone: string | null | undefined): string {
  const raw = String(phone ?? '').trim();
  if (!raw) return '';
  let digits = raw.replace(/[^\d]/g, '');
  if (raw.startsWith('+')) return digits.length >= 8 ? digits : '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `972${digits.slice(1)}`;
  return digits.length >= 8 ? digits : '';
}

export function onTheWayMessage(params: {
  customerName: string;
  driverName?: string | null;
  vehicleName?: string | null;
  type: 'pickup' | 'return';
}): string {
  const first = params.customerName.trim().split(/\s+/)[0] || '';
  const hello = first ? `שלום ${first},` : 'שלום,';
  const me = params.driverName?.trim() ? `כאן ${params.driverName.trim()}, נציג SmartCar.` : 'כאן נציג SmartCar.';
  const car = params.vehicleName && params.vehicleName !== '—' ? ` ה${params.vehicleName}` : ' הרכב';

  const body =
    params.type === 'pickup'
      ? [
          `אני בדרך אליך עם${car} 🚗`,
          'צפי הגעה: עד 60 דקות.',
          '',
          'כדי שהמסירה תהיה מהירה ונוחה, נבקש להכין רישיון נהיגה בתוקף ותעודה מזהה.',
          'לכל שאלה או תיאום — אפשר להשיב כאן.',
        ]
      : [
          `אני בדרך לאסוף את${car} 🚗`,
          'צפי הגעה: עד 60 דקות.',
          '',
          'נבקש לוודא שהרכב זמין ולבדוק שלא נשארו בו חפצים אישיים.',
          'לכל שאלה או תיאום — אפשר להשיב כאן.',
        ];

  const closing =
    params.type === 'pickup'
      ? ['', 'נתראה בקרוב!', 'SmartCar — השכרת רכב עד הבית', 'www.smartcar.co.il']
      : ['', 'תודה שבחרת ב־SmartCar, נשמח לראותך שוב!', 'SmartCar — השכרת רכב עד הבית', 'www.smartcar.co.il'];

  return [hello, me, '', ...body, ...closing].join('\n');
}

export function onTheWayLink(phone: string | null | undefined, message: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

const SIGN_OFF = ['SmartCar — השכרת רכב עד הבית', 'www.smartcar.co.il'];

function greeting(customerName: string): string {
  const first = customerName.trim().split(/\s+/)[0] || '';
  return first ? `שלום ${first},` : 'שלום,';
}

/** "I've arrived" — sent when the representative is at the address. */
export function arrivedMessage(params: { customerName: string; driverName?: string | null; type: 'pickup' | 'return' }): string {
  const me = params.driverName?.trim() ? `כאן ${params.driverName.trim()}, נציג SmartCar.` : 'כאן נציג SmartCar.';
  const body =
    params.type === 'pickup'
      ? 'הגעתי לכתובת ואני ממתין לך עם הרכב 🚗\nנא להביא רישיון נהיגה ותעודה מזהה.'
      : 'הגעתי לכתובת לאיסוף הרכב 🚗\nאשמח שתצא/י אליי עם המפתחות.';
  return [greeting(params.customerName), me, '', body, '', 'תודה!', ...SIGN_OFF].join('\n');
}

/** After signing: thank-you with the link to the signed form. */
export function signedCopyMessage(params: { customerName: string; type: 'pickup' | 'return'; pdfUrl: string }): string {
  const what = params.type === 'pickup' ? 'מסירת הרכב' : 'החזרת הרכב';
  const extra =
    params.type === 'pickup'
      ? 'נסיעה טובה! לכל שאלה במהלך השכירות אנחנו זמינים כאן.'
      : 'תודה שבחרת ב־SmartCar, נשמח לראותך שוב!';
  return [
    greeting(params.customerName),
    `תודה על החתימה על טופס ${what} ✅`,
    '',
    'לצפייה בטופס החתום:',
    params.pdfUrl,
    '',
    extra,
    ...SIGN_OFF,
  ].join('\n');
}

/** Day-before reminder for a return pickup. */
export function returnReminderMessage(params: {
  customerName: string;
  dateLabel: string;
  time?: string | null;
  address?: string | null;
}): string {
  const when = `${params.dateLabel}${params.time ? ` בשעה ${params.time}` : ''}`;
  const where = params.address ? ` מ${params.address}` : '';
  return [
    greeting(params.customerName),
    'תזכורת מ־SmartCar 🚗',
    '',
    `מחר, ${when}, נגיע לאסוף את הרכב${where}.`,
    'נבקש לוודא שהרכב זמין, עם אותה כמות דלק כמו במסירה, ושלא נשארו בו חפצים אישיים.',
    'אם צריך לשנות את המועד — אפשר להשיב כאן.',
    '',
    'תודה!',
    ...SIGN_OFF,
  ].join('\n');
}
