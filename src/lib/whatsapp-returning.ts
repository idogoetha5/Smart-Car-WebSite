/**
 * Returning customers: what SmartCar already knows about a WhatsApp number
 * from earlier rental requests and bookings, and how the bot uses it.
 *
 *   - "היי דני, טוב לראות אותך שוב 👋" instead of the welcome menu
 *   - the name and email from last time go straight into the summary
 *     (shown there to confirm or change, never asked again)
 *   - "כמו בפעם הקודמת" fills the places and the car type of the last request
 *   - "מה עם הבקשה ששלחתי?" gets the real status of the last request
 *
 * The data is read by phone number only (the same number the customer writes
 * from) and only the customer's own details are ever repeated to them; the
 * email is shown partly hidden.
 */

export type ReturningLocale = 'he' | 'en';

export interface PastRequest {
  pickupDate: string;
  dropoffDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  vehiclePreference?: string;
  status: string;
  createdAt: string;
}

export interface PastRental {
  vehicle?: string;
  pickupDate: string;
  dropoffDate: string;
  pickupLocation: string;
  dropoffLocation: string;
  status: string;
}

export interface PastCustomer {
  name?: string;
  email?: string;
  locale?: ReturningLocale;
  lastRequest?: PastRequest;
  lastRental?: PastRental;
}

const CAR: Record<string, { he: string; en: string }> = {
  ECONOMY_COMPACT: { he: 'רכב קטן וחסכוני', en: 'a small, economical car' },
  SEDAN: { he: 'רכב משפחתי', en: 'a family car' },
  SUV: { he: 'ג׳יפון', en: 'an SUV' },
  VAN: { he: 'רכב 7 מקומות', en: 'a 7-seater' },
  LUXURY: { he: 'רכב יוקרה', en: 'a luxury car' },
};

const day = (iso: string) => {
  const [, month, date] = iso.slice(0, 10).split('-');
  return `${date}/${month}`;
};

/** "dani@gmail.com" → "d***@gmail.com" */
export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return domain ? `${user.slice(0, 1)}***@${domain}` : email;
}

export function firstName(name?: string) {
  return name?.trim().split(/\s+/)[0] ?? '';
}

/** The greeting for someone who wrote to us before. */
export function returningGreeting(past: PastCustomer, locale: ReturningLocale) {
  const name = firstName(past.name);
  const last = past.lastRequest ?? past.lastRental;
  const car = past.lastRequest?.vehiclePreference ? CAR[past.lastRequest.vehiclePreference]?.[locale] : past.lastRental?.vehicle;
  if (locale === 'en') {
    const hint = last ? ` Same as last time${car ? ` (${car} from ${last.pickupLocation})` : ''}, or something new?` : '';
    return `Hi${name ? ` ${name}` : ''}, good to see you again 👋 How can I help this time?${hint}`;
  }
  const hint = last ? ` כמו בפעם הקודמת${car ? ` (${car} מ${last.pickupLocation})` : ''}, או משהו חדש?` : '';
  return `היי${name ? ` ${name}` : ''}, טוב לראות אותך שוב 👋 במה אפשר לעזור הפעם?${hint}`;
}

/** "כמו בפעם הקודמת", "אותו דבר כמו פעם שעברה", "same as last time" */
export const SAME_AS_LAST_TIME = /כמו (?:ב)?פעם (?:ה)?קודמת|כמו (?:ב)?פעם שעברה|כמו בפעם הקודמת|כמו שהיה (?:בפעם )?(?:הקודמת|שעברה)|אותו (?:דבר|רכב) כמו|כמו תמיד|same as (?:last time|before|usual)|like last time|the usual/i;

/** "מה עם הבקשה ששלחתי?", "did you get my request?" */
export const ASKS_ABOUT_REQUEST = /(?:מה (?:עם|קורה עם|המצב של|הסטטוס של)|איפה|קיבלתם את|יש עדכון (?:על|לגבי)|עדכון על)\s+(?:ה)?בקשה|הבקשה (?:ש|ה)?(?:לי|שלי|ששלחתי|שהשארתי)|שלחתי (?:לכם )?בקשה|(?:my|the) (?:rental )?request|did you get my request|any update on my request|status of my request/i;

/** The status of the customer's last request, in plain words. */
export function requestStatusReply(past: PastCustomer, locale: ReturningLocale): string | null {
  const request = past.lastRequest;
  if (!request) return null;
  const car = request.vehiclePreference ? CAR[request.vehiclePreference]?.[locale] : undefined;
  if (locale === 'en') {
    const what = `your request from ${day(request.createdAt)} (${day(request.pickupDate)}–${day(request.dropoffDate)}, ${request.pickupLocation}${car ? `, ${car}` : ''})`;
    switch (request.status) {
      case 'PENDING': return `I found ${what} — it’s with the team, and a representative will get back to you with an offer. Anything to add or change?`;
      case 'CONTACTED': return `I found ${what} — a representative has already been in touch. If you missed it, write "representative" and we’ll get back to you.`;
      case 'CONVERTED': return `I found ${what} — it became a booking 🎉 Anything else I can help with?`;
      default: return `I found ${what} — it’s closed. Want to open a new one? Just send the dates.`;
    }
  }
  const what = `את הבקשה ששלחת ב־${day(request.createdAt)} (${day(request.pickupDate)}–${day(request.dropoffDate)}, ${request.pickupLocation}${car ? `, ${car}` : ''})`;
  switch (request.status) {
    case 'PENDING': return `מצאתי ${what} — היא אצל הצוות, ונציג יחזור אליך עם הצעה. רוצה להוסיף או לשנות משהו?`;
    case 'CONTACTED': return `מצאתי ${what} — נציג כבר יצר איתך קשר. אם פספסת, תכתוב "נציג" ונחזור אליך.`;
    case 'CONVERTED': return `מצאתי ${what} — היא הפכה להזמנה 🎉 יש עוד משהו שאפשר לעזור בו?`;
    default: return `מצאתי ${what} — היא נסגרה. רוצה לפתוח בקשה חדשה? פשוט תשלח תאריכים.`;
  }
}

/** The line that tells a returning customer their details were filled in for them. */
export function filledDetailsLine(name: string, email: string | undefined, locale: ReturningLocale) {
  if (locale === 'en') return `I’ve put it under ${name}${email ? ` and the summary goes to ${maskEmail(email)}` : ''}, like last time 🙂 If anything changed, just write it.`;
  return `רשמתי על שם ${name}${email ? ` והסיכום יישלח ל־${maskEmail(email)}` : ''}, כמו בפעם הקודמת 🙂 אם משהו השתנה, פשוט תכתוב לי.`;
}
