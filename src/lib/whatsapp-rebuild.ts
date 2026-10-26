import { OFFICE_PHONE } from '@/lib/constants';
import { randomUUID } from 'node:crypto';
import { termsConsent } from '@/lib/consent';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { readBotTurn, type BotReading, type GeminiBotContext, type VehicleDirection } from '@/lib/whatsapp-rebuild-gemini';

type Locale = 'he' | 'en';
type Phase = 'explore' | 'booking' | 'service';
type BookingKey = 'pickupDate' | 'returnDate' | 'pickupLocation' | 'returnLocation' | 'vehicleNeed' | 'driverAgeRange' | 'customerName' | 'customerEmail';
type BookingDraft = Partial<Record<BookingKey, string>> & { passengers?: number; luggage?: number; childSeats?: number; datePreference?: string };
type HistoryEntry = { from: 'customer' | 'bot'; text: string; private?: boolean };

export type RebuildState = {
  version: 2;
  phase: Phase;
  step: 'menu' | 'rental_dates' | 'rental_locations' | 'rental_vehicle' | 'rental_age' | 'rental_name' | 'rental_email' | 'rental_confirm';
  locale: Locale;
  booking: BookingDraft;
  requestKey?: string;
  history: HistoryEntry[];
  interest?: 'leasing' | 'sale';
  safetyAlertAt?: string;
  handedOff?: boolean;
  handoffAt?: string;
  handoffKind?: 'safety' | 'booking_change' | 'service_issue' | 'commercial' | 'human';
  completedRequestId?: string;
};

export type RebuildResult = { reply: string; state: RebuildState; escalate?: boolean; source: 'gemini' | 'local' | 'safety'; model?: string };
export type RebuildStore = {
  isSimulation?: boolean;
  loadState(phone: string): Promise<RebuildState | null>;
  saveState(phone: string, state: RebuildState): Promise<void>;
  activeBooking(phone: string): Promise<{ id: string; status: string; pickup_date: string; dropoff_date: string; pickup_location: string; dropoff_location: string } | null>;
  createRentalRequest(phone: string, state: RebuildState): Promise<string | null>;
  readTurn?: typeof readBotTurn;
};

const ORDER: BookingKey[] = ['pickupDate', 'returnDate', 'pickupLocation', 'returnLocation', 'vehicleNeed', 'driverAgeRange', 'customerName', 'customerEmail'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OUTSIDE = /מוני(?:ת|ות)|אוטובוס|רכבת|תחבורה ציבורית|אוויס|אלדן|סיקסט|הרץ|מתחר|חברת השכרה אחרת|\btaxi\b|\bbus\b|\btrain\b|\buber\b|\bavis\b|\bhertz\b|\bsixt\b|competitor|another rental company/i;
const UNSAFE_CLAIM = /(?:יש לנו|יש אצלנו|זמין עכשיו|זמין בדיוק|פנוי עכשיו|מובטח|בטוח ש|בהחלט ייכנס|בהחלט יתאים|יתאים לכם מצוין|מזווד.{0,25}(?:ייכנס|יספיק)|(?:חיסכון|חסכון) בדלק|צריכת דלק.{0,25}(?:מעולה|נמוכה|טובה|חסכונית)|we have available|available for (?:your|the) (?:trip|dates)|guaranteed|(?:definitely|easily) fits?|fits? (?:your|two|three|the) (?:bags|suitcases|luggage)|great fuel efficiency|fuel savings|confirmed booking)/i;
const INTERNAL_VOICE = /המחיר באתר|באתר (?:הוא|מופיע)|אין לי (?:גישה|אישור|מלאי|אפשרות)|לא אישרתי|לא פתרתי|בשיחה הזו|כיוון לבדיקה|הצוות צריך לבדוק|נשמר.{0,25}(?:לטיפול|לנציג)|תהליך פנימי|בדיקה פנימית|המודל|סימולציה|website price|on the website|I (?:do not|don't) have (?:access|approval|inventory)|I have not (?:confirmed|resolved)|internal (?:check|process|system)|simulation|backend/i;
const VOLUNTEERED_IDENTITY = /אני (?:בוט|רובוט|עוזר דיגיטלי|בינה מלאכותית)|אני לא (?:בן אדם|אדם)|I am (?:a bot|an AI|a digital assistant)|I'm (?:a bot|an AI|a digital assistant)/i;
const PRICE_OR_AVAILABILITY = /מחיר|עלות|כמה.{0,12}(?:עול|יעל)|(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:price|cost|rate|available|availability)\b/iu;
const AVAILABILITY_ONLY = /(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:available|availability|in stock)\b/iu;
const MONTHS: Record<string, number> = { ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12, january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const EXPLICIT_RANGE = new RegExp(`(\\d{1,2})\\s*(?:עד|[-–]|to|until)\\s*(\\d{1,2})\\s+(?:ב)?(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?`, 'iu');

function priceAnswer(locale: Locale): string {
  return locale === 'he'
    ? 'בשמחה. המחיר המדויק תלוי בתאריכים, בסוג הרכב ובתוספות שתבחרו. נשמח להכין לכם הצעה אישית.'
    : 'Gladly. The exact price depends on your dates, vehicle type and chosen extras. We will be happy to prepare a personal offer.';
}

function availabilityAnswer(locale: Locale): string {
  return locale === 'he'
    ? 'נשמח לבדוק זמינות לתאריכים המבוקשים ולהציע רכב מתאים. באילו תאריכים תצטרכו אותו?'
    : 'We will be happy to check availability for your dates and suggest a suitable car. What dates do you need it?';
}

function language(input: string, previous: Locale): Locale {
  if (/עברית|hebrew/i.test(input)) return 'he';
  if (/english|אנגלית/i.test(input)) return 'en';
  if (EMAIL.test(input.trim()) || /(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}/.test(input)) return previous;
  return /[א-ת]/.test(input) ? 'he' : /[a-z]{3,}/i.test(input) ? 'en' : previous;
}

function fresh(locale: Locale): RebuildState {
  return { version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] };
}

function nextMissing(draft: BookingDraft): BookingKey | null {
  return ORDER.find(key => !draft[key]) ?? null;
}

function bookingStep(missing: BookingKey | null): RebuildState['step'] {
  if (!missing) return 'rental_confirm';
  if (missing === 'pickupDate' || missing === 'returnDate') return 'rental_dates';
  if (missing === 'pickupLocation' || missing === 'returnLocation') return 'rental_locations';
  if (missing === 'vehicleNeed') return 'rental_vehicle';
  if (missing === 'driverAgeRange') return 'rental_age';
  if (missing === 'customerName') return 'rental_name';
  return 'rental_email';
}

function question(key: BookingKey, locale: Locale): string {
  const he: Record<BookingKey, string> = {
    pickupDate: 'באיזה תאריך תרצו לאסוף את הרכב?', returnDate: 'באיזה תאריך תחזירו את הרכב?',
    pickupLocation: 'מאיפה תרצו לאסוף את הרכב?', returnLocation: 'איפה תרצו להחזיר אותו?',
    vehicleNeed: 'איזה סוג רכב תרצו, או כמה נוסעים וציוד יהיו?', driverAgeRange: 'מה קבוצת הגיל של הנהג? בחרו 21–23 או 24+ (גיל 24 שייך ל־24+).', customerName: 'על איזה שם לרשום את הבקשה?',
    customerEmail: 'לאיזו כתובת מייל לשלוח את סיכום הבקשה?',
  };
  const en: Record<BookingKey, string> = {
    pickupDate: 'What date would you like to pick up the car?', returnDate: 'What date will you return it?',
    pickupLocation: 'Where would you like to pick it up?', returnLocation: 'Where will you return it?',
    vehicleNeed: 'What kind of car do you need, or how many passengers and bags?', driverAgeRange: 'What is the driver age group: 21–23 or 24+? Age 24 belongs to 24+.', customerName: 'What name should I put on the request?',
    customerEmail: 'What email address should receive the request summary?',
  };
  return (locale === 'he' ? he : en)[key];
}

function israelDate(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); }
function validDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function explicitDateRange(input: string): { pickupDate: string; returnDate: string } | null {
  const numeric = input.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\s*[-–־]\s*(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?(?=\s|$|[,.!?])/u);
  if (numeric) {
    const today = israelDate();
    let year = Number(numeric[3] ?? today.slice(0, 4));
    const asDate = (day: string, month: string, valueYear: number) => `${valueYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    let pickupDate = asDate(numeric[1], numeric[2], year);
    if (!numeric[3] && pickupDate < today) { year += 1; pickupDate = asDate(numeric[1], numeric[2], year); }
    let returnDate = asDate(numeric[4], numeric[5], Number(numeric[6] ?? year));
    if (!numeric[6] && returnDate <= pickupDate && Number(numeric[5]) < Number(numeric[2])) returnDate = asDate(numeric[4], numeric[5], year + 1);
    const latest = new Date(`${today}T00:00:00Z`);
    latest.setUTCFullYear(latest.getUTCFullYear() + 2);
    if (validDate(pickupDate) && validDate(returnDate) && pickupDate >= today && returnDate > pickupDate && returnDate <= latest.toISOString().slice(0, 10)) return { pickupDate, returnDate };
  }
  const match = input.match(EXPLICIT_RANGE);
  if (!match) return null;
  const month = MONTHS[match[3].toLocaleLowerCase()];
  const today = israelDate();
  let year = match[4] ? Number(match[4]) : Number(today.slice(0, 4));
  const date = (day: string) => `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
  let pickupDate = date(match[1]);
  let returnDate = date(match[2]);
  if (!match[4] && pickupDate < today) { year += 1; pickupDate = date(match[1]); returnDate = date(match[2]); }
  const latest = new Date(`${today}T00:00:00Z`);
  latest.setUTCFullYear(latest.getUTCFullYear() + 2);
  return validDate(pickupDate) && validDate(returnDate) && pickupDate >= today && returnDate > pickupDate && returnDate <= latest.toISOString().slice(0, 10)
    ? { pickupDate, returnDate } : null;
}

function singleDateAnswer(input: string, after?: string): string | null {
  const value = input.trim();
  const today = israelDate();
  const reference = after ?? today;
  const relative = /^(?:היום|מחר|מחרתיים|today|tomorrow|day after tomorrow)$/i.test(value);
  if (relative) {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + (/מחרתיים|day after tomorrow/i.test(value) ? 2 : /מחר|tomorrow/i.test(value) ? 1 : 0));
    const result = date.toISOString().slice(0, 10);
    return result > reference || !after && result >= today ? result : null;
  }
  let candidate = value.match(/^(20\d{2})-(\d{2})-(\d{2})$/)?.[0] ?? null;
  if (!candidate) {
    const numeric = value.match(/^(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?$/);
    const named = value.match(new RegExp(`^(\\d{1,2})\\s+(?:ב)?(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?$`, 'iu'));
    const day = numeric?.[1] ?? named?.[1];
    const month = numeric ? Number(numeric[2]) : named ? MONTHS[named[2].toLocaleLowerCase()] : undefined;
    const year = numeric?.[3] ?? named?.[3];
    if (day && month && month >= 1 && month <= 12) {
      let numberYear = year ? Number(year) : Number(reference.slice(0, 4));
      candidate = `${numberYear}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (!year && candidate <= reference) {
        if (after && month === Number(after.slice(5, 7))) return null;
        numberYear += 1;
        candidate = `${numberYear}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }
  if (!candidate && after && /^\d{1,2}$/.test(value)) candidate = `${after.slice(0, 8)}${value.padStart(2, '0')}`;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCFullYear(limit.getUTCFullYear() + 2);
  return candidate && validDate(candidate) && candidate >= today && (!after || candidate > after) && candidate <= limit.toISOString().slice(0, 10) ? candidate : null;
}

function vagueDateAnswer(input: string): boolean {
  return /\b(?:next week|next month|in a week|in a month|about a week|about a month)\b|(?:מ|ב)?עוד\s+(?:כשבוע|כחודש|שבוע|חודש)|(?:ב|מ)שבוע הבא|(?:ב|מ)חודש הבא/iu.test(input)
    && !explicitDateRange(input) && !singleDateAnswer(input);
}

function applyPromptedDate(input: string, state: RebuildState, lastBot: string): void {
  if (/באיזה תאריך.{0,25}לאסוף|תאריך איסוף|what date.{0,25}pick.?up/i.test(lastBot) || asksRentalDates(lastBot) && !state.booking.pickupDate) {
    const date = singleDateAnswer(input);
    if (date) state.booking.pickupDate = date;
  } else if (/באיזה תאריך.{0,25}תחזיר|תאריך החזרה|what date.{0,25}return/i.test(lastBot)) {
    const date = singleDateAnswer(input, state.booking.pickupDate);
    if (date) state.booking.returnDate = date;
  }
}

function applyExplicitLocations(input: string, draft: BookingDraft): void {
  const stop = '(?=\\s+(?:ו?החזרה|להחזיר|(?:and\\s+)?return|(?:and\\s+)?drop.?off)|[,.!?]|$)';
  const hePickup = input.match(new RegExp(`(?:איסוף|לאסוף)\\s+[במ]([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const enPickup = input.match(new RegExp(`pick.?up\\s+(?:at|from|in)\\s+([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const pickup = (hePickup ?? enPickup)?.trim();
  if (pickup) draft.pickupLocation = pickup;
  const heReturn = input.match(/(?:החזרה|להחזיר)\s+[במ]([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=[,.!?]|$)/iu)?.[1];
  const enReturn = input.match(/(?:return|drop.?off)\s+(?:at|in|to)\s+([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=[,.!?]|$)/iu)?.[1];
  const returnLocation = (heReturn ?? enReturn)?.trim();
  if (returnLocation) draft.returnLocation = returnLocation;
  if (draft.pickupLocation && /אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input)) draft.returnLocation = draft.pickupLocation;
}

function explicitBooking(input: string): boolean {
  if (/לא רוצה להזמין|רק מתעניין|רק שואל|לא עכשיו|not ready|just asking|don't book|do not book/i.test(input)) return false;
  if (/[?؟]/.test(input) && /כדאי|האם|should|would it|how/i.test(input)) return false;
  return /אני רוצה (?:להזמין|לשכור|להתקדם עם בקש(?:ה להשכרה|ת השכרה))|בוא(?:ו)? נתקדם|בוא(?:ו)? (?:נלך על זה|נסגור)|יאללה נסגור|תשריין לי|שריין לי|אפשר להתחיל (?:הזמנה|בקשה)|תכין(?:ו)? (?:לי )?(?:בקש(?:ה|ת השכרה)|הצעה)|אני (?:אזמין|אשכור)|I(?:'d| would) like to (?:book|rent)|let'?s (?:book|proceed|close)|I want to (?:book|rent)|go ahead with (?:the )?(?:rental|request)/i.test(input);
}

function greeting(input: string, locale: Locale): string | null {
  if (/^(?:היי+|הי+|שלום|אהלן|hi+|hello|hey)[,!?.\s]+(?:מה נשמע|מה קורה|מה שלומך|how are you|how is it going)[!?.\s🙂]*$/i.test(input)) {
    return locale === 'he' ? 'היי 🙂 הכול טוב, תודה ששאלת. מה שלומך? איך אפשר לעזור לך היום?' : 'Hi 🙂 Doing well, thanks for asking. How are you? How can I help today?';
  }
  if (/^(?:היי+|הי+|שלום|אהלן|hi+|hello|hey)[,!?.\s]+(?:אפשר לשאול|רציתי לשאול|can I ask|I have a question)/i.test(input)) {
    return locale === 'he' ? 'בטח 🙂 מה תרצה לשאול?' : 'Of course 🙂 What would you like to ask?';
  }
  if (/^(?:היי+|הי+|שלום|אהלן|בוקר טוב|צהריים טובים|ערב טוב|hi+|hello|hey|good morning|good evening)[!?.\s🙂👋]*$/i.test(input)) {
    return locale === 'he' ? 'היי 🙂 מה נשמע? איך אפשר לעזור לך היום?' : 'Hi 🙂 How are you? How can I help you today?';
  }
  if (/^(?:מה נשמע|מה קורה|מה שלומך|how are you|how is it going)[!?.\s🙂]*$/i.test(input)) {
    return locale === 'he' ? 'הכול טוב, תודה ששאלת 🙂 מה שלומך? איך אפשר לעזור לך היום?' : 'Doing well, thanks for asking 🙂 How are you? How can I help today?';
  }
  return null;
}

function identityQuestion(input: string): 'name' | 'digital' | null {
  if (/איך קוראים לך|מה השם שלך|what(?:'s| is) your name/i.test(input)) return 'name';
  if (/את[ה]? (?:בוט|רובוט|בן אדם|אדם אמיתי|AI)|מדבר(?:ת)? עם (?:בוט|אדם)|עוזר דיגיטלי|are you (?:a bot|an AI|human|a real person)|am I (?:speaking|talking) to (?:a bot|a person)/i.test(input)) return 'digital';
  return null;
}

function affirms(input: string): boolean {
  return /^(?:כן(?:\s+כן)?|נו\s*כן|יאללה|בטח|סבבה|מעולה|אפשר|yes|yeah|sure|go ahead)(?:[,\s]+(?:בבקשה|תודה|תתקדמו|נתקדם|קדימה|תתחילו|תעבירו|please|go ahead|let'?s proceed))*[!?.\s]*$/i.test(input);
}

function offersRentalRequest(reply: string): boolean {
  return /(?:נמשיך|נתקדם|להתקדם|נתחיל|להתחיל|שנתחיל|נאסוף|לאסוף).{0,85}(?:הזמנה|בקשה|פרטים|זמינות)|(?:הזמנה|בקשה).{0,55}(?:נתקדם|נתחיל|נמשיך)|(?:continue|proceed|start|prepare|check).{0,70}(?:booking|rental|request|availability)/i.test(reply);
}

function asksRentalDates(reply: string): boolean {
  if (!/[?؟]/.test(reply) && !/(?:באיזה|איזה|באילו|אילו|לאילו|מתי|מהם|אשמח לדעת|what|which|when)/i.test(reply)) return false;
  return /(?:באיזה|איזה|באילו|אילו|לאילו|מהם)\s+(?:תאריך|תאריכים?)|(?:תאריך|תאריכ|מתי).{0,55}(?:לאסוף|להחזיר|תצטרכ|רכב|השכר|לבדוק)|(?:לאסוף|להחזיר|רכב|השכר).{0,35}(?:תאריך|תאריכים?)|(?:what|which) dates?.{0,55}(?:pick.?up|return|need|car)|when.{0,45}(?:pick.?up|return)/i.test(reply);
}

function directVehicleRequest(input: string, locale: Locale): boolean {
  return !/[?؟]/.test(input) && /^(?:אני רוצה|אנחנו רוצים|רוצה|I want|we want)\s+(?:לשכור\s+)?(?:רכב|ג[׳'י]?יפ(?:ון)?|SUV|a\s+(?:car|SUV))/i.test(input)
    && Boolean(explicitVehicleNeed(input, locale));
}

function applyPromptedLocation(input: string, state: RebuildState, lastBot: string): void {
  const location = input.trim();
  if (/^(?:אותו מקום|שם גם|same place|same location)$/i.test(location)) {
    if (state.booking.pickupLocation) state.booking.returnLocation = state.booking.pickupLocation;
    return;
  }
  if (!/^[\p{L}'׳״ -]{2,45}$/u.test(location) || /^(?:כן|לא|לא יודע|תודה|yes|no|not sure)$/i.test(location)) return;
  // A sentence containing both locations has already been parsed by
  // applyExplicitLocations; it must never become the pickup-city value.
  if (/איסוף|לאסוף|להחזיר|החזרה|pick.?up|drop.?off|return/i.test(location)) return;
  if (/מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|עיר האיסוף|pickup (?:city|location)|where.{0,30}pick.?up/i.test(lastBot)) state.booking.pickupLocation = location;
  else if (/איפה.{0,30}להחזיר|עיר ההחזרה|מקום ההחזרה|return (?:city|location)|where.{0,30}return/i.test(lastBot)) state.booking.returnLocation = location;
}

function statedCount(value: string): number | null {
  const words: Record<string, number> = { אחד: 1, אחת: 1, שניים: 2, שתיים: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5, שישה: 6, שש: 6, שבעה: 7, שבע: 7, שמונה: 8 };
  const count = /^\d{1,2}$/.test(value) ? Number(value) : words[value] ?? null;
  return count !== null && count > 0 && count <= 20 ? count : null;
}

function applyExplicitNeeds(input: string, draft: BookingDraft): void {
  const count = '(\\d{1,2}|אחד|אחת|שניים|שתיים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש|שישה|שש|שבעה|שבע|שמונה)';
  const passengers = input.match(new RegExp(`(?:אנחנו|נהיה)\\s+${count}(?=\\s|$)|${count}\\s+(?:נוסעים|אנשים|מבוגרים|passengers|people)`, 'iu'));
  const luggage = input.match(new RegExp(`${count}\\s+(?:מזוודות|מזוודה|תיקים|תיקי נסיעה|bags|suitcases)`, 'iu'));
  const passengerCount = statedCount(passengers?.[1] ?? passengers?.[2] ?? '');
  const luggageCount = statedCount(luggage?.[1] ?? '');
  if (passengerCount !== null) draft.passengers = passengerCount;
  if (luggageCount !== null) draft.luggage = luggageCount;
}

function explicitVehicleNeed(input: string, locale: Locale): string | null {
  if (/שבעה מקומות|7[- ]?seater|seven[- ]?seater/i.test(input)) return locale === 'he' ? 'רכב שבעה מקומות' : 'seven-seat car';
  if (/משפחתי|משפחתית|family car/i.test(input)) return locale === 'he' ? 'רכב משפחתי' : 'family car';
  if (/קומפקטי|קומפקטית|רכב קטן|compact car|small car/i.test(input)) return locale === 'he' ? 'רכב קומפקטי' : 'compact car';
  if (/רכב פנאי|ג[׳'י]?יפ(?:ון)?|suv/i.test(input)) return locale === 'he' ? 'רכב פנאי' : 'SUV';
  return null;
}

function driverAgeRange(input: string, state: RebuildState): '21-23' | '24-plus' | null {
  if (/(?:^|\D)21\s*[-–]\s*23(?:\D|$)/u.test(input)) return '21-23';
  if (/(?:^|\D)24\s*\+(?:\D|$)/u.test(input)) return '24-plus';
  if (!/(?:בן|בת|גיל|age|aged)/i.test(input) && !(state.phase === 'booking' && state.step === 'rental_age')) return null;
  const age = input.match(/(?:בן|בת|גיל|age(?:d)?(?: is)?)\s*(\d{2})(?!\d)/i)?.[1]
    ?? (state.phase === 'booking' && state.step === 'rental_age' ? input.trim().match(/^(\d{2})$/)?.[1] : undefined);
  if (!age) return null;
  const value = Number(age);
  return value >= 21 && value <= 23 ? '21-23' : value >= 24 && value <= 99 ? '24-plus' : null;
}

function safety(input: string): 'accident' | 'breakdown' | null {
  if (/מה (?:קורה|יקרה|עושים)?\s*אם|אם (?:תהיה|יקרה|אעשה|הרכב ייתקע)|במקרה של|hypothetical|what if|if (?:I have|the car breaks down)/i.test(input)) return null;
  if (/(?:יש לכם שירות|האם אתם מציעים שירות|do you offer|do you have).{0,30}(?:פנצ|גרר|flat tire|tow)/i.test(input)) return null;
  if (/הרכב שלי.{0,35}(?:במוסך|אחרי תאונה)|my own car.{0,35}(?:accident|crash)/i.test(input) && /לשכור|להשכיר|רכב חלופי|rent|replacement car/i.test(input)) return null;
  if (/תאונה|התנגשות|(?<!לא )נפגע|פצוע|accident|crash|collision|(?<!not )injured/i.test(input)) return 'accident';
  if (/פנצ[׳']?ר|נתקעתי|לא (?:מניע|מתניע|התניע|נדלק)|רעש.{0,25}בלמ|בלמ.{0,25}רעש|עשן|תקלה ברכב|flat tire|breakdown|won'?t start|brake.{0,25}(?:noise|problem)|(?:noise|problem).{0,25}brake|(?:אני צריך|אני זקוק|תשלחו|שולחים).{0,25}גרר|גרר.{0,15}(?:עכשיו|דחוף)|(?:need|send).{0,25}tow|tow.{0,15}(?:now|urgent)/i.test(input)) return 'breakdown';
  return null;
}

function commercialReply(input: string, state: RebuildState): { reply: string; escalate: boolean } {
  const he = state.locale === 'he';
  const previous = state.history.filter(item => item.from === 'customer').map(item => item.text).join(' ');
  const context = `${previous} ${input}`;
  const lastBot = [...state.history].reverse().find(item => item.from === 'bot')?.text ?? '';
  const acceptsTeamCheck = /(?:הצוות יבדוק|הצוות יוכל לבדוק|נציג.{0,25}יחזור|נשמח להכין.{0,50}הצעה|team (?:check|review)|team to review|representative.{0,25}follow up|happy to prepare.{0,50}(?:quote|offer))/i.test(lastBot)
    && (affirms(input)
      || /שהצוות|שיבדקו|תבדקו|תעביר|לפי מה שכבר|אין לי העדפה|אין העדפה|לא משנה|no preference|go ahead|please do/i.test(input));
  const asksTeamReview = /תעביר(?:ו)?\s+(?:את זה|את הפרטים|לצוות)|שהצוות יבדוק|שיבדקו בשבילי|שהצוות יחזור אלי|שיחזרו אלי|תחזרו אלי|(?:have|ask) the team (?:check|review)|pass (?:this|it|the details) to (?:the )?team|send (?:this|it) to (?:the )?team|(?:team|someone).{0,15}call me back/i.test(input);
  if (state.interest === 'leasing') {
    if (/הבדל|difference|compare/i.test(input)) return { reply: he ? 'ליסינג פרטי מיועד לשימוש אישי, ועסקי לצורכי העסק. ההתחייבויות, השירותים והמחיר נקבעים רק בהצעה ובחוזה של המסלול המתאים. תרצה לבדוק מסלול פרטי או עסקי?' : 'Private leasing serves personal use; business leasing serves a company. Commitments, services and price are set in the specific offer and contract. Which route would you like us to check?', escalate: false };
    if (/מחיר|חודשי|תשלום|כמה|price|monthly|cost/i.test(input)) return { reply: he ? 'התשלום החודשי תלוי במסלול, בסוג הרכב, בתקופה ובקילומטראז׳. נשמח להכין לכם הצעה אישית לפי הפרטים שכבר מסרתם.' : 'The monthly payment depends on the plan, vehicle, term and mileage. We will be happy to prepare a personal offer using the details you have given.', escalate: false };
    if (acceptsTeamCheck || asksTeamReview || /הצעה|צעד הבא|להתקדם|תתקדמו|נסגור|יאללה|quote|next step|proposal|let's close/i.test(input)) return { reply: he ? `תודה, קיבלנו את הפרטים להצעת ליסינג אישית. נציג SmartCar יחזור אליכם להמשך; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your details for a personal leasing offer. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`, escalate: true };
    if (!/לשנה|שנה|שנתיים|שנים|חודש|year|month/i.test(context)) return { reply: he ? 'ב־SmartCar אפשר לבדוק ליסינג פרטי או עסקי. לכמה זמן תרצה את הרכב?' : 'SmartCar can check private or business leasing. What term do you have in mind?', escalate: false };
    if (!/קילומ|ק״מ|קמ|mileage|km/i.test(context)) return { reply: he ? 'רשמתי את משך הליסינג. כמה קילומטרים בערך תיסע בשנה?' : 'I have the term. Roughly how many kilometres would you drive each year?', escalate: false };
    if (!/משפחת|קומפקט|עירונ|ג[׳'י]?יפ|סדאן|קטן|family|compact|suv|sedan|small car/i.test(context)) return { reply: he ? 'רשמתי את התקופה ואת הקילומטראז׳ שציינת. איזה סוג רכב תרצו בהצעה האישית?' : 'I have the term and mileage you mentioned. What vehicle type would you like in your personal offer?', escalate: false };
    return { reply: he ? 'יש לנו את התקופה, הקילומטראז׳ וסוג הרכב שביקשתם. תרצו שנציג SmartCar יחזור אליכם עם הצעת ליסינג?' : 'We have the term, mileage and vehicle type you requested. Would you like a SmartCar representative to follow up with a leasing offer?', escalate: false };
  }
  if (acceptsTeamCheck || asksTeamReview) return { reply: he ? `תודה, קיבלנו את ההעדפות שלכם לרכישת רכב. נציג SmartCar יחזור אליכם עם האפשרויות המתאימות; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your vehicle preferences. A SmartCar representative will follow up with suitable options; you can also call ${OFFICE_PHONE}.`, escalate: true };
  if (/דגמים|מלאי|זמינ|מה יש לכם|איזה רכבים יש|what cars|models|stock|available/i.test(input)) {
    const hasType = /משפחת|קומפקט|עירונ|ג[׳'י]?יפ|סדאן|family|compact|suv|sedan/i.test(context);
    const hasBudget = /תקציב|אלף|שקל|₪|budget|shekel/i.test(context);
    if (hasType && hasBudget) return { reply: he ? 'נשמח לבדוק דגמים שמתאימים להעדפות שכבר מסרתם. תרצו שנציג SmartCar יחזור אליכם עם אפשרויות?' : 'We will be happy to check models that match the preferences you shared. Would you like a SmartCar representative to follow up with options?', escalate: false };
    return { reply: he ? `נשמח לבדוק אילו רכבים מתאימים לכם. ${hasType ? 'מה התקציב שתרצו שנביא בחשבון?' : 'איזה סוג רכב מעניין אתכם?'}` : `We will be happy to check suitable cars. ${hasType ? 'What budget should we consider?' : 'What kind of car interests you?'}`, escalate: false };
  }
  if (/נסיעת מבחן|test drive/i.test(input)) {
    const requested = /רוצה לקבוע|תתאמו|תקבעו|book|schedule|arrange/i.test(input);
    return { reply: he ? `${requested ? 'קיבלנו את הבקשה לנסיעת מבחן. ' : ''}נשמח לתאם נסיעת מבחן בכפוף לזמינות הרכב ולאישור התור. אפשר להתקשר ל־${OFFICE_PHONE}.` : `${requested ? 'We have your test drive request. ' : ''}We will be happy to arrange a test drive, subject to vehicle availability and appointment confirmation. You can call ${OFFICE_PHONE}.`, escalate: requested };
  }
  if (/מה תצטרכו|לבדוק|הצעה|נסגור|יאללה|תתקדמו|next step|what do you need|quote|let's close/i.test(input)) return { reply: he ? `תודה, קיבלנו את הפרטים לבדיקת רכישה. נציג SmartCar יחזור אליכם עם האפשרויות המתאימות; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your purchase enquiry. A SmartCar representative will follow up with suitable options; you can also call ${OFFICE_PHONE}.`, escalate: true };
  if (!/משפחת|קומפקט|עירונ|ג[׳'י]?יפ|סדאן|family|compact|suv|sedan/i.test(context)) return { reply: he ? 'איזה סוג רכב תרצה לקנות?' : 'What kind of car would you like to buy?', escalate: false };
  if (!/תקציב|אלף|שקל|₪|budget|shekel/i.test(context)) return { reply: he ? 'איזה תקציב תרצה שנבדוק?' : 'What budget should we check?', escalate: false };
  return { reply: he ? 'רשמתי את סוג הרכב והתקציב שציינתם. יש שנתון או קילומטראז׳ שחשובים לכם, או שתרצו שנציג SmartCar יחזור אליכם עם אפשרויות?' : 'I have the vehicle type and budget you mentioned. Do you have a preferred year or mileage, or would you like a SmartCar representative to follow up with options?', escalate: false };
}

export function isRebuiltSafetyMessage(input: string): boolean { return safety(input) !== null; }

function hasVehicleContext(draft: BookingDraft, input: string): boolean {
  return Boolean(draft.vehicleNeed || explicitVehicleNeed(input, 'he')
    || /נוסע|זוג|משפחה|ילד|תינוק|מזווד|ציוד|מטען|מרווח|עיר|חניה|פגיש|שטח|passenger|family|child|baby|luggage|bags|space|city|parking|meeting|off.?road/i.test(input));
}

function direction(reading: BotReading | null, draft: BookingDraft, input: string): VehicleDirection {
  const people = draft.passengers ?? 0;
  if (/רכב פנאי|\bSUV\b/i.test(draft.vehicleNeed ?? '')) return 'suv';
  if (/שבעה מקומות|seven.?seat/i.test(draft.vehicleNeed ?? '')) return 'seven_seat';
  if (/משפחתי|משפחתית|family/i.test(draft.vehicleNeed ?? '')) return 'family';
  if (/קומפקטי|compact/i.test(draft.vehicleNeed ?? '')) return 'compact';
  if (people >= 6) return 'seven_seat';
  if (draft.childSeats || /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input)) return 'family';
  if (people >= 3 || (draft.luggage ?? 0) >= 3) return 'family';
  if (/פגיש|עיר|חניה|city|meeting|parking/i.test(input)) return 'compact';
  return hasVehicleContext(draft, input) && reading?.direction && reading.direction !== 'none' ? reading.direction : 'none';
}

function advice(input: string, state: RebuildState, reading: BotReading | null): string {
  const he = state.locale === 'he';
  if (/יקר לי|יקר מדי|מחוץ לתקציב|too expensive|over my budget/i.test(input)) return he
    ? 'מבין. אפשר לבדוק קבוצת רכב קטנה יותר או תאריכים אחרים, בלי להבטיח מחיר לפני הצעה. מה התקציב היומי שמתאים לך?'
    : 'I understand. We can check a smaller vehicle group or different dates, without promising a price before a quote. What daily budget works for you?';
  if (/כיסא(?:\s+ה?)?בטיחות|child seat|car seat/i.test(input) && /מה חשוב|מה צריך|מה לוודא|what.*(?:check|verify)|what matters/i.test(input)) return he
    ? 'כדאי לוודא שכיסא הבטיחות מתאים לרכב המסוים ושאפשר להתקין אותו במושב מתאים לפי הוראות יצרני הרכב והכיסא. כדי שנוכל להתאים מקום לנוסעים ולמזוודות, איזה כיסא וכמה נוסעים יהיו?'
    : 'Check that your child seat is compatible with the actual car and can be fitted in a suitable seat under the car and seat makers’ instructions. Passenger and luggage space also need checking in the specific model. What seat and how many passengers will you have?';
  if (/כיסא(?:\s+ה?)?בטיחות|child seat|car seat/i.test(input) && /לאן|איפה|מספיק מקום|where|install|enough (?:room|space)/i.test(input)) {
    return he
      ? 'כיסא בטיחות צריך להתקין במושב מתאים לפי הוראות יצרני הרכב והכיסא, לא בתא המטען. לגבי המזוודות, נבדוק מקום בדגם המסוים לפני שנבטיח התאמה. לאילו תאריכים תצטרכו רכב?'
      : 'A child seat must be fitted in a suitable seat following the car and seat makers’ instructions, never in the boot. We need to check luggage space in the actual model before promising a fit. What dates do you need the car?';
  }
  if (/מזווד|מטען|תא מטען|luggage|suitcase|boot|trunk/i.test(input) && /כמה|נכנס|יספיק|מקום|יכול|fit|space|room|how many/i.test(input)) {
    return he
      ? 'המקום למזוודות תלוי בדגם ובגודל המזוודות. כמה נוסעים ומזוודות יהיו? כך נוכל להציע רכב מתאים.'
      : 'Luggage fit depends on the actual model and suitcase sizes. I can suggest a vehicle group to check, but cannot promise fit without checking that car. How many passengers and suitcases will you have?';
  }
  const group = direction(reading, state.booking, input);
  const topic = /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input) || Boolean(state.booking.childSeats) ? 'child' :
    /פגיש|עיר|חניה|city|meeting|parking/i.test(input) ? 'city' : 'trip';
  const lead = he ? ({ compact: 'רכב קומפקטי של SmartCar יכול להתאים לנסיעה שלכם', family: 'משפחתית של SmartCar יכולה להתאים לנסיעה שלכם', suv: 'רכב פנאי של SmartCar יכול להתאים לנסיעה שלכם', seven_seat: 'רכב שבעה מקומות של SmartCar יכול להתאים לנסיעה שלכם', none: 'נשמח לעזור לכם לבחור רכב מתאים ב־SmartCar' } as const)[group]
    : ({ compact: 'I would start with a SmartCar compact', family: 'I would start with a SmartCar family car', suv: 'A SmartCar SUV is a direction to check', seven_seat: 'I would check a SmartCar seven-seater', none: 'We can choose a SmartCar car around your trip' } as const)[group];
  const benefit = he ? topic === 'child' ? 'נוכל לבחור יחד דגם עם מקום לנוסעים ולציוד, ולוודא שכיסא הבטיחות מתאים לו.' : topic === 'city' ? 'רכב שיעמוד לרשותכם בין היעדים נותן גמישות לאורך היום.' : 'כך אפשר להתאים את המרחב והנוחות למשך הנסיעה ולציוד שלכם.'
    : topic === 'child' ? 'It is a good starting point for passenger and luggage space; the child seat must be checked against the actual car.' : topic === 'city' ? 'Having the car at your disposal gives flexibility between stops during the day.' : 'We can match passenger space and comfort to the trip and your luggage.';
  const next = !state.booking.pickupDate ? (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?')
    : !state.booking.returnDate ? question('returnDate', state.locale)
    : !state.booking.pickupLocation ? question('pickupLocation', state.locale)
    : !state.booking.returnLocation ? question('returnLocation', state.locale)
    : (he ? 'תרצו שנתחיל בקשה לבדיקה עם הפרטים שכבר מסרתם?' : 'Would you like to start a request for review with the details you already gave?');
  const price = PRICE_OR_AVAILABILITY.test(input) ? `${priceAnswer(state.locale)} ` : '';
  return `${lead}. ${benefit} ${price}${next}`.replace(/\s+/g, ' ').trim();
}

function safeModelReply(reading: BotReading | null, input: string, state: RebuildState): string | null {
  if (!reading || OUTSIDE.test(input) || /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input)) return null;
  if (/מזווד|מטען|תא מטען|luggage|suitcase|boot|trunk/i.test(input) && /כמה|נכנס|יספיק|מקום|יכול|fit|space|room|how many/i.test(input)) return null;
  if (PRICE_OR_AVAILABILITY.test(input)) return null;
  const reply = reading.reply;
  if (OUTSIDE.test(reply) || UNSAFE_CLAIM.test(reply) || INTERNAL_VOICE.test(reply) || /₪|\b\d{2,}\b/.test(reply)) return null;
  if (VOLUNTEERED_IDENTITY.test(reply) && !identityQuestion(input)) return null;
  if (!hasVehicleContext(state.booking, input) && /רכב (?:קטן|קומפקטי|משפחתי|פנאי|שבעה מקומות)|משפחתית|ג[׳'י]?יפון|קטגוריית רכבים קומפקטיים|compact car|family car|SUV/i.test(reply)) return null;
  if (state.booking.passengers && state.booking.passengers < 6 && !/שבעה מקומות|7\s*מקומות|seven.?seat/i.test(input) && /שבעה מקומות|7\s*מקומות|seven.?seat/i.test(reply)) return null;
  if (/באיזו שעה|באיזה שעה|מה השעה|שעת (?:ה?איסוף|ה?החזרה)|what time|pickup time|drop.?off time|return time/i.test(reply)) return null;
  if (state.booking.pickupDate && /באיזה תאריך.{0,25}לאסוף|תאריך איסוף|what date.{0,25}pick.?up/i.test(reply)) return null;
  if (state.booking.returnDate && /באיזה תאריך.{0,25}תחזיר|תאריך החזרה|what date.{0,25}return/i.test(reply)) return null;
  if (state.booking.pickupDate && state.booking.returnDate && asksRentalDates(reply)) return null;
  if (state.booking.pickupLocation && /מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|עיר האיסוף|where.{0,30}pick.?up/i.test(reply)) return null;
  if (state.booking.returnLocation && /איפה.{0,30}להחזיר|עיר ההחזרה|where.{0,30}return/i.test(reply)) return null;
  if ((!state.booking.pickupDate || !state.booking.returnDate) && /מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|עיר האיסוף|איפה.{0,30}להחזיר|עיר ההחזרה|where.{0,30}(?:pick.?up|return)/i.test(reply)) return null;
  if (!state.booking.pickupDate && /תאריכים (?:שכבר )?(?:ציינ|בחרת|שבחרת)|dates (?:you(?:'ve| have) )?(?:already )?(?:mentioned|chosen)/i.test(reply)) return null;
  const earlierBotReplies = state.history.filter(entry => entry.from === 'bot').slice(-4).map(entry => entry.text);
  if (offersRentalRequest(reply) && earlierBotReplies.some(offersRentalRequest)) return null;
  if (reply.length > 40 && !/[.!?…]$/.test(reply)) return null;
  if ((reply.match(/[?؟]/g) ?? []).length > 1) return null;
  if (state.locale === 'he' && (!/[א-ת]/.test(reply) || /[\u0600-\u06ff]/u.test(reply))) return null;
  if (state.locale === 'en' && /[א-ת]/.test(reply)) return null;
  return reply;
}

function applyFields(input: string, state: RebuildState, reading: BotReading | null): void {
  if (!reading) return;
  const fields = reading.fields;
  for (const [source, target] of [['pickupDate', 'pickupDate'], ['returnDate', 'returnDate'], ['pickupLocation', 'pickupLocation'], ['returnLocation', 'returnLocation'], ['vehicleNeed', 'vehicleNeed']] as const) {
    const field = fields[source];
    if (!field || !input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase())) continue;
    if (source === 'pickupDate' || source === 'returnDate') {
      if (!/\d{1,2}|היום|מחר|מחרתיים|(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|today|tomorrow|(?:mon|tues|wed|thurs|fri|sat|sun)/i.test(field.evidence)) continue;
      const latest = new Date(`${israelDate()}T00:00:00Z`);
      latest.setUTCFullYear(latest.getUTCFullYear() + 2);
      if (!validDate(field.value) || field.value < israelDate() || field.value > latest.toISOString().slice(0, 10)) continue;
    }
    if ((source === 'pickupLocation' || source === 'returnLocation')
      && !/איסוף|לאסוף|להחזיר|החזרה|pick.?up|return|drop.?off/i.test(input)
      && !(state.phase === 'booking' && state.step === 'rental_locations' && input.trim().split(/\s+/).length <= 3)) continue;
    if (source === 'vehicleNeed' && state.phase !== 'booking' && !explicitBooking(input)) continue;
    state.booking[target] = source === 'vehicleNeed'
      ? explicitVehicleNeed(field.evidence, state.locale) ?? explicitVehicleNeed(field.value, state.locale) ?? field.value
      : field.value;
  }
  for (const name of ['passengers', 'luggage', 'childSeats'] as const) {
    const field = fields[name];
    const count = Number(field?.value);
    if (field && input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase()) && Number.isInteger(count) && count >= 0 && count <= 20) state.booking[name] = count;
  }
  if (!state.booking.returnLocation && state.booking.pickupLocation && /אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input)) state.booking.returnLocation = state.booking.pickupLocation;
  if (state.booking.pickupDate && state.booking.returnDate && state.booking.returnDate < state.booking.pickupDate) delete state.booking.returnDate;
}

function privateDetail(input: string, state: RebuildState): boolean {
  if (state.phase !== 'booking') return false;
  if (state.step === 'rental_email' || state.step === 'rental_confirm') {
    const email = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (email && EMAIL.test(email) && email.length <= 160) { state.booking.customerEmail = email; return true; }
  }
  if (state.step === 'rental_name' || state.step === 'rental_confirm') {
    const explicit = input.match(/(?:קוראים לי|שמי|השם שלי|my name is|I am)\s+([\p{L}' -]{3,60})/iu)?.[1]?.trim();
    const candidate = explicit ?? (state.step === 'rental_name' && /^[\p{L}' -]{3,60}$/u.test(input.trim()) && !/^(?:מה|איך|למה|מתי|כמה)\s/u.test(input.trim()) ? input.trim() : '');
    if (candidate && candidate.split(/\s+/).length <= 4) { state.booking.customerName = candidate; return true; }
  }
  return false;
}

function summary(state: RebuildState): string {
  const b = state.booking;
  const consent = termsConsent(state.locale);
  const date = (value?: string) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '';
  if (state.locale === 'en') return `Here are your request details:\nVehicle: ${b.vehicleNeed}\nDates: ${date(b.pickupDate)}–${date(b.returnDate)}\nPickup: ${b.pickupLocation}\nReturn: ${b.returnLocation}\nDriver age: ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}\nName: ${b.customerName}\nEmail: ${b.customerEmail}\n\nThis request is subject to SmartCar's review and confirmation. Before sending it, please confirm the following statement:\n“${consent.text}”\nTerms: https://www.smartcar.co.il/en/terms\nPrivacy: https://www.smartcar.co.il/en/privacy\nIf everything is correct and you agree, reply “I confirm” to send the request.`;
  return `אלה פרטי הבקשה שלכם:\nרכב: ${b.vehicleNeed}\nתאריכים: ${date(b.pickupDate)}–${date(b.returnDate)}\nאיסוף: ${b.pickupLocation}\nהחזרה: ${b.returnLocation}\nגיל הנהג: ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}\nשם: ${b.customerName}\nמייל: ${b.customerEmail}\n\nהבקשה תועבר לאישור SmartCar. לפני השליחה, אנא אשרו את ההצהרה:\n״${consent.text}״\nתנאי השימוש: https://www.smartcar.co.il/he/terms\nמדיניות הפרטיות: https://www.smartcar.co.il/he/privacy\nאם הכול נכון ואתם מסכימים, שלחו ״אני מאשר/ת״ כדי לשלוח את הבקשה.`;
}

function pushHistory(state: RebuildState, input: string, reply: string, privateTurn: boolean): void {
  state.history.push({ from: 'customer', text: input.slice(0, 450), private: privateTurn }, { from: 'bot', text: reply.slice(0, 650), private: privateTurn });
  state.history = state.history.slice(-20);
}

export async function getRebuiltBotReply(phone: string, raw: string, store: RebuildStore): Promise<RebuildResult> {
  const input = raw.trim().slice(0, 1000);
  const stored = await store.loadState(phone);
  const state = stored?.version === 2 ? structuredClone(stored) : fresh(language(input, 'he'));
  if (state.handedOff && (!state.handoffAt || !Number.isFinite(Date.parse(state.handoffAt)) || Date.now() - Date.parse(state.handoffAt) >= 24 * 60 * 60 * 1000)) {
    state.handedOff = false;
    state.handoffAt = undefined;
    state.handoffKind = undefined;
    state.phase = 'explore';
    state.step = 'menu';
  }
  state.locale = language(input, state.locale);
  const he = state.locale === 'he';
  let reply = '';
  let source: RebuildResult['source'] = 'local';
  let model: string | undefined;
  let escalate = false;
  let privateTurn = false;
  const lastBotReply = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';

  const incident = safety(input);
  if (incident) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt ??= new Date().toISOString(); state.handoffKind = 'safety';
    const recentAlert = state.safetyAlertAt && Date.now() - Date.parse(state.safetyAlertAt) < 24 * 60 * 60 * 1000;
    reply = /גרר|tow|roadside/i.test(input) && recentAlert
      ? (he ? `לתיאום גרר הישארו במקום בטוח והתקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `To arrange a tow, stay somewhere safe and call SmartCar now: ${OFFICE_PHONE}.`)
      : (he ? `אם הרכב אינו בטוח, אל תמשיכו לנסוע. עצרו במקום בטוח אם אפשר; אם יש סכנה מיידית או נפגעים, פנו לגורמי החירום. התקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `If the car may be unsafe, do not continue driving. Stop somewhere safe if you can; call emergency services if anyone is hurt or in immediate danger. Call SmartCar now: ${OFFICE_PHONE}.`);
    source = 'safety'; escalate = !recentAlert;
    if (escalate) state.safetyAlertAt = new Date().toISOString();
  } else if (identityQuestion(input)) {
    reply = identityQuestion(input) === 'name'
      ? (he ? 'אפשר לקרוא לי SmartCar 🙂 איך אוכל לעזור?' : 'You can call me SmartCar 🙂 How can I help?')
      : (he ? 'אני העוזר הדיגיטלי של SmartCar. אני כאן לעזור, ואם צריך אעביר את הפנייה לנציג.' : 'I am SmartCar’s digital assistant. I am here to help, and I can pass your enquiry to a representative when needed.');
  } else if (state.handedOff) {
    const handoffKind = state.handoffKind ?? (state.safetyAlertAt && (!state.handoffAt || Date.parse(state.safetyAlertAt) >= Date.parse(state.handoffAt)) ? 'safety' : state.interest ? 'commercial' : 'booking_change');
    reply = /תודה|thanks|thank you/i.test(input)
      ? (he ? 'בשמחה. שמרו על עצמכם.' : 'You are welcome. Take care.')
      : /מתי.{0,25}(?:חוזר|חוזרים|יחזרו|תענו)|תוך כמה זמן|when.{0,25}(?:call|reply|hear back)|how long.{0,25}(?:response|reply)/i.test(input)
        ? (he ? `נציג SmartCar יחזור אליכם בהקדם. אם העניין דחוף, אפשר להתקשר עכשיו ל־${OFFICE_PHONE}.` : `A SmartCar representative will follow up as soon as possible. If it is urgent, please call ${OFFICE_PHONE} now.`)
      : /מספר\s+ה?הזמנה\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}|booking\s+(?:number|reference)\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(input)
        ? (he ? 'תודה, קיבלנו את מספר ההזמנה וצירפנו אותו לפנייה.' : 'Thank you, we have added your booking reference to the enquiry.')
      : handoffKind === 'safety'
        ? (he ? `תודה על העדכון. אל תמשיכו לנסוע אם יש חשש בטיחותי; לתיאום עזרה התקשרו עכשיו ל־${OFFICE_PHONE}.` : `Thanks for the update. Do not keep driving if the car may be unsafe; call ${OFFICE_PHONE} now to arrange help.`)
        : handoffKind === 'commercial' && state.interest
          ? (he ? `קיבלנו את הפרטים על ${state.interest === 'sale' ? 'רכישת רכב' : 'ליסינג'}. נציג SmartCar יחזור אליכם להמשך; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your ${state.interest === 'sale' ? 'car purchase' : 'leasing'} details. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`)
        : handoffKind === 'service_issue' || handoffKind === 'human'
          ? (he ? `תודה על העדכון. נציג SmartCar יטפל בפנייה שלכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thanks for the update. A SmartCar representative will handle your enquiry; for immediate help call ${OFFICE_PHONE}.`)
        : (he ? `קיבלנו את בקשת השינוי. נציג SmartCar יחזור אליכם; השינוי תקף רק לאחר אישור. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your change request. A SmartCar representative will follow up; the change takes effect only after confirmation. You can also call ${OFFICE_PHONE}.`);
  } else if (state.completedRequestId && state.history.at(-2)?.text === input && /^(?:אני מאשר(?:ת)?|מאשר(?:ת)?|כן,? מאשר(?:ת)?|i confirm|confirm)$/i.test(input)) {
    reply = store.isSimulation ? (he ? 'בסימולציה הבקשה נקלטה לצורכי בדיקה בלבד; לא נוצרה הזמנה אמיתית.' : 'The request was recorded in this simulation only; no real booking was created.') : (he ? `בקשת ההשכרה נשלחה לבדיקה, מספר ${state.completedRequestId}. היא עדיין אינה הזמנה מאושרת.` : `Your rental request was sent for review, reference ${state.completedRequestId}. It is not a confirmed booking yet.`);
  } else if (state.phase === 'booking' && state.step === 'rental_confirm' && /לא מאשר|לא מאשרת|not confirm|not yet/i.test(input)) {
    reply = he ? 'לא שלחתי בקשה. הפרטים נשמרו בשיחה; אפשר לתקן אותם או לאשר רק כשתרצו.' : 'I have not sent a request. The details remain in this conversation; you can correct them or confirm when ready.';
  } else if (state.phase === 'booking' && state.step === 'rental_confirm' && /^(?:אני מאשר(?:ת)?|מאשר(?:ת)?|כן,? מאשר(?:ת)?|i confirm|confirm)$/i.test(input)) {
    const missing = nextMissing(state.booking);
    if (missing) {
      state.step = bookingStep(missing);
      reply = question(missing, state.locale);
    } else {
    const id = await store.createRentalRequest(phone, state);
    if (id) {
      state.completedRequestId = id; state.phase = 'explore'; state.step = 'menu'; state.booking = {}; escalate = true;
      delete state.requestKey;
      reply = store.isSimulation ? (he ? 'בסימולציה הבקשה נקלטה לצורכי בדיקה בלבד; לא נוצרה הזמנה אמיתית.' : 'The request was recorded in this simulation only; no real booking was created.') : (he ? `בקשת ההשכרה נשלחה לבדיקה, מספר ${id}. היא עדיין אינה הזמנה מאושרת.` : `Your rental request was sent for review, reference ${id}. It is not a confirmed booking yet.`);
    } else reply = he ? 'מצטערים, הבקשה לא נקלטה כרגע. אפשר לנסות שוב או להתקשר ל־SmartCar לקבלת עזרה.' : 'Sorry, your request could not be received right now. Please try again or call SmartCar for help.';
    }
  } else if (greeting(input, state.locale)) {
    reply = state.phase === 'booking'
      ? (he ? 'היי 🙂 מה נשמע? הפרטים שכבר מסרת שמורים, ונוכל להמשיך מתי שנוח לך.' : 'Hi 🙂 How are you? The details you gave are saved, and we can continue when you are ready.')
      : greeting(input, state.locale)!;
  } else if (vagueDateAnswer(input) && (asksRentalDates(lastBotReply) || Boolean(state.booking.datePreference) || state.phase === 'booking' && state.step === 'rental_dates')) {
    const previous = state.booking.datePreference;
    state.booking.datePreference = [previous, input].filter(Boolean).join(' עד ').slice(0, 120);
    const clarifiedAlready = state.history.some(entry => entry.from === 'bot' && /באילו תאריכים מדויקים|which exact pickup and return dates/i.test(entry.text));
    reply = clarifiedAlready
      ? (he ? 'הבנתי את הטווח המשוער. כשתדעו את התאריכים המדויקים, כתבו אותם כאן ונמשיך.' : 'I understand the approximate timing. Send the exact dates here when you know them and we can continue.')
      : (he ? 'הבנתי את הכיוון. כדי לבדוק זמינות ולהכין בקשה, באילו תאריכים מדויקים תרצו לאסוף ולהחזיר את הרכב? אפשר לכתוב למשל 2/11–26/11.' : 'I understand the approximate timing. Which exact pickup and return dates would you like? For example, 2/11–26/11.');
  } else if (state.phase === 'explore' && (/באיזו שעה|באיזה שעה|what time/i.test(lastBotReply) && /^\d{1,2}(?::\d{2})?$/.test(input) || /אמרתי לך כבר|שאלת כבר|כבר אמרתי|already told you|asked me already/i.test(input))) {
    const consented = state.history.some((entry, index) => entry.from === 'customer' && affirms(entry.text) && index > 0 && offersRentalRequest(state.history[index - 1].text));
    if (consented) {
      state.phase = 'booking'; state.requestKey ??= randomUUID();
      const missing = nextMissing(state.booking);
      state.step = bookingStep(missing);
      reply = `${he ? 'סליחה על החזרה. אין צורך בשעת איסוף בשלב הזה. ' : 'Sorry for repeating myself. I do not need a pickup time now. '}${missing ? question(missing, state.locale) : summary(state)}`;
    } else reply = he ? 'סליחה, חזרתי על שאלה. לא צריך לציין שעה כרגע. איך תרצה שאעזור מכאן?' : 'Sorry, I repeated a question. I do not need a time now. How would you like me to help?';
  } else {
    const lastBot = lastBotReply;
    const wasBooking = state.phase === 'booking';
    const previousVehicleNeed = state.booking.vehicleNeed;
    applyExplicitNeeds(input, state.booking);
    // A free-form recommendation may already have invited the customer to give
    // rental dates. Continue that intake as a real draft instead of letting
    // subsequent short answers drift back into open-ended model chat.
    const priorVehicleRequest = [...state.history].reverse().find(entry => entry.from === 'customer' && directVehicleRequest(entry.text, state.locale));
    const acceptsDateIntake = affirms(input) || Boolean(singleDateAnswer(input)) || Boolean(explicitDateRange(input));
    const resumedIntake = state.phase === 'explore' && !state.interest && (asksRentalDates(lastBot) || Boolean(state.booking.datePreference)) && acceptsDateIntake;
    if (resumedIntake) {
      state.phase = 'booking';
      state.requestKey ??= randomUUID();
      if (priorVehicleRequest) state.booking.vehicleNeed ??= explicitVehicleNeed(priorVehicleRequest.text, state.locale)!;
    }
    const confirmedOffer = affirms(input) && offersRentalRequest(lastBot);
    privateTurn = state.phase === 'booking' && (state.step === 'rental_name' || state.step === 'rental_email');
    const gotPrivate = privateDetail(input, state);
    privateTurn ||= gotPrivate;
    let reading: BotReading | null = null;
    if (!gotPrivate && !confirmedOffer && !resumedIntake && !(state.phase === 'booking' && affirms(input)) && !(state.phase === 'booking' && state.step === 'rental_age' && driverAgeRange(input, state)) && !EMAIL.test(input) && !/(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}/.test(input)) {
      const context: GeminiBotContext = {
        locale: state.locale, phase: state.phase, today: israelDate(),
        recent: state.history.filter(item => !item.private).slice(-8).map(({ from, text }) => ({ from, text })),
        known: { pickupDate: state.booking.pickupDate, returnDate: state.booking.returnDate, pickupLocation: state.booking.pickupLocation, returnLocation: state.booking.returnLocation, vehicleNeed: state.booking.vehicleNeed, passengers: state.booking.passengers, luggage: state.booking.luggage, childSeats: state.booking.childSeats },
      };
      reading = await (store.readTurn ?? readBotTurn)(input, context);
      if (reading) { model = reading.model; applyFields(input, state, reading); }
    }
    const statedRange = explicitDateRange(input);
    if (statedRange) Object.assign(state.booking, statedRange);
    applyPromptedDate(input, state, lastBot);
    if (state.phase === 'booking' && !state.booking.pickupDate) {
      const date = singleDateAnswer(input);
      if (date) state.booking.pickupDate = date;
    } else if (state.phase === 'booking' && state.booking.pickupDate && !state.booking.returnDate) {
      const date = singleDateAnswer(input, state.booking.pickupDate);
      if (date) state.booking.returnDate = date;
    }
    applyExplicitLocations(input, state.booking);
    applyPromptedLocation(input, state, lastBot);
    const statedAgeRange = driverAgeRange(input, state);
    if (statedAgeRange) state.booking.driverAgeRange = statedAgeRange;
    const declines = /לא רוצה להזמין|לא מבקש להזמין|אל תזמין|לא עכשיו|רק מתעניין|עדיין בודק|don't book|cancel this request|not ready to book|just looking/i.test(input);
    const modelSupportedProceed = reading?.route === 'book' && /^(?:כן|יאללה|בוא|בואי|yes|okay|ok|go ahead|let's proceed)/i.test(input)
      && /להתחיל.{0,25}(?:בקשה|הזמנה)|start.{0,25}(?:request|booking)/i.test(lastBot);
    const acceptsRentalOffer = confirmedOffer;
    const asksHuman = /(?:דבר|לדבר|נציג|בן אדם|human|representative|person)/i.test(input) && /רוצה|אפשר|need|want|speak/i.test(input);
    const clearlyRental = /לשכור|השכרה|rental|rent/i.test(input);
    const wantsBooking = !declines && !asksHuman && ((explicitBooking(input) && (!state.interest || clearlyRental)) || modelSupportedProceed || acceptsRentalOffer || state.phase === 'booking');
    const rentalPivot = /מעדיף (?:את ה)?השכרה|חוזר להשכרה|רוצה לשכור במקום|prefer (?:a )?rental|back to renting/i.test(input);
    const specificProblem = /חויבתי|חיוב כפול|חיוב שגוי|שילמתי פעמיים|תקלה בהזמנה|רכב מלוכלך|לא קיבלתי|(?:מזגן|מיזוג).{0,25}(?:לא עובד|מקולקל)|(?:air conditioning|car ac).{0,25}(?:not working|broken)|double charg|charged twice|wrong charge|billing issue|dirty car|booking problem/i.test(input);
    const statedVehicle = explicitVehicleNeed(input, state.locale);
    if (acceptsRentalOffer && !state.booking.vehicleNeed) {
      const offeredVehicle = explicitVehicleNeed(lastBot, state.locale);
      if (offeredVehicle) state.booking.vehicleNeed = offeredVehicle;
    }
    const commercialVehicle = reading?.route === 'sale' || reading?.route === 'leasing' || /ליסינג|לקנות|למכירה|לרכישה|buy|purchase|leasing/i.test(input);
    if (statedVehicle && (wantsBooking || state.phase === 'booking' || !commercialVehicle && !state.interest)
      && (!state.booking.vehicleNeed || /בעצם|מעדיף|במקום|actually|instead|prefer/i.test(input))) state.booking.vehicleNeed = statedVehicle;
    if (rentalPivot) state.interest = undefined;
    else if (reading?.route === 'leasing' || /ליסינג|leasing/i.test(input)) state.interest = 'leasing';
    else if (reading?.route === 'sale' || state.phase !== 'booking' && /נסיעת מבחן|test drive/i.test(input) || /לקנייה|למכירה|רכב לקנות|רוצה לקנות|לקנות (?:את ה)?רכב|buy (?:a |the )?(?:used |new )?(?:family |compact |small |suv )?(?:car|vehicle)|purchase (?:a |the )?car|car for sale|used car/i.test(input)) state.interest = 'sale';
    if (declines) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'בסדר, לא שלחתי בקשה. הפרטים יישארו כאן אם תרצה להמשיך להתלבט.' : 'Okay, I have not sent a request. The details stay here if you want to think it over.';
    } else if (rentalPivot) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'הבנתי, נחזור לבדוק השכרה. לחודש וחצי חשוב להתאים רכב וקילומטראז׳ למסלול ההשכרה; באילו תאריכים תרצה לאסוף ולהחזיר?' : 'Understood, let us check a rental instead. For a longer rental, the vehicle and mileage terms matter. What pickup and return dates do you need?';
    } else if (specificProblem) {
      state.phase = 'service'; state.step = 'menu'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue'; escalate = true;
      reply = he ? `תודה שפניתם אלינו. נציג SmartCar יבדוק את המקרה ויחזור אליכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thank you for contacting us. A SmartCar representative will review your case and follow up; for immediate help call ${OFFICE_PHONE}.`;
    } else if (wantsBooking) {
      state.phase = 'booking';
      state.interest = undefined;
      state.requestKey ??= randomUUID();
      if (!state.booking.vehicleNeed && state.booking.passengers) {
        const people = state.booking.passengers;
        const bags = state.booking.luggage;
        state.booking.vehicleNeed = he ? `רכב ל־${people} נוסעים${bags ? ` ול־${bags} מזוודות` : ''}` : `car for ${people} passengers${bags ? ` and ${bags} bags` : ''}`;
      }
      const missing = nextMissing(state.booking);
      state.step = bookingStep(missing);
      if (!missing) reply = summary(state);
      else {
        const reportedAge = input.match(/(?:בן|בת|גיל|age(?:d)?(?: is)?)\s*(\d{2})(?!\d)/i)?.[1]
          ?? (state.step === 'rental_age' ? input.trim().match(/^(\d{2})$/)?.[1] : undefined);
        const prefix = PRICE_OR_AVAILABILITY.test(input) ? `${priceAnswer(state.locale)} `
          : /הזמנה סופית|הזמנה מאושרת|final booking|confirmed booking/i.test(input)
            ? (he ? 'זו בקשה לבדיקה בלבד, לא הזמנה מאושרת. ' : 'This is a request for review, not a confirmed booking. ')
            : statedVehicle && /בעצם|מעדיף|במקום|actually|instead|prefer/i.test(input)
              ? (he ? `עדכנתי את סוג הרכב ל${statedVehicle}. ` : `I updated the vehicle type to ${statedVehicle}. `)
              : statedVehicle && wasBooking && !previousVehicleNeed
                ? (he ? `רשמתי ${statedVehicle}. ` : `Got it: ${statedVehicle}. `)
              : /תשריין|שריין|reserve|hold (?:a |the )?car/i.test(input)
                ? (he ? 'בשמחה, נוכל להעביר בקשה לשריון; האישור הסופי יינתן לאחר בדיקת זמינות. ' : 'Gladly, we can pass on a reservation request; final confirmation follows an availability check. ')
                : '';
        const policy = reading?.route === 'policy' ? getSmartCarServiceAnswer(input, state.locale)?.reply : null;
        if (reportedAge && Number(reportedAge) < 21) {
          state.step = 'rental_age';
          reply = he ? 'השכרה אפשרית לנהגים מגיל 21. אם ינהג אדם אחר שעומד בתנאים, אפשר לציין את קבוצת הגיל שלו ונשמח להמשיך.' : 'Rental is available to drivers aged 21 or older. If another eligible person will drive, please tell us their age group and we will be happy to continue.';
        } else if (/מה עוד צריך|איזה פרטים חסרים|what else do you need|what details are missing/i.test(input)) {
          const labels: Record<BookingKey, string> = { pickupDate: 'תאריך איסוף', returnDate: 'תאריך החזרה', pickupLocation: 'מקום איסוף', returnLocation: 'מקום החזרה', vehicleNeed: 'צרכי הרכב', driverAgeRange: 'קבוצת גיל הנהג', customerName: 'שם', customerEmail: 'מייל' };
          const remaining = ORDER.filter(key => !state.booking[key]);
          reply = he ? `נשארו רק ${remaining.map(key => labels[key]).join(' ו־')}. ${question(missing, state.locale)}` : `I still need ${remaining.join(', ')}. ${question(missing, state.locale)}`;
        } else if (wasBooking && affirms(input) && missing === 'pickupDate') {
          reply = /כתבו את תאריך האיסוף|type the pickup date/i.test(lastBot)
            ? (he ? 'כשתדעו את תאריך האיסוף, כתבו לי אותו ונמשיך.' : 'When you know the pickup date, send it here and we can continue.')
            : (he ? 'כדי להתקדם, כתבו את תאריך האיסוף עצמו, למשל 15/11.' : 'To continue, please send the pickup date itself, for example 15/11.');
        } else reply = `${policy ? `${policy}\n\n` : prefix}${question(missing, state.locale)}`;
      }
    } else if (reading?.route === 'human' || asksHuman) {
      state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = state.interest ? 'commercial' : 'human'; escalate = true;
      reply = state.interest
        ? (he ? `בשמחה, נציג SmartCar יחזור אליכם לגבי ${state.interest === 'sale' ? 'רכישת הרכב' : 'הליסינג'}. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Of course. A SmartCar representative will follow up about your ${state.interest === 'sale' ? 'car purchase' : 'leasing'} enquiry. You can also call ${OFFICE_PHONE}.`)
        : (he ? `בשמחה, נציג SmartCar יחזור אליכם. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Of course. A SmartCar representative will follow up. You can also call ${OFFICE_PHONE}.`);
    } else if (state.phase === 'service' || reading?.route === 'service' || /הזמנה קיימת|ההזמנה שלי|שכרתי|existing booking|my booking|I rented/i.test(input)) {
      state.phase = 'service';
      const booking = await store.activeBooking(phone);
      const answer = getSmartCarServiceAnswer(input, state.locale);
      const suppliedReference = /(?:מספר\s+ה?הזמנה|booking\s+(?:number|reference)|reference)\s*(?:שלי|הוא|:|#|is)?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(input)
        || (/^[A-Z0-9-]*\d[A-Z0-9-]{2,}$/i.test(input) && /מספר הזמנה|booking reference/i.test(state.history.at(-1)?.text ?? ''));
      if (/לשנות|לשינוי|להאריך|לדחות|לדחייה|להקדים|להזיז|יום ההחזרה|יום מאוחר|change|extend|postpone|move (?:the )?return|return date/i.test(input)) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'booking_change'; escalate = true;
        reply = he ? `קיבלנו את בקשת השינוי. היא תיכנס לתוקף לאחר בדיקת זמינות ואישור SmartCar. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have your change request. It takes effect after SmartCar checks availability and confirms it. For immediate help call ${OFFICE_PHONE}.`;
      } else if (specificProblem || suppliedReference) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue'; escalate = true;
        reply = he ? `תודה שפניתם אלינו. נציג SmartCar יבדוק את המקרה ויחזור אליכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thank you for contacting us. A SmartCar representative will review your case and follow up; for immediate help call ${OFFICE_PHONE}.`;
      } else if (answer) reply = answer.reply;
      else if (booking) reply = he ? `מצאתי את ההזמנה שלכם. לבירור או לשינוי נשמח לעזור בטלפון ${OFFICE_PHONE}.` : `I found your booking. For details or changes, we will be happy to help at ${OFFICE_PHONE}.`;
      else reply = he ? `כדי לבדוק מקרה מסוים נדרש מספר ההזמנה. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `To check a specific case, please send the booking reference or call ${OFFICE_PHONE}.`;
    } else if (state.interest && (!reading || reading.route === state.interest || reading.route === 'explore' || reading.route === 'policy' || reading.route === 'social')) {
      const answer = commercialReply(input, state);
      reply = answer.reply; escalate = answer.escalate;
      if (escalate) { state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'commercial'; }
    } else if (/כיסא(?:\s+ה?)?בטיחות|child seat|car seat/i.test(input) && /מה חשוב|מה צריך|מה לוודא|what.*(?:check|verify)|what matters/i.test(input)) {
      reply = advice(input, state, reading);
    } else if (/התקציב היומי/.test(lastBot) && /\d+\s*(?:ש[״"׳']?ח|₪)|תקציב|budget|\d+\s*(?:nis|ils)/i.test(input)) {
      reply = he ? 'רשמתי את התקציב שציינת. לאילו תאריכים תרצו רכב כדי שנוכל להתאים לכם הצעה?' : 'I have your budget. What dates do you need a car so we can find a suitable offer?';
    } else if (/נהג צעיר|young driver/i.test(input) && /תוספת|מחיר|עלות|כמה|surcharge|extra|price|cost/i.test(input)) {
      reply = he ? 'המחיר ותנאי הביטוח עשויים להשתנות לפי גיל הנהג וסוג הרכב. נשמח לבדוק עבורכם הצעה אישית עם כל התוספות הרלוונטיות.' : 'Price and insurance terms can vary by driver age and vehicle type. We will be happy to check a personal offer with the relevant extras.';
    } else if (/ביטוח|כיסוי|insurance|covered/i.test(input) && /אותי|בשבילי|בוודאות|personal|me|definitely/i.test(input)) {
      reply = he ? 'תנאי הביטוח האישיים תלויים בגיל הנהג, בוותק הרישיון, בנהגים הרשומים ובסוג הרכב. התנאים המדויקים יופיעו בהצעה ובחוזה לפני אישור ההזמנה.' : 'Your insurance terms depend on driver age, licence history, named drivers and vehicle type. The exact terms will be shown in your offer and agreement before booking confirmation.';
    } else if (/הנחה|מבצע|discount|promotion/i.test(input)) {
      reply = he ? 'נשמח לבדוק אילו הטבות מתאימות לתאריכים ולרכב שתבחרו. לאילו תאריכים תצטרכו את הרכב?' : 'We will be happy to check which offers fit your dates and vehicle choice. What dates do you need the car?';
    } else if (/תשלומים|פריסת תשלום|installments?|payment plan/i.test(input)) {
      reply = he ? 'אפשרויות התשלום תלויות בסוג העסקה ובהצעה האישית. מדובר בהשכרה, בליסינג או ברכישת רכב?' : 'Payment options depend on the type of transaction and personal offer. Are you asking about rental, leasing or a car purchase?';
    } else if (PRICE_OR_AVAILABILITY.test(input)) {
      reply = /מחיר סופי|הצעה סופית|final (?:price|quote)/i.test(input) && state.history.at(-1)?.text.includes(priceAnswer(state.locale))
        ? (he ? 'נשמח להכין הצעה מדויקת לפי התאריכים, הרכב והתוספות שתבחרו. תרצו שנתחיל בקשה?' : 'We will be happy to prepare an accurate offer for your dates, vehicle and chosen extras. Shall we start a request?')
        : AVAILABILITY_ONLY.test(input) && !/מחיר|עלות|עול|יעל|price|cost|rate/i.test(input)
        ? availabilityAnswer(state.locale)
        : `${priceAnswer(state.locale)} ${!state.booking.pickupDate ? (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?') : !state.booking.returnDate ? question('returnDate', state.locale) : !state.booking.pickupLocation ? question('pickupLocation', state.locale) : !state.booking.returnLocation ? question('returnLocation', state.locale) : (he ? 'תרצו שנתקדם לבקשה עם הפרטים שכבר מסרתם?' : 'Shall we continue with the details you already gave?')}`;
    } else if (reading?.route === 'policy' || /[?؟]/.test(input) && getSmartCarServiceAnswer(input, state.locale)) {
      const fact = getSmartCarServiceAnswer(input, state.locale);
      reply = fact?.reply ?? (he ? 'את התנאי המדויק צריך לבדוק בהצעה ובחוזה הרלוונטיים. מה בדיוק חשוב לך לברר?' : 'The exact term needs checking in the relevant offer and agreement. What would you like to clarify?');
    } else if (/^(?:תודה(?: רבה)?[.!\s]*|thanks?(?: a lot)?[.!\s]*|thank you[.!\s]*)$/i.test(input)) {
      reply = he ? 'בשמחה. כשתרצו להמשיך, אני כאן.' : 'You are welcome. I am here when you are ready.';
    } else if (/איזה פרטים|מה (?:צריך|תצטרכו)|what details|what do you need/i.test(input)) {
      reply = he ? 'כדי לבדוק השכרה נצטרך תאריכי איסוף והחזרה, מיקומים, סוג רכב או מספר נוסעים וציוד, וקבוצת גיל נהג 21–23 או 24+. שם ומייל נבקש רק אם תרצו לשלוח בקשה.' : 'To check a rental we need pickup and return dates, locations, a vehicle type or passenger and luggage details, and the driver age group: 21–23 or 24+. We only ask for name and email if you choose to send a request.';
    } else if (reading?.route === 'social') {
      const modelReply = safeModelReply(reading, input, state);
      reply = modelReply ?? (he ? 'היי 🙂 במה אפשר לעזור לך עם רכב?' : 'Hi 🙂 How can I help with a car?');
      if (modelReply) source = 'gemini';
    } else {
      const modelReply = safeModelReply(reading, input, state);
      reply = modelReply ?? advice(input, state, reading);
      if (modelReply) source = 'gemini';
    }
  }

  if (state.phase === 'explore' && !state.interest && asksRentalDates(reply) && directVehicleRequest(input, state.locale)) {
    state.phase = 'booking';
    state.requestKey ??= randomUUID();
    state.booking.vehicleNeed ??= explicitVehicleNeed(input, state.locale) ?? undefined;
    const missing = nextMissing(state.booking);
    state.step = bookingStep(missing);
    reply = missing ? question(missing, state.locale) : summary(state);
    source = 'local';
  }

  pushHistory(state, input, reply, privateTurn);
  await store.saveState(phone, state);
  return { reply, state, escalate, source, model };
}
