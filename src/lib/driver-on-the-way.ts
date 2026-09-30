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
  const me = params.driverName?.trim() ? `כאן ${params.driverName.trim()}, הנהג של SmartCar.` : 'כאן הנהג של SmartCar.';
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
