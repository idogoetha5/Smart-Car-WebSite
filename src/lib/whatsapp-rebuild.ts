import { OFFICE_PHONE } from '@/lib/constants';
import { randomUUID } from 'node:crypto';
import { termsConsent } from '@/lib/consent';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { readBotTurn, type BotReading, type GeminiBotContext, type VehicleDirection } from '@/lib/whatsapp-rebuild-gemini';

type Locale = 'he' | 'en';
type Phase = 'explore' | 'booking' | 'service';
type BookingKey = 'pickupDate' | 'returnDate' | 'pickupLocation' | 'returnLocation' | 'vehicleNeed' | 'driverAgeRange' | 'customerName' | 'customerEmail';
type BookingDraft = Partial<Record<BookingKey, string>> & { passengers?: number; luggage?: number; luggageSize?: 'large'; childSeats?: number; datePreference?: string };
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
  safetyKind?: 'accident' | 'breakdown';
  handedOff?: boolean;
  handoffAt?: string;
  handoffKind?: 'safety' | 'booking_change' | 'service_issue' | 'commercial' | 'human';
  completedRequestId?: string;
  durationClarification?: boolean;
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

// WhatsApp itself is the required contact channel. Email is welcome when offered,
// but must never block a rental request.
const ORDER: BookingKey[] = ['pickupDate', 'returnDate', 'pickupLocation', 'returnLocation', 'vehicleNeed', 'driverAgeRange', 'customerName'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OUTSIDE = /מוני(?:ת|ות)|אוטובוס|רכבת|תחבורה ציבורית|אוויס|אלדן|סיקסט|הרץ|מתחר|חברת השכרה אחרת|\btaxi\b|\bbus\b|\btrain\b|\buber\b|\bavis\b|\bhertz\b|\bsixt\b|competitor|another rental company/i;
const UNSAFE_CLAIM = /(?:יש לנו|יש אצלנו|זמין עכשיו|זמין בדיוק|פנוי עכשיו|מובטח|בטוח ש|בהחלט ייכנס|בהחלט יתאים|יתאים לכם (?:מצוין|בול)|מזווד.{0,25}(?:ייכנס|יספיק)|(?:יהיה|תהיה).{0,20}(?:נוח|נוחה|מרווח|מרווחת).{0,35}(?:לכל|ל)(?:\s+ה)?(?:נוסעים|מטען|מזוודות)|(?:חיסכון|חסכון).{0,18}בדלק|(?:נסיעה|רכב).{0,18}חסכוני(?:ת)?|צריכת דלק.{0,25}(?:מעולה|נמוכה|טובה|חסכונית)|we have available|available for (?:your|the) (?:trip|dates)|guaranteed|(?:definitely|easily) fits?|fits? (?:your|two|three|the) (?:bags|suitcases|luggage)|great fuel efficiency|fuel savings|confirmed booking)/i;
const INTERNAL_VOICE = /המחיר באתר|באתר (?:הוא|מופיע)|אין לי (?:גישה|אישור|מלאי|אפשרות)|לא אישרתי|לא פתרתי|בשיחה הזו|כיוון לבדיקה|הצוות צריך לבדוק|נשמר.{0,25}(?:לטיפול|לנציג)|תהליך פנימי|בדיקה פנימית|המודל|סימולציה|website price|on the website|I (?:do not|don't) have (?:access|approval|inventory)|I have not (?:confirmed|resolved)|internal (?:check|process|system)|simulation|backend/i;
const VOLUNTEERED_IDENTITY = /אני (?:בוט|רובוט|עוזר דיגיטלי|בינה מלאכותית)|אני לא (?:בן אדם|אדם)|I am (?:a bot|an AI|a digital assistant)|I'm (?:a bot|an AI|a digital assistant)/i;
const PRICE_OR_AVAILABILITY = /מחיר|עלות|כמה.{0,12}(?:עול|יעל)|(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:prices?|cost|rate|available|availability)\b/iu;
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
  if (/^(?:hi|hey|yes|ok)[!?.\s]*$/i.test(input)) return 'en';
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
  return 'rental_name';
}

function question(key: BookingKey, locale: Locale): string {
  const he: Record<BookingKey, string> = {
    pickupDate: 'באיזה תאריך תרצו לאסוף את הרכב?', returnDate: 'באיזה תאריך תחזירו את הרכב?',
    pickupLocation: 'מאיפה תרצו לאסוף את הרכב?', returnLocation: 'איפה תרצו להחזיר אותו?',
    vehicleNeed: 'איזה סוג רכב תרצו, או כמה נוסעים וציוד יהיו?', driverAgeRange: 'מה קבוצת הגיל של הנהג? בחרו 21–23 או 24+ (גיל 24 שייך ל־24+).', customerName: 'על איזה שם לרשום את הבקשה?',
    customerEmail: 'מה כתובת המייל ליצירת קשר לגבי הבקשה?',
  };
  const en: Record<BookingKey, string> = {
    pickupDate: 'What date would you like to pick up the car?', returnDate: 'What date will you return it?',
    pickupLocation: 'Where would you like to pick it up?', returnLocation: 'Where will you return it?',
    vehicleNeed: 'What kind of car do you need, or how many passengers and bags?', driverAgeRange: 'What is the driver age group: 21–23 or 24+? Age 24 belongs to 24+.', customerName: 'What name should I put on the request?',
    customerEmail: 'What email address can we use to contact you about the request?',
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
  const namedRouteDates = input.match(new RegExp(`\\b(?:from|pickup(?:\\s+from)?)\\b.{0,90}?\\b(?:on\\s+)?(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?.{0,110}?\\b(?:return|drop.?off)\\b.{0,70}?\\b(?:on\\s+)?(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?`, 'iu'));
  if (namedRouteDates) {
    const year = namedRouteDates[3] ?? namedRouteDates[6] ?? israelDate().slice(0, 4);
    const pickup = `${namedRouteDates[1]}/${MONTHS[namedRouteDates[2].toLowerCase()]}/${year}`;
    const returned = `${namedRouteDates[4]}/${MONTHS[namedRouteDates[5].toLowerCase()]}/${year}`;
    return explicitDateRange(`${pickup}-${returned}`);
  }
  const englishRouteDates = input.match(/\b(?:from|pickup(?:\s+from)?)\b.{0,90}?\b(?:on\s+)?(\d{1,2}[./]\d{1,2}(?:[./]20\d{2})?).{0,110}?\b(?:return|drop.?off)\b.{0,70}?\b(?:on\s+)?(\d{1,2}[./]\d{1,2}(?:[./]20\d{2})?)/i);
  if (englishRouteDates) return explicitDateRange(`${englishRouteDates[1]}-${englishRouteDates[2]}`);
  const labelled = input.match(/(?:pickup|איסוף)\s+(\d{1,2}[./]\d{1,2}(?:[./]20\d{2})?).{0,30}(?:return|החזרה)\s+(\d{1,2}[./]\d{1,2}(?:[./]20\d{2})?)/i);
  if (labelled) return explicitDateRange(`${labelled[1]}-${labelled[2]}`);
  const numeric = input.match(/(?:^|\s)(?:מ-?)?(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\s*(?:[-–־]|עד|to)\s*(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?(?=\s|$|[,.!?])/iu);
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
  return /\b(?:next week|next month|in a week|in a month|about a week|about a month)\b|(?:מ|ב)?עוד\s+(?:כשבוע|כחודש|שבוע|חודש)|מ?עוד\s*שבוע|(?:ב|מ)שבוע הבא|(?:ב|מ)חודש הבא/iu.test(input)
    && !explicitDateRange(input) && !singleDateAnswer(input);
}

function uncertainDateAnswer(input: string): boolean {
  return /(?:לא יודע|לא יודעת|לא בטוח|לא בטוחה|לא סגור(?:ים|ות)? על (?:ה)?תאריכ|לא סגרנו תאריכ|אין לי (?:עדיין )?תאריכ|אין תאריך סופי|עדיין אין תאריך|not sure|don'?t know|no dates? yet|haven'?t decided|(?:have|has) not (?:chosen|picked|decided on) dates? yet)/i.test(input);
}

function cancellationRequest(input: string): boolean {
  return /(?:רוצה|רוצים|מבקש|מבקשת|צריך|צריכה|אפשר).{0,18}לבטל.{0,25}(?:הזמנה|השכרה)|(?:want|need|would like) to cancel (?:my |the )?(?:booking|rental)/i.test(input);
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
  const sameCity = input.trim().match(/^([\p{L}\s'׳״-]{2,50})\s+גם\s+(?:להחזיר\s+(?:גם\s+)?לאסוף|לאסוף\s+(?:(?:וגם|גם)\s+)?להחזיר)$/u)?.[1]?.trim();
  if (sameCity) { draft.pickupLocation = sameCity; draft.returnLocation = sameCity; return; }
  const stop = '(?=\\s+(?:ו?החזרה|להחזיר|(?:and\\s+)?return|(?:and\\s+)?drop.?off)|[,.!?]|$)';
  const hePickup = input.match(new RegExp(`(?:איסוף|לאסוף)\\s+[במ]([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const enPickup = input.match(new RegExp(`pick.?up\\s+(?:at|from|in)\\s+([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const pickup = (hePickup ?? enPickup)?.trim();
  if (pickup) draft.pickupLocation = /^(?:the )?airport$/i.test(pickup) && /Ben Gurion Airport/i.test(input) ? 'Ben Gurion Airport' : pickup;
  const heReturn = input.match(/(?:החזרה|להחזיר)\s+[במ]([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=\s+(?:נהג|גיל|בן|בת|למשך|לתאריכים)|[,.!?]|$)/iu)?.[1];
  const enReturn = input.match(/(?:return|drop.?off)\s+(?:(?:the car|it)\s+)?(?:at|in|to)\s+([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=[,.!?]|$)/iu)?.[1];
  const returnLocation = (heReturn ?? enReturn)?.trim();
  if (returnLocation) draft.returnLocation = returnLocation;
  if (draft.pickupLocation && /אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input)) draft.returnLocation = draft.pickupLocation;
}

function explicitBooking(input: string): boolean {
  if (/לא רוצה להזמין|לא רוצה לשכור|רק מתעניין|רק שואל|לא עכשיו|not ready|just asking|don't book|do not book/i.test(input)) return false;
  if (/[?؟]/.test(input) && /כדאי|האם|should|would it|how/i.test(input)) return false;
  if (/^I need (?:a )?(?:(?:compact|small|family|SUV|seven[- ]?seat) )?rental car\b/i.test(input)) return true;
  return /אני רוצה (?:להזמין|לשכור|לשלוח בקשה|לסיים את הבקשה|להתקדם עם בקש(?:ה להשכרה|ת השכרה))|(?:^|[.!?]\s*)רוצה (?:לשכור|לשלוח בקשה|לסיים את הבקשה)|(?:אני\s+)?צריך(?:ה)? (?:רכב להשכרה|לשכור רכב|רכב (?:קטן|קומפקטי|משפחתי|פנאי|שבעה מקומות)(?:\s|$))|בוא(?:ו)? נתקדם|בוא(?:ו)? (?:נלך על זה|נסגור)|יאללה נסגור|תשריין לי|שריין לי|אפשר להתחיל (?:הזמנה|בקשה)|אשמח להתחיל (?:בקשה|הזמנה)|תכין(?:ו)? (?:לי )?(?:בקש(?:ה|ת השכרה)|הצעה)|אני (?:אזמין|אשכור)|I(?:'d| would) like to (?:book|rent|make a request)|let'?s (?:book|proceed|close)|I want to (?:book|rent|make a request)|I need (?:a )?(?:rental car|to rent(?: a car)?)|go ahead with (?:the )?(?:rental|request)/i.test(input);
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
  return /^(?:כן(?:\s+כן)?|נו\s*כן|אני\s+מאשר(?:ת)?|מאשר(?:ת)?|יאללה|בטח|סבבה|מעולה|אפשר|yes|yeah|sure|go ahead)(?:[,\s]+(?:בבקשה|תודה|תתקדמו|נתקדם|קדימה|תתחילו|תעבירו|please|go ahead|let'?s proceed))*[!?.\s]*$/i.test(input);
}

function offersRentalRequest(reply: string): boolean {
  return /(?:נמשיך|נתקדם|להתקדם|נתחיל|להתחיל|שנתחיל|נאסוף|לאסוף).{0,85}(?:הזמנה|בקשה|פרטים|זמינות)|(?:הזמנה|בקשה).{0,55}(?:נתקדם|נתחיל|נמשיך)|(?:continue|proceed|start|prepare|check).{0,70}(?:booking|rental|request|availability)/i.test(reply);
}

function asksRentalDates(reply: string): boolean {
  if (!/[?؟]/.test(reply) && !/(?:באיזה|איזה|באילו|אילו|לאילו|מתי|מהם|אשמח לדעת|what|which|when)/i.test(reply)) return false;
  return /(?:באיזה|איזה|באילו|אילו|לאילו|מהם)\s+(?:תאריך|תאריכים?)|(?:תאריך|תאריכ|מתי).{0,55}(?:לאסוף|להחזיר|תצטרכ|רכב|השכר|לבדוק)|(?:לאסוף|להחזיר|רכב|השכר).{0,35}(?:תאריך|תאריכים?)|(?:what|which) dates?.{0,55}(?:pick.?up|return|need|car)|when.{0,45}(?:pick.?up|return)/i.test(reply);
}

function directVehicleRequest(input: string, locale: Locale): boolean {
  return !/[?؟]/.test(input) && /^(?:אני רוצה|אנחנו רוצים|אני צריך|אני צריכה|צריך|צריכה|רוצה|I want|I need|we want)\s+(?:לשכור\s+)?(?:רכב|ג[׳'י]?יפ(?:ון)?|SUV|a\s+(?:car|SUV))/i.test(input)
    && Boolean(explicitVehicleNeed(input, locale));
}

function applyPromptedLocation(input: string, state: RebuildState, lastBot: string): void {
  const location = input.trim();
  if (/^(?:אותו מקום|שם גם|same place|same location)$/i.test(location)) {
    if (state.booking.pickupLocation) state.booking.returnLocation = state.booking.pickupLocation;
    return;
  }
  if (!/^[\p{L}'׳״ -]{2,45}$/u.test(location) || location.split(/\s+/).length > 3 || /^(?:כן|לא|לא יודע|תודה|yes|no|not sure)$/i.test(location)
    || /רכב|מעדיף|בעצם|רוצה|צריך|מחפש|מחיר|תאריך|זמינ|שאלה|ליסינג|לקנות|rent|prefer|price|booking/i.test(location)) return;
  // A sentence containing both locations has already been parsed by
  // applyExplicitLocations; it must never become the pickup-city value.
  if (/איסוף|לאסוף|להחזיר|החזרה|pick.?up|drop.?off|return/i.test(location)) return;
  if (/מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|עיר האיסוף|pickup (?:city|location)|where.{0,30}pick.?up/i.test(lastBot)) state.booking.pickupLocation = location;
  else if (/איפה.{0,30}להחזיר|עיר ההחזרה|מקום ההחזרה|return (?:city|location)|where.{0,30}return/i.test(lastBot)) state.booking.returnLocation = location;
  else if (/^(?:הרצליה|תל אביב|ירושלים|נתב["״']?ג|חיפה|רמת גן|פתח תקווה|נתניה|ראשון לציון|רעננה)$/i.test(location)) {
    const recentBot = state.history.filter(entry => entry.from === 'bot').slice(-4).map(entry => entry.text).join(' ');
    if (!state.booking.pickupLocation && /מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|באיזה סניף.{0,30}לאסוף|הסניפים שלנו|pickup (?:city|location)/i.test(recentBot)) state.booking.pickupLocation = location;
    else if (state.booking.pickupLocation && !state.booking.returnLocation && /איפה.{0,30}להחזיר|עיר ההחזרה|מקום ההחזרה|where.{0,30}return/i.test(recentBot)) state.booking.returnLocation = location;
  }
}

function statedCount(value: string): number | null {
  const words: Record<string, number> = { אחד: 1, אחת: 1, שניים: 2, שתיים: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5, שישה: 6, שש: 6, שבעה: 7, שבע: 7, שמונה: 8, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const count = /^\d{1,2}$/.test(value) ? Number(value) : words[value.toLocaleLowerCase()] ?? null;
  return count !== null && count > 0 && count <= 20 ? count : null;
}

function applyExplicitNeeds(input: string, draft: BookingDraft): void {
  const count = '(\\d{1,2}|אחד|אחת|שניים|שתיים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש|שישה|שש|שבעה|שבע|שמונה|one|two|three|four|five|six|seven|eight)';
  const passengers = input.match(new RegExp(`(?:אנחנו|נהיה)\\s+${count}(?=\\s|$)|${count}\\s+(?:נוסעים|אנשים|מבוגרים|passengers|people)`, 'iu'));
  const luggage = input.match(new RegExp(`${count}\\s+(?:(?:small|medium|large|קטנות|בינוניות|גדולות)\\s+)?(?:מזוודות|מזוודה|תיקים|תיקי נסיעה|bags|suitcases)`, 'iu'));
  const passengerCount = statedCount(passengers?.[1] ?? passengers?.[2] ?? '');
  const luggageCount = statedCount(luggage?.[1] ?? '');
  if (passengerCount !== null) draft.passengers = passengerCount;
  if (luggageCount !== null) draft.luggage = luggageCount;
  if (/מזווד.{0,18}גדול|large (?:bags|suitcases|luggage)/i.test(input)) draft.luggageSize = 'large';
  if (/אנחנו זוג|זוג עם|שני אנשים|שני נוסעים|we are a couple|two of us/i.test(input)) draft.passengers = 2;
  // Count the child as a passenger when the customer explicitly describes a
  // couple travelling with one. A five-year-old is not luggage or a seat count.
  const coupleWithChild = /(?:זוג|שני (?:מבוגרים|אנשים)).{0,45}(?:עם|ו[- ]?).{0,20}(?:תינוק|ילד(?:ה)?(?: אחד(?:ת)?)?)|(?:my (?:wife|husband|partner|spouse) and I|myself and my (?:wife|husband|partner|spouse)|two adults?).{0,90}(?:(?:with|and) (?:our|a|one) (?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[- ]year[- ]old|with (?:our|a|one) (?:child|kid|baby|infant|son|daughter)|and (?:one|a) (?:child|kid|baby|infant))/i.test(input);
  if (coupleWithChild) draft.passengers = 3;
  if (/my (?:wife|husband|partner|spouse) and I.{0,90}with our \d{1,2}[- ]year[- ]old/i.test(input)) draft.passengers = 3;
  if (draft.luggage === undefined && /מזוודה(?!ות)|תיק(?: נסיעה)? אחד|one suitcase|one bag/i.test(input)) draft.luggage = 1;
  if (/תינוק|baby|infant/i.test(input)) draft.childSeats ??= 1;
  if (/(?:can (?:you|we) (?:provide|add|include|arrange)|do you (?:provide|have|offer)|אפשר (?:לקבל|להוסיף)|תוכלו (?:לספק|להוסיף)).{0,18}(?:child seat|car seat|כיסא בטיחות)/i.test(input)) draft.childSeats ??= 1;
  if (/אדם אחד|איש אחד|נוסע אחד|נוסעת אחת|אני לבד|(?:^|\s)לבד(?:\s|$)|\b(?:one person|solo|travelling alone|traveling alone)\b/i.test(input)) draft.passengers = 1;
}

function explicitVehicleNeed(input: string, locale: Locale): string | null {
  if (/שבעה מקומות|7\s*מקומות|7[- ]?seater|seven[- ]?seater/i.test(input)) return locale === 'he' ? 'רכב שבעה מקומות' : 'seven-seat car';
  if (/רכב\s+משפחתי|רכב\s+למשפחה|^\s*משפחתית\s*$|(?:רוצה|מחפש|צריך|מעדיף)\s+(?:רכב\s+)?משפחתית|(?:רוצה|מחפש|צריך|מעדיף)\s+משפחתי|family car/i.test(input)) return locale === 'he' ? 'רכב משפחתי' : 'family car';
  if (/קומפקטי|קומפקטית|רכב קטן|compact (?:rental )?car|small (?:rental )?car/i.test(input)) return locale === 'he' ? 'רכב קומפקטי' : 'compact car';
  if (/רכב פנאי|ג[׳'י]?יפ(?:ון)?|suv/i.test(input)) return locale === 'he' ? 'רכב פנאי' : 'SUV';
  return null;
}

function customerVehicleChoice(input: string, state: RebuildState): string | null {
  if (/^(?:ו?מה אם|האם|אולי|למה|מה לגבי|what if|would|should|could)\s/iu.test(input)) return null;
  const vehicle = '(?:רכב\\s+)?(?:שבעה\\s+מקומות|7\\s*מקומות|משפחתית|משפחתי|קטן|קומפקטית|קומפקטי|פנאי|ג[׳\'י]?יפ(?:ון)?|compact(?:\\s+rental)?\\s+car|small(?:\\s+rental)?\\s+car|family\\s+car|suv|seven[- ]?seat(?:er)?)';
  const choice = new RegExp(`(?:רוצה|רוצים|צריך|צריכה|צריכים|מחפש|מחפשת|מעדיף|מעדיפה|אבחר|נבחר|בחרתי|בחרנו|נלך על|אלך על|אקח|want|need|prefer|choose|chose|looking for|would like|go with)\\s+(?:(?:לשכור|להזמין|to rent|to book|an?)\\s+)?(${vehicle})`, 'giu');
  const matches = [...input.matchAll(choice)].filter(match => !/(?:לא|don'?t)\s*$/iu.test(input.slice(0, match.index)));
  const chosen = matches.at(-1)?.[1];
  if (chosen) return explicitVehicleNeed(chosen, state.locale);
  if (explicitBooking(input) && !/(?:לא רוצה|don't want|do not want)/iu.test(input)) return explicitVehicleNeed(input, state.locale);
  const statedPreference = input.match(new RegExp(`(${vehicle})\\s+(?:עדיף|עדיפה|מתאים\\s+לי|מתאים\\s+לנו|works better|is better for us)`, 'iu'))?.[1];
  if (statedPreference && !/[?؟]/u.test(input)) return explicitVehicleNeed(statedPreference, state.locale);
  if (/[?؟]/u.test(input) || /(?:לא רוצה|לא מעדיף|don't want|do not want)/iu.test(input)) return null;
  const lastBot = state.history.at(-1)?.text ?? '';
  return state.phase === 'booking' && (state.step === 'rental_vehicle' || /איזה סוג רכב|what kind of car/i.test(lastBot) || input.trim().length <= 20)
    ? explicitVehicleNeed(input, state.locale) : null;
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
  const noInjuries = /אין נפגעים|לא (?:היו )?נפגעים|אף אחד לא נפגע|no injuries|nobody was injured|no one was injured/i.test(input);
  if (reportedRentalDamage(input)) return 'accident';
  if (/תאונה|התנגשות|פצוע|accident|crash|collision/i.test(input) || !noInjuries && /(?<!לא )נפגע|(?<!not )injured/i.test(input)) return 'accident';
  if (/פנצ[׳']?ר|נתקעתי|לא (?:מניע|מתניע|התניע|נדלק)|רעש.{0,25}בלמ|בלמ.{0,25}רעש|עשן|תקלה ברכב|flat tire|breakdown|won'?t start|brake.{0,25}(?:noise|problem)|(?:noise|problem).{0,25}brake|(?:אני צריך|אני זקוק|תשלחו|שולחים).{0,25}גרר|גרר.{0,15}(?:עכשיו|דחוף)|(?:need|send).{0,25}tow|tow.{0,15}(?:now|urgent)/i.test(input)) return 'breakdown';
  return null;
}

function reportedRentalDamage(input: string): boolean {
  return /(?:רכב(?:י|נו)? השכור|הרכב השכור|רכב ששכרתי|שכרתי (?:את )?הרכב|(?:my|the|our) rental car|car (?:i|we) rented)/i.test(input)
    && /שרט|שריט|שפשוף|נזק|מכה(?:\s+(?:בדלת|בחניה|ברכב))?|פגיעה|scratch|scrap(?:e|ed)|dent|damage/i.test(input);
}

function commercialReply(input: string, state: RebuildState): { reply: string; escalate: boolean } {
  const he = state.locale === 'he';
  const previous = state.history.filter(item => item.from === 'customer').map(item => item.text).join(' ');
  const context = `${previous} ${input}`;
  const lastBot = [...state.history].reverse().find(item => item.from === 'bot')?.text ?? '';
  const acceptsTeamCheck = /(?:הצוות יבדוק|הצוות יוכל לבדוק|נציג.{0,25}יחזור|נשמח להכין.{0,50}הצעה|team (?:check|review)|team to review|representative.{0,25}follow up|happy to prepare.{0,50}(?:quote|offer))/i.test(lastBot)
    && (affirms(input)
      || /שהצוות|שיבדקו|תבדקו|תעביר|לפי מה שכבר|אין לי העדפה|אין העדפה|לא משנה|no preference|go ahead|please do/i.test(input));
  const asksTeamReview = /תעביר(?:ו)?\s+(?:את זה|את הפרטים|את הבקשה|את הפנייה|לצוות|לנציג|להצעה)|אפשר לקבל הצעה|תכינו (?:לי )?הצעה|אשמח להצעה|שהצוות יבדוק|שיבדקו בשבילי|שהצוות יחזור אלי|שיחזרו אלי|תחזרו אלי|(?:have|ask) the team (?:check|review)|(?:can|could) I get (?:a |an )?(?:quote|offer)|please (?:send|prepare) (?:a |an )?(?:quote|offer)|pass (?:this|it|the details) to (?:the )?team|send (?:this|it) to (?:the )?team|(?:team|someone).{0,15}call me back/i.test(input);
  const asksNextStep = /מה (?:צריך|הצעד הבא|השלב הבא|תצטרכו).{0,25}(?:להתקדם|הלאה|הצעה)?|איך (?:מתקדמים|ממשיכים)|what.*(?:need|next step|proceed)|how.*(?:proceed|continue)/i.test(input);
  if (state.interest === 'leasing') {
    if (/איך (?:אני )?מקבל(?:ת)? הצעה|איך (?:אפשר|מקבלים) לקבל הצעה|how (?:do|can) I get (?:a |an )?(?:quote|offer)/i.test(input)) {
      const hasTerm = /לשנה|שנה|שנתיים|שנים|חודש|year|month/i.test(previous);
      const hasMileage = /קילומ|ק״מ|קמ|mileage|km/i.test(previous);
      const hasVehicle = /משפחת|קומפקט|עירונ|פנאי|ג[׳'י]?יפ|סדאן|קטן|family|compact|suv|sedan|small car/i.test(previous);
      return { reply: hasTerm && hasMileage && hasVehicle
        ? (he ? 'כדי לקבל הצעת ליסינג, אפשר להעביר לנציג SmartCar את התקופה, הקילומטראז׳ והעדפת הרכב שכבר מסרת. הוא יחזור אליך עם פירוט התשלום והתנאים. תרצה שאעביר את הפרטים?' : 'To get a leasing offer, I can pass the term, mileage and vehicle preference you gave to a SmartCar representative. They will follow up with the payment and terms. Would you like me to pass on the details?')
        : (he ? `כדי לקבל הצעת ליסינג נצטרך ${[!hasTerm && 'משך תקופה', !hasMileage && 'הערכת קילומטראז׳ לשנה', !hasVehicle && 'העדפת סוג רכב'].filter(Boolean).join(' ו')}. אפשר גם לומר אם אין עדיין העדפה; אחרי שנרשום את הפרטים נציג SmartCar יחזור אליכם עם הצעה.` : `To prepare a leasing offer, please share ${[!hasTerm && 'your preferred term', !hasMileage && 'estimated annual mileage', !hasVehicle && 'a vehicle preference'].filter(Boolean).join(' and ')}. If you have no preference yet, just say so; a SmartCar representative can then follow up with an offer.`), escalate: false };
    }
    if (/הבדל|difference|compare/i.test(input) && /השכרה|לשכור|rent/i.test(input)) return { reply: he ? 'השכרה מתאימה בדרך כלל לתקופה קצרה וגמישה יותר; ליסינג הוא מסלול לתקופה ארוכה יותר עם תנאים ותשלום שנקבעים בהצעה. אם מדובר בחודש אחד, נוכל לבדוק השכרה. לכמה זמן תצטרך את הרכב?' : 'Rental usually fits a shorter, more flexible period; leasing is a longer plan with terms and payments set in an offer. For a month, we can check a rental. How long do you need the car?', escalate: false };
    if (/הבדל|difference|compare/i.test(input)) return { reply: he ? 'ליסינג פרטי מיועד לשימוש אישי, ועסקי לצורכי העסק. ההתחייבויות, השירותים והמחיר נקבעים רק בהצעה ובחוזה של המסלול המתאים. תרצה לבדוק מסלול פרטי או עסקי?' : 'Private leasing serves personal use; business leasing serves a company. Commitments, services and price are set in the specific offer and contract. Which route would you like us to check?', escalate: false };
    if (/לא יודע איזה סוג רכב|לא יודעת איזה סוג רכב|אין לי העדפה לסוג רכב|not sure (?:which|what) (?:car|vehicle)|no vehicle preference/i.test(input)) return { reply: he ? 'אין צורך לבחור דגם עכשיו. אם תספר לי אם השימוש בעיקר עירוני, משפחתי או לנסיעות ארוכות, אוכל להציע קבוצה להתחיל ממנה; אפשר גם להעביר את הפרטים לנציג שיעזור לבחור.' : 'You do not need to pick a model now. Tell me whether the driving is mainly urban, family trips or longer journeys and I can suggest a starting group; a representative can help you choose too.', escalate: false };
    if (/מה אתה ממליץ|מה את ממליצה|מה היית ממליץ|what (?:do you|would you) recommend/i.test(input) && !/משפחת|קומפקט|עירונ|פנאי|ג[׳'י]?יפ|סדאן|קטן|family|compact|suv|sedan|small car/i.test(context)) return { reply: he ? 'בלי לדעת כמה נוסעים וציוד יהיו, הייתי משווה קומפקטית לשימוש עירוני מול משפחתית אם חשוב יותר מקום. אפשר לציין בהצעה שאין עדיין העדפה ולהתאים את הקבוצה עם נציג.' : 'Without passenger and luggage needs, I would compare a compact for urban use with a family car if more space matters. We can note that the group is still open and refine it with a representative.', escalate: false };
    if (/מה כלול|מה כולל|מה מקבלים|what(?:'s| is) included|what does it include/i.test(input)) {
      const alreadyAnswered = state.history.some(item => item.from === 'bot' && /מה שכלול בליסינג|what is included depends/i.test(item.text));
      return { reply: alreadyAnswered
        ? (he ? 'בהצעה האישית נפרט את התשלום, הביטוח, השירותים ומגבלת הקילומטרים. מה כלול בפועל נקבע לפי המסלול והרכב שייבחרו.' : 'The personal proposal will set out payment, cover, services and mileage. What is included depends on the chosen plan and car.')
        : (he ? 'מה שכלול בליסינג תלוי במסלול ובהצעה האישית, למשל שירותים, ביטוח ומגבלת קילומטרים. נציג SmartCar יפרט את התנאים בהצעה לפני החלטה. תרצה שנכין הצעה לפי הפרטים שכבר מסרת?' : 'What is included depends on the plan and personal offer, including services, insurance and mileage. A SmartCar representative will set out the terms before you decide. Would you like an offer using the details you gave?'), escalate: false };
    }
    if (/תשלום ראשוני|מקדמה|דמי פתיחה|initial payment|down payment|deposit/i.test(input)) return { reply: he ? 'תשלום ראשוני, אם נדרש, יופיע בהצעה של המסלול והרכב שתבחרו. נשמח לצרף את השאלה להצעה האישית כדי שתקבלו פירוט ברור.' : 'Any initial payment will be stated in the offer for your chosen plan and car. We can include this question so the proposal clearly sets out the terms.', escalate: false };
    if (/מחיר|חודשי|תשלום|כמה|price|monthly|cost/i.test(input)) return { reply: he ? 'התשלום החודשי תלוי במסלול, בסוג הרכב, בתקופה ובקילומטראז׳. נשמח להכין לכם הצעה אישית לפי הפרטים שכבר מסרתם.' : 'The monthly payment depends on the plan, vehicle, term and mileage. We will be happy to prepare a personal offer using the details you have given.', escalate: false };
    if (asksNextStep) {
      if (!/לשנה|שנה|שנתיים|שנים|חודש|year|month/i.test(context)) return { reply: he ? 'כדי להתקדם להצעת ליסינג, נתחיל במשך התקופה הרצוי. לכמה זמן תצטרכו את הרכב?' : 'To prepare a leasing proposal, let us start with the term. How long do you need the car?', escalate: false };
      if (!/קילומ|ק״מ|קמ|mileage|km/i.test(context)) return { reply: he ? 'משך התקופה כבר רשום. כדי להכין הצעה מדויקת נצטרך גם הערכת קילומטראז׳ לשנה והעדפת רכב; אם עדיין אין הערכה אפשר לציין זאת לנציג.' : 'I have the term. A proposal also needs an annual mileage estimate and vehicle preference; if you are unsure, we can note that for a representative.', escalate: false };
      if (!/משפחת|קומפקט|עירונ|פנאי|ג[׳'י]?יפ|סדאן|קטן|family|compact|suv|sedan|small car/i.test(context)) return { reply: he ? 'כדי להתקדם להצעה יש לי כבר את התקופה והקילומטראז׳. השלב הבא הוא לבחור איזה סוג רכב תרצו בהצעה; אם עדיין אין העדפה אוכל להעביר את הפרטים לנציג שיעזור לבחור.' : 'I have your term and mileage. The next step is to choose a vehicle type for the proposal; if you have no preference, I can pass the details to a representative to help you choose.', escalate: false };
      return { reply: he ? 'יש לי את משך התקופה, הקילומטראז׳ וסוג הרכב שציינת. תרצה שאעביר אותם לנציג להכנת הצעה מפורטת?' : 'I have your term, mileage and vehicle type. Would you like me to pass them to a representative for a detailed offer?', escalate: false };
    }
    if (acceptsTeamCheck || asksTeamReview || /תתקדמו|נסגור|יאללה|go ahead|let's close/i.test(input)) return { reply: he ? `תודה, קיבלנו את הפרטים להצעת ליסינג אישית. נציג SmartCar יחזור אליכם להמשך; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your details for a personal leasing offer. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`, escalate: true };
    if (!/לשנה|שנה|שנתיים|שנים|חודש|year|month/i.test(context)) return { reply: he ? 'ב־SmartCar אפשר לבדוק ליסינג פרטי או עסקי. לכמה זמן תרצה את הרכב?' : 'SmartCar can check private or business leasing. What term do you have in mind?', escalate: false };
    if (!/קילומ|ק״מ|קמ|mileage|km/i.test(context)) return { reply: he ? 'רשמתי את משך הליסינג. כמה קילומטרים בערך תיסע בשנה?' : 'I have the term. Roughly how many kilometres would you drive each year?', escalate: false };
    if (!/משפחת|קומפקט|עירונ|פנאי|ג[׳'י]?יפ|סדאן|קטן|family|compact|suv|sedan|small car/i.test(context)) return { reply: he ? 'רשמתי את התקופה ואת הקילומטראז׳ שציינת. איזה סוג רכב תרצו בהצעה האישית?' : 'I have the term and mileage you mentioned. What vehicle type would you like in your personal offer?', escalate: false };
    return { reply: he ? 'יש לנו את התקופה, הקילומטראז׳ וסוג הרכב שביקשתם. תרצו שנציג SmartCar יחזור אליכם עם הצעת ליסינג?' : 'We have the term, mileage and vehicle type you requested. Would you like a SmartCar representative to follow up with a leasing offer?', escalate: false };
  }
  const saleMessages = [...state.history.filter(item => item.from === 'customer').map(item => item.text), input];
  let hasType = false;
  for (const message of saleMessages) {
    if (/לא החלטתי על סוג|לא החלטתי איזה רכב|לא יודע איזה סוג|אין לי העדפה לסוג|not sure (?:which|what) (?:type|car|vehicle)|haven't decided (?:on|which) (?:type|car|vehicle)/i.test(message)) hasType = false;
    else if (/^(?:רכב )?(?:משפחתי|משפחתית|קומפקטי|קטן|פנאי|ג[׳'י]?יפון|SUV|family car|compact car|small car)(?:\s+בתקציב.*)?[.!\s]*$/i.test(message)
      || /(?:רוצה|מחפש(?:ת)?|צריך|מעדיף|מעוניין|לקנות|looking for|want|need|prefer|buy).{0,40}(?:רכב\s+)?(?:משפחתי|משפחתית|קומפקט|קטן|פנאי|ג[׳'י]?יפ|סדאן|family|compact|small car|suv|sedan)/i.test(message)) hasType = true;
  }
  const hasBudget = /תקציב|אלף|שקל|₪|budget|shekel/i.test(context);
  if (/איך (?:אני )?מקבל(?:ת)? הצעה|איך (?:אפשר|מקבלים) לקבל הצעה|how (?:do|can) I get (?:a |an )?(?:quote|offer)/i.test(input)) {
    return { reply: hasType && hasBudget
      ? (he ? 'כדי לקבל הצעה, נציג SmartCar יכול לבדוק רכבים לפי הסוג והתקציב שכבר מסרת ולחזור עם פרטי האפשרויות והמחירים. תרצה שאעביר לו את הפנייה?' : 'A SmartCar representative can check cars against the type and budget you gave, then follow up with details and prices. Would you like me to pass on your enquiry?')
      : hasType
        ? (he ? 'כדי לקבל הצעה, נציג SmartCar יבדוק רכבים מהסוג שביקשת ויחזור עם האפשרויות והמחירים. אם יש לך תקציב רצוי, אפשר לציין אותו כדי למקד את הבדיקה. תרצה שאעביר לו את הפנייה?' : 'A SmartCar representative can check the vehicle type you requested and follow up with options and prices. If you have a budget, you can share it to narrow the search. Would you like me to pass on your enquiry?')
        : (he ? `אפשר לקבל הצעה גם לפני שבוחרים סוג רכב. נציג SmartCar יוכל להציע אפשרויות לפי השימוש שלכם${hasBudget ? ' והתקציב שציינתם' : '. אם יש טווח תקציב, אפשר לציין אותו כדי למקד את הבדיקה'}. הנציג יפרט את המחירים לפני החלטה. תרצה שאעביר את הפנייה?` : `You can request an offer before choosing a car type. A SmartCar representative can suggest options based on your needs${hasBudget ? ' and the budget you gave' : '. A budget range can help narrow them'}. They will explain prices before you decide. Would you like me to pass on your enquiry?`), escalate: false };
  }
  if (acceptsTeamCheck || asksTeamReview) return { reply: he ? `תודה, קיבלנו את ההעדפות שלכם לרכישת רכב. נציג SmartCar יחזור אליכם עם האפשרויות המתאימות; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your vehicle preferences. A SmartCar representative will follow up with suitable options; you can also call ${OFFICE_PHONE}.`, escalate: true };
  const lowMileage = /קילומטראז[׳'״]?\s+נמוך|קילומטרים נמוכים|low mileage/i.test(context);
  if (/לא החלטתי על סוג|לא החלטתי איזה רכב|לא יודע איזה סוג|אין לי העדפה לסוג|not sure (?:which|what) (?:type|car|vehicle)|haven't decided (?:on|which) (?:type|car|vehicle)/i.test(input)) return { reply: he ? 'אין צורך לבחור סוג עכשיו. אפשר להתחיל ממספר הנוסעים, אופי הנסיעות והתקציב, ואז להציע כיוון מתאים. מה השימוש העיקרי ברכב?' : 'You do not need to choose a type yet. We can start with passenger needs, driving and budget, then suggest a suitable group. How will you mainly use the car?', escalate: false };
  if (/מה (?:אתה|את|היית) (?:מציע|ממליץ)(?:ה)? למשפחה|what (?:would you |do you )?recommend for (?:a |my )?family/i.test(input)) return { reply: he ? 'לשימוש משפחתי הייתי מתחיל בבדיקת רכב משפחתי עם מקום שמתאים למספר הנוסעים ולציוד. אם מדובר בשישה נוסעים או יותר, נשווה גם שבעה מקומות. כמה אנשים נוסעים בדרך כלל?' : 'For family use I would start by checking a family car with space for your passengers and luggage. For six or more passengers, we can compare seven-seat cars too. How many people usually travel?', escalate: false };
  if (hasBudget && /^(?:רכב )?(?:משפחתי|משפחתית|קומפקטי|קטן|רכב פנאי|ג[׳'י]?יפון|SUV)[.!\s]*$/i.test(input)) return { reply: he ? 'רשמתי את סוג הרכב שבחרת לצד התקציב. נציג SmartCar יוכל לבדוק אפשרויות שמתאימות לשניהם ולהציג לך את פרטי הרכב והמחיר לפני החלטה. תרצה שאעביר את הפנייה?' : 'I have your chosen vehicle type and budget. A SmartCar representative can check matching options and show each car’s details and price before you decide. Would you like me to pass on your enquiry?', escalate: false };
  if (/מה כולל השירות|מה כלול בשירות|what(?:'s| is) included in (?:the )?(?:service|purchase)/i.test(input)) {
    const answeredBefore = state.history.some(item => item.from === 'bot' && /ברכישת רכב נוכל לעזור|For a car purchase we can help/i.test(item.text));
    return { reply: answeredBefore
      ? (he ? 'נציג יבדוק עבורך רכבים לפי הסוג, התקציב וההעדפות שציינת, יציג את פרטיהם ויוכל לסייע בתיאום נסיעת מבחן בכפוף לזמינות.' : 'A representative can check cars against the type, budget and preferences you gave, share their details and help arrange a test drive subject to availability.')
      : (he ? 'ברכישת רכב נוכל לעזור בחיפוש לפי הצרכים והתקציב, להציג פרטים על אפשרויות מתאימות ולתאם נסיעת מבחן בכפוף לזמינות. מחיר ותנאי העסקה יוצגו לפני החלטה.' : 'For a car purchase we can help find options matching your needs and budget, share their details and arrange a test drive subject to availability. The price and terms are presented before you decide.'), escalate: false };
  }
  if (/חשוב לי קילומטראז[׳'״]?\s+נמוך|מעדיף קילומטראז[׳'״]?\s+נמוך|low mileage (?:matters|is important|preferred)/i.test(input)) return { reply: he ? 'רשמתי שחשוב לך קילומטראז׳ נמוך לצד סוג הרכב והתקציב שציינת. נוכל לחפש אפשרויות מתאימות ולהציג את הנתון של כל רכב לפני החלטה.' : 'I have noted that low mileage matters, along with your vehicle type and budget. We can check suitable cars and show each vehicle’s mileage before you decide.', escalate: false };
  if (/אפשר(?:ות)? לראות (?:אותו|את הרכב)|אפשר לבוא לראות|can I (?:see|view) (?:it|the car)|can I come (?:see|view)/i.test(input)) return { reply: he ? 'בשמחה. כשנמצא רכב מסוים שמתאים לך, אפשר לתאם צפייה ונסיעת מבחן בכפוף לזמינות. תרצה שנציג יחזור אליך עם אפשרויות?' : 'Of course. Once we find a specific car that suits you, we can arrange a viewing and test drive subject to availability. Would you like a representative to follow up with options?', escalate: false };
  if (/מחיר|כמה עולה|עלות|price|cost/i.test(input)) return { reply: he ? `המחיר תלוי ברכב המסוים, בשנתון ובמצבו. ${hasBudget ? 'נוכל לבדוק אפשרויות שמתאימות לתקציב שכבר ציינת. תרצה שנציג SmartCar יחזור אליך עם הצעה?' : /תקציב|budget/i.test(lastBot) ? 'נשמח לבדוק רכבים מתאימים ולהציג לך את המחיר המדויק לכל אפשרות.' : 'איזה תקציב תרצה שנביא בחשבון?'}` : `The price depends on the specific car, its year and condition. ${hasBudget ? 'We can check options within the budget you gave. Would you like a SmartCar representative to follow up with an offer?' : /budget/i.test(lastBot) ? 'We can check suitable cars and show you the exact price for each option.' : 'What budget would you like us to consider?'}`, escalate: false };
  if (/דגמים|מלאי|זמינ|זמין|פנוי|אפשרויות|מה יש לכם|איזה רכבים יש|מה יש|what cars|what options|models|stock|available/i.test(input)) {
    if (hasType && hasBudget) {
      const askedBefore = state.history.some(item => item.from === 'bot' && /אפשרויות הזמינות|available options/i.test(item.text));
      return { reply: askedBefore
        ? (he ? 'כדי לתת תשובה מדויקת על זמינות נבדוק דגמים מסוימים שמתאימים לסוג ולתקציב שציינת. נציג SmartCar יוכל לחזור עם האפשרויות העדכניות.' : 'Availability needs checking for specific cars matching the type and budget you gave. A SmartCar representative can follow up with current options.')
        : (he ? 'נשמח לבדוק דגמים שמתאימים לסוג הרכב ולתקציב שציינת. תרצה שנציג SmartCar יחזור אליך עם האפשרויות הזמינות?' : 'We can check models matching the type and budget you gave. Would you like a SmartCar representative to follow up with available options?'), escalate: false };
    }
    if (hasType) return { reply: he ? 'כדי לענות על זמינות צריך לבדוק רכב מסוים. נוכל לחפש רכב מהסוג שמעניין אותך, ואם תציין טווח תקציב נוכל לצמצם את האפשרויות.' : 'Availability needs checking for a specific car. We can look for the type you want, and a budget range would help narrow the options.', escalate: false };
    return { reply: he ? 'נשמח לבדוק אילו רכבים מתאימים לשימוש שלכם. זמינות מחייבת בדיקה של רכב מסוים; טווח תקציב יעזור למקד את האפשרויות גם בלי לבחור סוג עכשיו. תרצה שנציג SmartCar יחזור אליך עם אפשרויות?' : 'We can check cars that fit your needs. Availability must be checked for a specific car; a budget range can narrow the options even if you have not chosen a type yet. Would you like a SmartCar representative to follow up with options?', escalate: false };
  }
  if (/נסיעת מבחן|test drive/i.test(input)) {
    const requested = /רוצה (?:לקבוע|לתאם|נסיעת מבחן)|תתאמו|תקבעו|book|schedule|arrange/i.test(input);
    return { reply: he ? `${requested ? 'קיבלנו את הבקשה לנסיעת מבחן. ' : ''}נשמח לתאם נסיעת מבחן בכפוף לזמינות הרכב ולאישור התור. אפשר להתקשר ל־${OFFICE_PHONE}.` : `${requested ? 'We have your test drive request. ' : ''}We will be happy to arrange a test drive, subject to vehicle availability and appointment confirmation. You can call ${OFFICE_PHONE}.`, escalate: requested };
  }
  if (asksNextStep) return !hasType
    ? { reply: he ? 'אפשר להתקדם גם בלי לבחור דגם עכשיו. נתחיל בטווח תקציב ובשימוש העיקרי ברכב, ונציג יוכל לעזור להשוות אפשרויות.' : 'You can move forward without choosing a model now. A budget range and the main use will help a representative compare options.', escalate: false }
    : !hasBudget
      ? { reply: he ? 'רשמתי את סוג הרכב. איזה תקציב תרצה שנביא בחשבון?' : 'I have the car type. What budget should we consider?', escalate: false }
      : { reply: he ? `יש לי את סוג הרכב, התקציב${lowMileage ? ' וההעדפה לקילומטראז׳ נמוך' : ''} שציינת. ${lowMileage ? 'השלב הבא הוא שנציג יבדוק אפשרויות מתאימות ויחזור אליך. תרצה שאעביר את הפנייה?' : 'אם יש העדפה לשנתון או לקילומטראז׳ אפשר להוסיף אותה; אפשר גם להעביר את הפרטים לנציג שיחזור עם אפשרויות. תרצה שאעביר?'}` : `I have your vehicle type, budget${lowMileage ? ' and low-mileage preference' : ''}. ${lowMileage ? 'The next step is for a representative to check suitable options and follow up. Would you like me to pass on your enquiry?' : 'You can add a preferred year or mileage, or I can pass the details to a representative for options. Would you like me to do that?'}`, escalate: false };
  if (/נסגור|יאללה|תתקדמו|go ahead|let's close/i.test(input)) return { reply: he ? `תודה, קיבלנו את הפרטים לבדיקת רכישה. נציג SmartCar יחזור אליכם עם האפשרויות המתאימות; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your purchase enquiry. A SmartCar representative will follow up with suitable options; you can also call ${OFFICE_PHONE}.`, escalate: true };
  if (!hasType) return { reply: hasBudget
    ? (he ? 'רשמתי את התקציב שציינת. עדיין לא בחרנו סוג רכב, וזה בסדר; נציג SmartCar יוכל לבדוק אפשרויות לפי השימוש שלכם ולחזור עם פרטים ומחירים. תרצה שאעביר את הפנייה?' : 'I have your budget. You have not chosen a vehicle type yet, and that is fine; a SmartCar representative can check options for your needs and follow up with details and prices. Would you like me to pass on the enquiry?')
    : (he ? 'איזה סוג רכב תרצה לקנות?' : 'What kind of car would you like to buy?'), escalate: false };
  if (!hasBudget) return { reply: he ? 'איזה תקציב תרצה שנבדוק?' : 'What budget should we check?', escalate: false };
  return { reply: he ? lowMileage ? 'רשמתי את סוג הרכב, התקציב וההעדפה לקילומטראז׳ נמוך. תרצה שנציג SmartCar יחזור עם אפשרויות מתאימות?' : 'רשמתי את סוג הרכב והתקציב שציינתם. יש שנתון או קילומטראז׳ שחשובים לכם, או שתרצו שנציג SmartCar יחזור אליכם עם אפשרויות?' : lowMileage ? 'I have your vehicle type, budget and low-mileage preference. Would you like a SmartCar representative to follow up with matching options?' : 'I have the vehicle type and budget you mentioned. Do you have a preferred year or mileage, or would you like a SmartCar representative to follow up with options?', escalate: false };
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
  if (people === 1) return 'compact';
  if (/טיול משפחתי|נסיעה משפחתית|family trip/i.test(input)) return 'family';
  if (/פגיש|עיר|חניה|city|meeting|parking/i.test(input)) return 'compact';
  return hasVehicleContext(draft, input) && reading?.direction && reading.direction !== 'none' ? reading.direction : 'none';
}

function advice(input: string, state: RebuildState, reading: BotReading | null): string {
  const he = state.locale === 'he';
  const datesUndecided = !state.booking.pickupDate && (uncertainDateAnswer(input)
    || state.history.some(entry => entry.from === 'customer' && uncertainDateAnswer(entry.text)));
  const waitForDates = he
    ? 'אפשר לבחור כיוון לרכב כבר עכשיו; זמינות ומחיר נבדוק כשתדעו את התאריכים.'
    : 'We can choose a car group now and check availability and price when you know the dates.';
  const budgetLed = /רכב זול|זול לשבוע|מחיר חשוב|lowest price|cheap rental/i.test(input)
    || state.history.some(entry => entry.from === 'customer' && /רכב זול|זול לשבוע|מחיר חשוב|lowest price|cheap rental/i.test(entry.text));
  if (/מחפש רכב זול לשבוע|מחפשת רכב זול לשבוע|looking for a cheap rental for a week/i.test(input)) return he
    ? 'לשבוע השכרה הייתי מתחיל בבדיקת קבוצה קומפקטית, ואז משווה הצעה לפי התאריכים והתנאים. כמה אנשים וציוד יהיו בנסיעה?'
    : 'For a week I would start by checking the compact group, then compare a quote for your dates and terms. How many people and bags will travel?';
  if (budgetLed && /מה תציעו לי|מה היית מציע|what (?:would you|do you) (?:suggest|recommend)/i.test(input)) return he
    ? 'הייתי מתחיל מקבוצה קומפקטית, שבדרך כלל מתאימה לנסיעה של אדם אחד או שניים עם מעט ציוד. אם תספר כמה נוסעים וציוד יש, אדייק את ההמלצה; אפשר גם להמשיך בלי זה.'
    : 'I would start with the compact group for one or two people with light luggage. Tell me your group and luggage if you want a more specific recommendation; we can continue without that too.';
  if (budgetLed && /מה הכי מתאים לדעתך|איזו קבוצה הכי מתאימה|which (?:group|class) fits best/i.test(input)) return he
    ? state.booking.passengers === 1
      ? 'לנסיעה לבד, כשחשוב לשמור על התקציב, קומפקטית היא הקבוצה הראשונה שהייתי בודק. מחיר מדויק נקבע לפי התאריכים וההצעה.'
      : 'כשמחיר חשוב והצרכים עוד לא סגורים, קומפקטית היא נקודת פתיחה לבדיקה. אם יהיו כמה נוסעים או ציוד רב, נשווה גם קבוצה גדולה יותר.'
    : state.booking.passengers === 1
      ? 'For solo travel with a budget in mind, a compact is the first group I would check. The exact price depends on your dates and quote.'
      : 'With price in mind, a compact is a starting point. If more people or bags are travelling, we can compare a larger group.';
  if (budgetLed && /אני נוסע לבד|אני נוסעת לבד|I(?:'m| am) travelling alone/i.test(input)) return he
    ? 'רשמתי שתיסע לבד. קומפקטית היא הקבוצה הראשונה שהייתי בודק עבורך, בלי לקבוע מחיר לפני שנדע תאריכים ותנאים.'
    : 'I have noted that you are travelling alone. A compact is the first group I would check, with the price confirmed once dates and terms are known.';
  if (/זה נשמע יקר|נשמע יקר|sounds expensive/i.test(input)) return he
    ? 'מבין. נוכל להתחיל מקבוצה קומפקטית ולבדוק הצעה לפי התאריכים כשתדע אותם. אם יש תקציב יומי שנוח לך, אוכל לציין אותו בבקשה.'
    : 'I understand. We can start with a compact group and check a quote when you know the dates. If you have a daily budget, I can include it in the request.';
  const workDay = /יום אחד לעבודה|one day for work/i.test(input)
    || state.history.some(entry => entry.from === 'customer' && /יום אחד לעבודה|one day for work/i.test(entry.text));
  if (workDay && /צריך רכב ליום אחד לעבודה|need a car for one day for work/i.test(input)) return he
    ? 'בשמחה. ליום עבודה אפשר להתחיל בבדיקת רכב קומפקטי, ולבחור לפי מספר הנוסעים והציוד. כמה אנשים וציוד יהיו איתך?'
    : 'Of course. For one workday a compact is a good starting point, depending on passengers and luggage. How many people and bags will travel?';
  if (workDay && /רכב קטן יספיק|will a (?:small|compact) car be enough/i.test(input)) return he
    ? 'רכב קטן יכול להתאים ליום עבודה, אבל כדי לוודא צריך לדעת כמה נוסעים וכמה ציוד תביא. אם תיסע לבד עם תיק אחד, קומפקטי יהיה הכיוון הראשון לבדיקה.'
    : 'A compact could work for a workday, depending on passengers and luggage. If you travel alone with one bag, it is the first group I would check.';
  if (workDay && /מה הכי מתאים לדעתך|מה מתאים לי|what (?:fits|suits) me best/i.test(input)) return he
    ? 'ליום עבודה הייתי מתחיל ברכב קומפקטי, במיוחד אם מדובר בנסיעה לבד. אם יש הרבה ציוד או עוד נוסעים, נשווה גם משפחתית.'
    : 'For one workday I would start with a compact, especially for a solo trip. With more people or gear, we can compare a family car.';
  if (workDay && /אני נוסע לבד|אני נוסעת לבד|I(?:'m| am) travelling alone/i.test(input)) return he
    ? 'רשמתי שתיסע לבד. רכב קומפקטי הוא כיוון מתאים להתחיל ממנו ליום העבודה; אם יש ציוד גדול, נבדוק גם משפחתית.'
    : 'I have noted that you are travelling alone. A compact is a sensible starting point for the workday; with larger gear we can check a family car too.';
  if (workDay && /יש גם תיק אחד|one bag(?: as well)?/i.test(input)) return he
    ? 'רשמתי גם תיק אחד. לנסיעה לבד עם תיק, קומפקטי הוא כיוון טוב; את המקום לציוד נוודא בדגם המסוים כשתבחר רכב.'
    : 'I have noted one bag too. For a solo trip with one bag, a compact is a good direction; we will check space in the actual model.';
  if ((state.booking.passengers ?? 0) >= 5 && (state.booking.luggage ?? 0) >= 3) {
    if (/המזוודות גדולות|מזוודות גדולות|large suitcases|large bags/i.test(input)) return he
      ? `רשמתי שמדובר ב־${state.booking.luggage} מזוודות גדולות. ל־${state.booking.passengers} נוסעים הייתי בודק רכב פנאי מרווח או רכב שבעה מקומות, ולפני בחירה נוודא מקום לציוד בדגם המסוים.`
      : `I have noted ${state.booking.luggage} large bags. For ${state.booking.passengers} passengers I would check a roomy SUV or seven-seat car, then verify luggage space in the actual model.`;
    if (/איך נוודא מקום למטען|איך בודקים מקום למזוודות|how (?:can|do) we check luggage space/i.test(input)) return he
      ? `נבדוק את תא המטען בדגם המסוים כשהמושבים הנחוצים בשימוש, לפי שלוש המזוודות${state.booking.luggageSize === 'large' ? ' הגדולות' : ''} שציינת. אם יש מידות למזוודות, אפשר לצרף אותן לבקשה.`
      : `We will check boot space in the actual model with the needed seats in use, for the ${state.booking.luggage}${state.booking.luggageSize === 'large' ? ' large' : ''} bags you mentioned. You can include their dimensions if you have them.`;
    if (/האם ג[׳'י]?יפון יתאים|ג[׳'י]?יפון יתאים|will an? (?:small )?suv fit/i.test(input)) return he
      ? `ג׳יפון יכול להיות כיוון, אבל עם ${state.booking.passengers} נוסעים ו־${state.booking.luggage} מזוודות אי אפשר להבטיח מקום בלי לבדוק דגם מסוים. הייתי משווה רכב פנאי מרווח למשפחתית גדולה.`
      : `An SUV could work, but with ${state.booking.passengers} passengers and ${state.booking.luggage} bags we need to check the actual model before promising a fit. I would compare a roomy SUV and a large family car.`;
    if (/אולי יש כיוון אחר|יש אופציה אחרת|another direction|other option/i.test(input)) return he
      ? 'אפשר לבדוק גם רכב שבעה מקומות כדי להשאיר יותר גמישות למטען, אבל גם בו חשוב לבדוק את תא המטען כשהמושבים בשימוש.'
      : 'A seven-seat car is another option for more flexibility, though we still need to check boot space with the seats in use.';
    if (/מה הכי מתאים לדעתך|אז מה היית מציע|מה היית ממליץ|what (?:fits|suits) best|what would you suggest/i.test(input)) return he
      ? `ל־${state.booking.passengers} נוסעים ו־${state.booking.luggage} מזוודות${state.booking.luggageSize === 'large' ? ' גדולות' : ''} הייתי מתחיל בבדיקת רכב פנאי מרווח. נשווה גם משפחתית גדולה או שבעה מקומות לפי תא המטען בדגמים הזמינים.`
      : `For ${state.booking.passengers} passengers and ${state.booking.luggage}${state.booking.luggageSize === 'large' ? ' large' : ''} bags I would start with a roomy SUV, then compare a large family car or seven-seater by actual boot space.`;
  }
  if (state.booking.passengers === 1 && /קטן או משפחתי|קומפקטי או משפחתי|small or family|compact or family/i.test(input)) return he
    ? 'לנסיעה לבד ובעיקר בעיר הייתי מתחיל ברכב קומפקטי: קל יותר לתמרן ולחנות. משפחתית תהיה טובה אם חשוב לך יותר מקום לנוסעים או לציוד.'
    : 'For solo city driving I would start with a compact, which is easier to park and manoeuvre. A family car makes sense if you need more passenger or luggage space.';
  if (state.booking.passengers === 1 && /מה הכי מתאים לדעתך|מה מתאים לי|what (?:suits|fits) me best/i.test(input)) return he
    ? 'בשביל נסיעות עירוניות לבד, קומפקטי הוא הכיוון הראשון שלי. אם יש ציוד גדול או נסיעות ארוכות במיוחד, אפשר להשוות גם משפחתית.'
    : 'For solo city trips, a compact is my first choice. If you carry larger gear or take long trips, we can compare a family car too.';
  if (state.booking.passengers === 1 && /מה לגבי חניה|ומה לגבי חניה|parking/i.test(input)) return he
    ? 'רכב קומפקטי נוח בדרך כלל יותר לתמרון ולחניה בעיר. אם יש חניון עם מגבלת גובה או אורך, נבדוק את המידות של הדגם המסוים.'
    : 'A compact is generally easier to manoeuvre and park in town. If your garage has a height or length limit, we will check the exact model dimensions.';
  if (state.booking.passengers === 1 && /אולי יש כיוון אחר|יש אופציה אחרת|another direction|other option/i.test(input)) return he
    ? 'הכיוון השני הוא משפחתית, אם תרצה יותר מקום או נוחות בנסיעות ארוכות. לנסיעה לבד עדיין הייתי מתחיל בקומפקטי.'
    : 'A family car is the other direction if you want more room or comfort on longer drives. For solo travel, I would still start with a compact.';
  if (/אולי אשכור בסוף החודש|אולי בסוף החודש|maybe (?:rent|later) this month/i.test(input)) return he
    ? 'נשמע טוב. אפשר לבחור את קבוצת הרכב כבר עכשיו, וכשתדע את ימי האיסוף וההחזרה נבדוק זמינות והצעה מדויקת.'
    : 'That works. We can choose the vehicle group now, then check availability and a precise quote once you know your pickup and return dates.';
  if (/אפשר להוסיף כיסא בטיחות|can (?:i|we) add (?:a )?child seat/i.test(input)) return he
    ? 'אפשר לציין בבקשה צורך בכיסא בטיחות. נבדוק אפשרות לצרף כיסא מתאים ואת תנאיו לפני אישור ההשכרה; גם התאמת הכיסא לרכב המסוים תיבדק.'
    : 'We can include a child-seat request. We will check a suitable seat, its terms and its fit with the specific car before confirming the rental.';
  if (/can (?:you|we) (?:provide|arrange) (?:a )?child seat|do you (?:provide|have|offer) (?:a )?child seat/i.test(input)) {
    const party = state.booking.passengers ? `${state.booking.passengers} travellers` : 'your group';
    const bags = state.booking.luggage ? `${state.booking.luggage} suitcases` : 'your luggage';
    const stroller = /stroller|pushchair/i.test(input) || state.history.some(entry => entry.from === 'customer' && /stroller|pushchair/i.test(entry.text));
    return `We can include a child-seat request and check its availability and terms before confirmation. For ${party}, ${bags}${stroller ? ' and a stroller' : ''}, I would start with a family car, then verify that everything fits in the specific model.`;
  }
  if (state.booking.childSeats && /(?:מה אם|ומה אם|what if).{0,24}(?:רכב קטן|קומפקט|small car|compact)/i.test(input)) return he
    ? 'רכב קטן עשוי להיות נוח יותר לחניה, אבל עם תינוק, עגלה ומזוודה הייתי מתחיל בבדיקת משפחתית. אפשר להשוות גם רכב קטן ולוודא בדגם המסוים שיש מקום מתאים לכיסא ולציוד.'
    : 'A compact may be easier to park, but with a child and luggage I would start by checking a family car. We can compare a compact too and verify seat and luggage space in the actual model.';
  if (state.booking.childSeats && /עגלה|stroller|pushchair/i.test(input)) return he
    ? 'אם תביאו גם עגלה, משפחתית עדיין תהיה כיוון טוב לבדיקה. לפני שנבחר דגם נוודא שכיסא הבטיחות, העגלה ושאר הציוד מתאימים בו יחד.'
    : 'If you bring a stroller too, I would still start by checking a family car. We will verify the child seat, stroller and other luggage fit together in the actual model before choosing one.';
  if (/היית ממליץ על קטן|האם קטן יתאים|would you recommend a (?:small|compact) car/i.test(input) && state.booking.childSeats) return he
    ? 'אפשר לבדוק גם רכב קטן, אבל עם תינוק, כיסא ומזוודה הייתי מתחיל במשפחתית כדי להשאיר יותר מקום. אם רכב קטן חשוב לכם, נבדוק את מקום הכיסא והציוד בדגם המסוים.'
    : 'A compact is worth checking, but with a baby, child seat and bag I would start with a family car for more space. If you prefer a compact, we will check the seat and luggage fit in the actual model.';
  if (/אולי יש כיוון אחר|יש אופציה אחרת|any other option|another direction/i.test(input) && state.booking.childSeats) return he
    ? 'אפשר לבדוק גם רכב קומפקטי אם חשובים לכם חניה קלה וגודל קטן. עם התינוק והמזוודה נוודא קודם שבדגם המסוים יש מקום מתאים לכיסא ולציוד.'
    : 'We can also check a compact if easy parking and a smaller car matter most. With the baby and bag, we will first confirm seat and luggage space in the actual model.';
  if (/מה הכי מתאים לדעתך|מה מתאים לנו|what (?:fits|suits) us best/i.test(input) && state.booking.childSeats) {
    const recommendedBefore = state.history.some(entry => entry.from === 'bot' && /הייתי מתחיל.*משפחת|משפחתית.*נקודת|I would start.*family/i.test(entry.text));
    return he
      ? recommendedBefore
        ? 'משפחתית עדיין תהיה נקודת הפתיחה שלי עבורכם. אם יש עגלה בנוסף למזוודה, כדאי לציין גם אותה כדי שנבדוק את תא המטען בדגם המסוים.'
        : 'לזוג עם תינוק ומזוודה הייתי מתחיל ברכב משפחתי: הוא נותן כיוון טוב למקום לכיסא ולציוד. לפני שנאשר התאמה, נבדוק את הדגם המסוים ואת גודל המזוודה.'
      : recommendedBefore
        ? 'A family car is still my starting point. If you also have a stroller, tell me so we can check boot space in the actual model.'
        : 'For two adults, a baby and a bag I would start with a family car. We will check the child seat and luggage fit in the actual model before confirming it.';
  }
  if (/צריך (?:רכב )?שבעה מקומות|do (?:we|i) need (?:a )?seven[- ]?seat/i.test(input)
    && (state.booking.passengers ?? 0) >= 6
    && state.history.some(entry => entry.from === 'bot' && /כדאי לבדוק רכב שבעה מקומות|check a seven[- ]?seat/i.test(entry.text))) {
    return he
      ? `כן, ל־${state.booking.passengers} נוסעים הייתי מתחיל בבדיקת רכב שבעה מקומות. מקום למזוודות נבדוק בדגם המסוים; תאריכי הנסיעה יעזרו לנו להתקדם.`
      : `Yes, for ${state.booking.passengers} travellers I would start with a seven-seat car. We will check luggage space in the actual model; your travel dates will help us move forward.`;
  }
  if (/איזה גודל תמליצו|איזה סוג רכב תמליצו|מה תמליצו לנו|what size (?:car|vehicle) (?:do you )?recommend/i.test(input) && state.booking.passengers) {
    const recommended = direction(reading, state.booking, input);
    const group = recommended === 'seven_seat' ? (he ? 'רכב שבעה מקומות' : 'a seven-seat car')
      : recommended === 'family' || recommended === 'suv' ? (he ? 'רכב משפחתי מרווח' : 'a roomy family car')
      : (he ? 'רכב קומפקטי' : 'a compact car');
    return he
      ? `ל־${state.booking.passengers} נוסעים הייתי מתחיל ב${group}. את המקום למזוודות נוודא בדגם המסוים לפני שנאשר התאמה. אם יש העדפה נוספת, כתבו לי ונשלב אותה בבקשה.`
      : `For ${state.booking.passengers} travellers I would start with ${group}. We will check luggage space in the actual model before confirming the fit. Tell me any other preference and I will include it in the request.`;
  }
  if (/מה (?:אתם|אתה|את) (?:מציע(?:ים|ה)?|ממליצ(?:ים|ה)?)|מה תציעו|what (?:do you|would you) (?:suggest|recommend)/i.test(input)
      && !state.booking.passengers && !state.booking.vehicleNeed && !state.booking.luggage) return he
    ? 'בשמחה אעזור לבחור. כמה אנשים ומזוודות יהיו בנסיעה, והאם היא בעיקר בעיר או גם מחוץ לעיר?'
    : 'Happy to help choose. How many people and bags will travel, and is the driving mainly in town or beyond it?';
  if (explicitDateRange(input) && state.booking.pickupDate && state.booking.returnDate) return he
    ? `הבנתי את תאריכי האיסוף וההחזרה. ${state.booking.pickupLocation ? question('returnLocation', 'he') : question('pickupLocation', 'he')}`
    : `I have the pickup and return dates. ${state.booking.pickupLocation ? question('returnLocation', 'en') : question('pickupLocation', 'en')}`;
  if (state.booking.pickupLocation && state.booking.returnLocation && /איסוף|לאסוף|החזרה|להחזיר|pick.?up|drop.?off|return/i.test(input)) {
    const next = state.booking.passengers === 1
      ? (he ? 'כמה ציוד תביא לנסיעה?' : 'How much luggage will you bring?')
      : (he ? 'תרצו שנתקדם לבקשה עם הפרטים שמסרתם?' : 'Would you like to proceed with the details you gave?');
    return he ? `הבנתי: איסוף ב${state.booking.pickupLocation} והחזרה ב${state.booking.returnLocation}. ${next}` : `Got it: pickup in ${state.booking.pickupLocation} and return in ${state.booking.returnLocation}. ${next}`;
  }
  if (/מה חשוב לבדוק ברכב קטן|מה חשוב ברכב קטן|what(?: should I| to) (?:check|look for) in a (?:small|compact) car/i.test(input)) return he
    ? 'ברכב קטן כדאי לבדוק נוחות ישיבה, מקום לציוד, סוג גיר ותנאי ההשכרה. את המקום למזוודות נוודא בדגם המסוים. מה הכי חשוב לך מביניהם?'
    : 'In a small car, check seating comfort, luggage space, gearbox and rental terms. We will confirm luggage fit for the actual model. Which matters most to you?';
  if (state.booking.passengers === 1 && state.booking.pickupDate && /מה אתה ממליץ|מה את ממליצה|מה היית ממליץ|איזה רכב כדאי|what (?:car|vehicle) (?:do you )?recommend/i.test(input)) return he
    ? `לנסיעה לבד${state.booking.pickupLocation ? ` עם איסוף ב${state.booking.pickupLocation}` : ''} הייתי מתחיל ברכב קומפקטי. אם יש ציוד רב או חשובה לך יותר נוחות, אפשר לבדוק גם משפחתית. כמה ציוד תביא?`
    : `For a solo trip${state.booking.pickupLocation ? ` picking up in ${state.booking.pickupLocation}` : ''}, I would start with a compact car. If you have a lot of luggage or want more space, we can check a family car. How much luggage will you bring?`;
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
    if (state.booking.passengers && state.booking.luggage) return he
      ? `ל־${state.booking.passengers} נוסעים ו־${state.booking.luggage} מזוודות נבדוק את המקום בדגם המסוים לפני שנבטיח התאמה.${state.booking.luggageSize === 'large' ? ' רשמתי שהמזוודות גדולות.' : ' האם אלה מזוודות גדולות?'}`
      : `For ${state.booking.passengers} passengers and ${state.booking.luggage} bags, we will check space in the actual model before promising a fit.${state.booking.luggageSize === 'large' ? ' I have noted that the bags are large.' : ' Are they large suitcases?'}`;
    return he
      ? 'המקום למזוודות תלוי בדגם ובגודל המזוודות. כמה נוסעים ומזוודות יהיו? כך נוכל להציע רכב מתאים.'
      : 'Luggage fit depends on the actual model and suitcase sizes. I can suggest a vehicle group to check, but cannot promise fit without checking that car. How many passengers and suitcases will you have?';
  }
  if ((state.booking.passengers ?? 0) >= 5 && (state.booking.luggage ?? 0) >= 3) {
    const people = state.booking.passengers ?? 0;
    const bags = state.booking.luggage ?? 0;
    const next = !state.booking.pickupDate ? (datesUndecided ? waitForDates : he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?')
      : !state.booking.returnDate ? question('returnDate', state.locale)
      : !state.booking.pickupLocation ? question('pickupLocation', state.locale)
      : !state.booking.returnLocation ? question('returnLocation', state.locale)
      : (he ? 'תרצו שנתקדם לבקשה עם הפרטים שכבר מסרתם?' : 'Shall we continue with the details you already gave?');
    return he
      ? `ל־${people} נוסעים ו־${bags} מזוודות כדאי לבדוק ${people >= 6 ? 'רכב שבעה מקומות' : 'רכב משפחתי מרווח או רכב פנאי'}. את המקום לציוד נוודא לפי הדגם וגודל המזוודות. ${next}`
      : `For ${people} passengers and ${bags} bags, ${people >= 6 ? 'a seven-seat car' : 'a roomy family car or SUV'} is worth checking. We will confirm luggage space for the specific model and bag sizes. ${next}`;
  }
  if (/שבעה מקומות|7\s*מקומות|seven[- ]?seat|7[- ]?seat/i.test(state.booking.vehicleNeed ?? input) && (state.booking.luggage ?? 0) >= 3) {
    const bags = state.booking.luggage;
    const next = !state.booking.pickupDate ? (datesUndecided ? waitForDates : he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?') : !state.booking.returnDate ? question('returnDate', state.locale) : (he ? 'תרצו שנמשיך לבדוק רכב מתאים?' : 'Shall we continue checking a suitable car?');
    return he
      ? `לשבעה מקומות ו־${bags} מזוודות כדאי לבדוק דגם שבו נשאר מספיק מקום לציוד גם כשהמושבים בשימוש. נוודא את ההתאמה לפי הדגם וגודל המזוודות. ${next}`
      : `For seven seats and ${bags} bags, we should check a model with enough luggage space when the seats are in use. We will confirm the fit for the specific car and bag sizes. ${next}`;
  }
  const group = direction(reading, state.booking, input);
  const topic = /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input) || Boolean(state.booking.childSeats) ? 'child' :
    /פגיש|עיר|חניה|city|meeting|parking/i.test(input) ? 'city' : 'trip';
  const lead = he ? ({ compact: 'רכב קומפקטי של SmartCar יכול להתאים לנסיעה שלכם', family: 'משפחתית של SmartCar יכולה להתאים לנסיעה שלכם', suv: 'רכב פנאי של SmartCar יכול להתאים לנסיעה שלכם', seven_seat: 'רכב שבעה מקומות של SmartCar יכול להתאים לנסיעה שלכם', none: 'נשמח לעזור לכם לבחור רכב מתאים ב־SmartCar' } as const)[group]
    : ({ compact: 'I would start with a SmartCar compact', family: 'I would start with a SmartCar family car', suv: 'A SmartCar SUV is a direction to check', seven_seat: 'I would check a SmartCar seven-seater', none: 'We can choose a SmartCar car around your trip' } as const)[group];
  const benefit = he ? topic === 'child' ? 'נוכל לבחור יחד דגם עם מקום לנוסעים ולציוד, ולוודא שכיסא הבטיחות מתאים לו.' : topic === 'city' ? 'רכב שיעמוד לרשותכם בין היעדים נותן גמישות לאורך היום.' : 'כך אפשר להתאים את המרחב והנוחות למשך הנסיעה ולציוד שלכם.'
    : topic === 'child' ? 'It is a good starting point for passenger and luggage space; the child seat must be checked against the actual car.' : topic === 'city' ? 'Having the car at your disposal gives flexibility between stops during the day.' : 'We can match passenger space and comfort to the trip and your luggage.';
  const next = !state.booking.pickupDate ? (datesUndecided ? waitForDates : he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?')
    : !state.booking.returnDate ? question('returnDate', state.locale)
    : !state.booking.pickupLocation ? question('pickupLocation', state.locale)
    : !state.booking.returnLocation ? question('returnLocation', state.locale)
    : (he ? 'תרצו שנתחיל בקשה לבדיקה עם הפרטים שכבר מסרתם?' : 'Would you like to start a request for review with the details you already gave?');
  const price = PRICE_OR_AVAILABILITY.test(input) ? `${priceAnswer(state.locale)} ` : '';
  return `${lead}. ${benefit} ${price}${next}`.replace(/\s+/g, ' ').trim();
}

function safeModelReply(reading: BotReading | null, input: string, state: RebuildState): string | null {
  if (!reading || OUTSIDE.test(input) || /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input)) return null;
  // Gemini is only a language draft. The checks below reject anything that
  // looks like a business promise, workflow decision, repeated intake prompt
  // or ungrounded vehicle claim before it reaches the customer.
  if (/מחפש רכב זול לשבוע|מחפשת רכב זול לשבוע|זה נשמע יקר|נשמע יקר|איזו קבוצה הכי מתאימה|looking for a cheap rental for a week|sounds expensive|which (?:group|class) fits best/i.test(input)) return null;
  if (state.history.some(entry => entry.from === 'customer' && /רכב זול|cheap rental/i.test(entry.text))
    && /מה הכי מתאים לדעתך|אני נוסע לבד|אני נוסעת לבד|אחשוב על זה|what fits best|travelling alone|think about it/i.test(input)) return null;
  if ((/יום אחד לעבודה|one day for work/i.test(input) || state.history.some(entry => entry.from === 'customer' && /יום אחד לעבודה|one day for work/i.test(entry.text)))
    && /צריך רכב|רכב קטן יספיק|מה הכי מתאים לדעתך|אני נוסע לבד|אני נוסעת לבד|יש גם תיק אחד|need a car|small car be enough|what (?:fits|suits) me best|travelling alone|one bag/i.test(input)) return null;
  if ((state.booking.passengers ?? 0) >= 5 && (state.booking.luggage ?? 0) >= 3 && /האם ג[׳'י]?יפון יתאים|ג[׳'י]?יפון יתאים|מה הכי מתאים לדעתך|המזוודות גדולות|אולי יש כיוון אחר|אז מה היית מציע|איך נוודא מקום למטען|SUV fit|large suitcases|another direction|luggage space/i.test(input)) return null;
  if (state.booking.childSeats && /אולי יש כיוון אחר|יש אופציה אחרת|any other option|another direction|היית ממליץ על קטן|would you recommend a (?:small|compact) car|(?:מה אם|ומה אם|what if).{0,24}(?:רכב קטן|קומפקט|small car|compact)/i.test(input)) return null;
  if (state.booking.passengers === 1 && /קטן או משפחתי|קומפקטי או משפחתי|מה הכי מתאים לדעתך|מה מתאים לי|מה לגבי חניה|ומה לגבי חניה|אולי יש כיוון אחר|יש אופציה אחרת|small or family|compact or family|parking|another direction|other option/i.test(input)) return null;
  if (/אולי אשכור בסוף החודש|אולי בסוף החודש|maybe (?:rent|later) this month/i.test(input)) return null;
  if (/איזה רכב|מה כדאי|what (?:car|vehicle)|recommend/i.test(input) && !state.booking.passengers && !state.booking.luggage && !state.booking.vehicleNeed) return null;
  if (/שבעה מקומות|7\s*מקומות|seven[- ]?seat|7[- ]?seat/i.test(input) && state.booking.luggage) return null;
  if ((state.booking.passengers || state.booking.luggage) && /איזה רכב|יתאים|מתאים|מספיק|ממליץ|recommend|fit|suit/i.test(input)) return null;
  if (state.booking.passengers && state.booking.luggage && /מזווד|מטען|luggage|suitcase|bags/i.test(input)) return null;
  if (/מזווד|מטען|תא מטען|luggage|suitcase|boot|trunk/i.test(input) && /כמה|נכנס|יספיק|מקום|יכול|fit|space|room|how many/i.test(input)) return null;
  if (PRICE_OR_AVAILABILITY.test(input)) return null;
  if (state.booking.pickupLocation && state.booking.returnLocation
    && /איסוף|לאסוף|pick.?up/i.test(input) && /החזרה|להחזיר|return|drop.?off/i.test(input)) return null;
  const reply = reading.reply;
  if (OUTSIDE.test(reply) || UNSAFE_CLAIM.test(reply) || /(?:יהיה|יש).{0,55}מקום.{0,75}מזווד|באזו/i.test(reply) || INTERNAL_VOICE.test(reply) || /₪|\b\d{2,}\b/.test(reply)) return null;
  if (VOLUNTEERED_IDENTITY.test(reply) && !identityQuestion(input)) return null;
  if (!hasVehicleContext(state.booking, input) && /רכב (?:קטן|קומפקטי|משפחתי|פנאי|שבעה מקומות)|משפחתית|ג[׳'י]?יפון|קטגוריית רכבים קומפקטיים|compact car|family car|SUV/i.test(reply)) return null;
  if (state.booking.passengers && state.booking.passengers < 6 && !/שבעה מקומות|7\s*מקומות|seven.?seat/i.test(input) && /שבעה מקומות|7\s*מקומות|seven.?seat/i.test(reply)) return null;
  if (/באיזו שעה|באיזה שעה|מה השעה|שעת (?:ה?איסוף|ה?החזרה)|what time|pickup time|drop.?off time|return time/i.test(reply)) return null;
  if (state.booking.pickupDate && /באיזה תאריך.{0,25}לאסוף|תאריך איסוף|what date.{0,25}pick.?up/i.test(reply)) return null;
  if (state.booking.returnDate && /באיזה תאריך.{0,25}תחזיר|תאריך החזרה|what date.{0,25}return/i.test(reply)) return null;
  if (state.booking.pickupDate && state.booking.returnDate && asksRentalDates(reply)) return null;
  if (!state.booking.pickupDate && asksRentalDates(reply)
    && (uncertainDateAnswer(input) || state.history.some(entry => entry.from === 'customer' && uncertainDateAnswer(entry.text)))) return null;
  if (state.booking.pickupLocation && /מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|עיר האיסוף|where.{0,30}pick.?up/i.test(reply)) return null;
  if (state.booking.pickupLocation && /(?:מאיפה|איפה|מהו|מה|איזה|which|what|where).{0,35}(?:יעד האיסוף|מקום האיסוף|עיר האיסוף|pick.?up (?:place|city|location))/i.test(reply)) return null;
  if (state.booking.pickupLocation && /(?:באיזה|באיזו|איזה|מהו|מה|איפה|מאיפה|where|which|what)[^?؟]{0,90}(?:איסוף|לאסוף|pick.?up)[^?؟]*[?؟]/i.test(reply)) return null;
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
  const ageOnly = /^\s*(?:24\s*\+|21\s*[-–]\s*23)\s*$/u.test(input);
  for (const [source, target] of [['pickupDate', 'pickupDate'], ['returnDate', 'returnDate'], ['pickupLocation', 'pickupLocation'], ['returnLocation', 'returnLocation'], ['vehicleNeed', 'vehicleNeed']] as const) {
    const field = fields[source];
    if (!field || !input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase())) continue;
    if (source === 'pickupDate' || source === 'returnDate') {
      if (ageOnly) continue;
      if (!/\d{1,2}|היום|מחר|מחרתיים|(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|today|tomorrow|(?:mon|tues|wed|thurs|fri|sat|sun)/i.test(field.evidence)) continue;
      const latest = new Date(`${israelDate()}T00:00:00Z`);
      latest.setUTCFullYear(latest.getUTCFullYear() + 2);
      if (!validDate(field.value) || field.value < israelDate() || field.value > latest.toISOString().slice(0, 10)) continue;
    }
    if ((source === 'pickupLocation' || source === 'returnLocation')
      && !/איסוף|לאסוף|להחזיר|החזרה|pick.?up|return|drop.?off/i.test(input)
      && !(state.phase === 'booking' && state.step === 'rental_locations' && input.trim().split(/\s+/).length <= 3)) continue;
    if (source === 'vehicleNeed' && !customerVehicleChoice(input, state)) continue;
    state.booking[target] = source === 'vehicleNeed'
      ? customerVehicleChoice(input, state)!
      : field.value;
  }
  for (const name of ['passengers', 'luggage', 'childSeats'] as const) {
    if (state.booking[name] !== undefined) continue;
    const field = fields[name];
    const count = Number(field?.value);
    const evidenceMatches = name === 'passengers' ? /נוסע|אנשים|מבוגרים|אנחנו|נהיה|passenger|people|adults|we are/i.test(field?.evidence ?? '')
      : name === 'luggage' ? /מזווד|תיק|bags?|suitcases?|luggage/i.test(field?.evidence ?? '')
      : /כיסא|מושב בטיחות|child seat|car seat|booster/i.test(field?.evidence ?? '');
    const statedValues = field?.evidence.match(/\d{1,2}|אחד|אחת|שניים|שתיים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש|שישה|שש|שבעה|שבע|שמונה|one|two|three|four|five|six|seven|eight/gi) ?? [];
    if (field && evidenceMatches && statedValues.some(value => statedCount(value) === count) && input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase()) && Number.isInteger(count) && count >= 0 && count <= 20) state.booking[name] = count;
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
  const needs = state.locale === 'en'
    ? `${b.passengers ? `Passengers: ${b.passengers}\n` : ''}${b.luggage ? `Bags: ${b.luggage}${b.luggageSize === 'large' ? ' (large)' : ''}\n` : ''}`
    : `${b.passengers ? `נוסעים: ${b.passengers}\n` : ''}${b.luggage ? `מזוודות: ${b.luggage}${b.luggageSize === 'large' ? ' (גדולות)' : ''}\n` : ''}`;
  if (state.locale === 'en') return `Here are your request details:\nVehicle: ${b.vehicleNeed}\n${needs}Dates: ${date(b.pickupDate)}–${date(b.returnDate)}\nPickup: ${b.pickupLocation}\nReturn: ${b.returnLocation}\nDriver age: ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}\nName: ${b.customerName}${b.customerEmail ? `\nEmail: ${b.customerEmail}` : ''}\n\nThis request is subject to SmartCar's review and confirmation. Before sending it, please confirm the following statement:\n“${consent.text}”\nTerms: https://www.smartcar.co.il/en/terms\nPrivacy: https://www.smartcar.co.il/en/privacy\nIf everything is correct and you agree, reply “I confirm” to send the request.`;
  return `אלה פרטי הבקשה שלכם:\nרכב: ${b.vehicleNeed}\n${needs}תאריכים: ${date(b.pickupDate)}–${date(b.returnDate)}\nאיסוף: ${b.pickupLocation}\nהחזרה: ${b.returnLocation}\nגיל הנהג: ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}\nשם: ${b.customerName}${b.customerEmail ? `\nמייל: ${b.customerEmail}` : ''}\n\nהבקשה תועבר לאישור SmartCar. לפני השליחה, אנא אשרו את ההצהרה:\n״${consent.text}״\nתנאי השימוש: https://www.smartcar.co.il/he/terms\nמדיניות הפרטיות: https://www.smartcar.co.il/he/privacy\nאם הכול נכון ואתם מסכימים, שלחו ״אני מאשר/ת״ כדי לשלוח את הבקשה.`;
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
    state.safetyKind = undefined;
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
  const confirmsDuration = affirms(input) || /^(?:כן|נכון|yes|correct)[,\s]+(?:אלה|אלו|זה|those|these|the dates)(?:\s|$)/i.test(input);
  if (state.durationClarification && !confirmsDuration && !/^(?:לא|no|not quite|לא נכון)/i.test(input) && !explicitDateRange(input)) {
    // A side answer can continue the conversation; the final request summary
    // still shows the exact dates and requires explicit confirmation.
    state.durationClarification = false;
  }

  const incident = safety(input);
  if (incident) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt ??= new Date().toISOString(); state.handoffKind = 'safety';
    state.safetyKind = incident;
    const recentAlert = state.safetyAlertAt && Date.now() - Date.parse(state.safetyAlertAt) < 24 * 60 * 60 * 1000;
    reply = reportedRentalDamage(input)
      ? (he ? `מצטער לשמוע. טוב שאיש לא נפגע. צלמו את הנזק ואת מקום האירוע אם בטוח לעשות זאת, והתקשרו ל־SmartCar בתוך שעה לדיווח ולהנחיות: ${OFFICE_PHONE}. את מספר ההזמנה אפשר למסור גם בהמשך.` : `I am sorry this happened. I am glad no one was hurt. If it is safe, photograph the damage and the scene, then call SmartCar within one hour to report it and get guidance: ${OFFICE_PHONE}. You can provide the booking reference later.`)
      : /גרר|tow|roadside/i.test(input) && recentAlert
      ? (he ? `לתיאום גרר הישארו במקום בטוח והתקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `To arrange a tow, stay somewhere safe and call SmartCar now: ${OFFICE_PHONE}.`)
      : (he ? `אם הרכב אינו בטוח, אל תמשיכו לנסוע. עצרו במקום בטוח אם אפשר; אם יש סכנה מיידית או נפגעים, פנו לגורמי החירום. התקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `If the car may be unsafe, do not continue driving. Stop somewhere safe if you can; call emergency services if anyone is hurt or in immediate danger. Call SmartCar now: ${OFFICE_PHONE}.`);
    source = 'safety'; escalate = !recentAlert;
    if (escalate) state.safetyAlertAt = new Date().toISOString();
  } else if (identityQuestion(input)) {
    reply = identityQuestion(input) === 'name'
      ? (he ? 'אפשר לקרוא לי SmartCar 🙂 איך אוכל לעזור?' : 'You can call me SmartCar 🙂 How can I help?')
      : (he ? 'אני העוזר הדיגיטלי של SmartCar. אני כאן לעזור, ואם צריך אעביר את הפנייה לנציג.' : 'I am SmartCar’s digital assistant. I am here to help, and I can pass your enquiry to a representative when needed.');
  } else if (/ירדן|מצרים|לחו.?ל|מחוץ לישראל|חציית גבול|cross.?border|outside israel|to jordan|to egypt/i.test(input) && /רכב|השכר|לנסוע|להיכנס|rent|car|drive|enter/i.test(input)) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'human'; escalate = true;
    reply = he ? `לפני נסיעה עם רכב שכור מחוץ לישראל צריך לבדוק את אפשרות היציאה, הביטוח והתנאים לרכב המסוים. נציג SmartCar יחזור אליכם עם תשובה; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Before taking a rental car outside Israel, the border crossing, insurance and terms for the specific car need checking. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`;
  } else if (/להסיע.{0,25}(?:נוסעים|אנשים).{0,20}בתשלום|הסעת נוסעים בתשלום|paid passenger|passengers? for hire|commercial passenger/i.test(input)) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'human'; escalate = true;
    reply = he ? `השכרה להסעת נוסעים בתשלום דורשת בדיקה של תנאי השימוש והכיסוי לרכב המתאים. נציג SmartCar יחזור אליכם כדי לברר אם אפשר להציע פתרון; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `A rental for paid passenger transport requires checking the vehicle terms and cover. A SmartCar representative will follow up to see whether a suitable option is possible; you can also call ${OFFICE_PHONE}.`;
  } else if (!state.handedOff && cancellationRequest(input)) {
    state.phase = 'service';
    const knownBooking = await store.activeBooking(phone);
    const hasReference = /(?:מספר\s+ה?הזמנה|booking\s+(?:number|reference))\s*(?:שלי|הוא|:|#|is)?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(input);
    if (knownBooking || hasReference) {
      state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'booking_change'; escalate = true;
      reply = he ? `קיבלנו את בקשת הביטול. נציג SmartCar יבדוק אותה ויחזור אליכם; הביטול תקף רק לאחר אישור. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have your cancellation request. A SmartCar representative will review it and follow up; cancellation takes effect only after confirmation. For immediate help call ${OFFICE_PHONE}.`;
    } else reply = he ? 'בשמחה אעזור עם בקשת הביטול. מה מספר ההזמנה?' : 'I can help with the cancellation request. What is your booking reference?';
  } else if (state.handedOff) {
    const handoffKind = state.handoffKind ?? (state.safetyAlertAt && (!state.handoffAt || Date.parse(state.safetyAlertAt) >= Date.parse(state.handoffAt)) ? 'safety' : state.interest ? 'commercial' : 'booking_change');
    const cancellationPending = handoffKind === 'booking_change' && state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text));
    const hasBookingReference = state.history.some(entry => entry.from === 'customer' && /מספר\s+ה?הזמנה\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}|booking\s+(?:number|reference)\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(entry.text));
    const billingIssue = handoffKind === 'service_issue' && state.history.some(entry => entry.from === 'customer' && /חויבתי פעמיים|חיוב כפול|שילמתי פעמיים|charged twice|double charg/i.test(entry.text));
    const cleanlinessIssue = handoffKind === 'service_issue' && state.history.some(entry => entry.from === 'customer' && /הרכב.{0,25}מלוכלך|רכב מלוכלך|dirty car|car was dirty/i.test(entry.text));
    const safetyKind = state.safetyKind ?? (state.history.some(entry => entry.from === 'customer' && /תאונה|התנגשות|accident|collision|crash/i.test(entry.text)) ? 'accident' : 'breakdown');
    const rentalDamage = state.history.some(entry => entry.from === 'customer' && reportedRentalDamage(entry.text));
    reply = handoffKind === 'commercial' && state.interest && /מה כלול|מה כולל|תשלום ראשוני|מקדמה|מחיר|כמה עולה|נסיעת מבחן|what.*included|initial payment|down payment|price|test drive/i.test(input)
      ? commercialReply(input, state).reply
      : handoffKind === 'commercial' && state.interest && /רכב (?:משפחתי|קטן|פנאי|קומפקטי)|\b(?:family car|small car|SUV|compact car)\b|\d[\d, .]*\s*(?:קמ|ק״מ|km)/i.test(input)
        ? (he ? 'תודה, הוספתי את ההעדפה שציינת לפנייה. נציג SmartCar יוכל להתייחס אליה בהצעה.' : 'Thanks, I have added that preference to your enquiry so the SmartCar representative can include it in the offer.')
      : handoffKind === 'commercial' && /אפשר לראות|יש אפשרות לראות|לראות את הרכב|view (?:the )?car|see (?:the )?car/i.test(input)
        ? (he ? 'כן, אפשר לבדוק עם נציג SmartCar אפשרות לראות רכב מתאים לאחר שיוצעו דגמים זמינים. הוא יחזור אליכם עם הפרטים ויתאם את הצעד הבא.' : 'Yes, a SmartCar representative can check how to view a suitable car once available options are identified. They will follow up with the details and next step.')
      : handoffKind === 'commercial' && /תעביר|נציג|pass.*representative|send.*team/i.test(input)
        ? (he ? 'הפנייה כבר הועברה להמשך טיפול. נציג SmartCar יחזור אליכם.' : 'Your enquiry has already been passed on. A SmartCar representative will follow up.')
      : handoffKind === 'safety' && rentalDamage && /אין לי.{0,30}מספר|לא.{0,20}מספר הזמנה|לצלם|צילום|תמונה|photo|picture|don'?t have.{0,30}(?:reference|booking number)/i.test(input)
        ? (he ? `כן, צלמו את השריטה ואת סביבת הרכב אם בטוח לעשות זאת. התקשרו ל־SmartCar בתוך שעה במספר ${OFFICE_PHONE} ודווחו גם בלי מספר הזמנה כרגע; תוכלו למסור אותו בהמשך. נציג ינחה אתכם לגבי דוח האירוע והמשך הטיפול.` : `Yes, photograph the damage and surroundings if it is safe. Call SmartCar within one hour on ${OFFICE_PHONE} even if you do not have the booking reference yet; you can provide it later. A representative will guide you on the incident report and next steps.`)
      : handoffKind === 'safety' && /(?:אפשר|מותר לי|האם).{0,30}להמשיך לנסוע|האם.{0,30}לנסוע|can (?:i|we).{0,25}(?:keep driving|continue driving)|safe to drive/i.test(input)
        ? (he ? `אם הדלת או חלק אחר ברכב לא פועלים כרגיל, או שיש חשש בטיחותי, אל תמשיכו לנסוע. גם כשהנזק נראה קוסמטי, דווחו ל־SmartCar בתוך שעה במספר ${OFFICE_PHONE} וקבלו הנחיה לגבי המשך הנסיעה.` : `If the door or any part of the car is not working normally, or you have a safety concern, do not continue driving. Even if the damage looks cosmetic, report it to SmartCar within one hour on ${OFFICE_PHONE} and get guidance before continuing.`)
      : handoffKind === 'safety' && rentalDamage && /אצטרך.{0,20}לשלם|נצטרך.{0,20}לשלם|מי.{0,15}ישלם|השתתפות עצמית|אחריות.{0,20}נזק|חייב.{0,15}תיקון|pay for|liable|responsib(?:le|ility) for|excess/i.test(input)
        ? (he ? 'התשלום על הנזק תלוי בנסיבות המקרה, בכיסוי הביטוחי ובהשתתפות העצמית שבהסכם ההשכרה. גם אם נראה שמישהו אחר פגע ברכב, אי אפשר לקבוע חיוב לפני בדיקת האירוע. דווחו ל־SmartCar ושמרו את התמונות; נציג יסביר לכם את התנאים שחלים על ההשכרה שלכם.' : 'Any charge for the damage depends on the circumstances, cover and excess in your rental agreement. Even if another person appears to have caused it, the charge cannot be determined before the incident is reviewed. Report it to SmartCar and keep the photos; a representative will explain the terms for your rental.')
      : handoffKind === 'safety' && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|what (?:next|should I do)|next step/i.test(input)
        ? safetyKind === 'accident'
          ? /דווחו על התאונה בתוך שעה|report the accident within one hour/i.test(lastBotReply)
            ? (he ? `הפעולה הקרובה היא להתקשר ל־SmartCar ב־${OFFICE_PHONE} ולמסור מיקום ומספר הזמנה. אחרי השיחה מלאו דוח תאונה; אם הרכב אינו בטוח, אל תמשיכו לנסוע.` : `The next action is to call SmartCar on ${OFFICE_PHONE} with your location and booking reference. After the call, complete an accident report; do not drive if the car is unsafe.`)
            : (he ? `התקשרו עכשיו ל־SmartCar במספר ${OFFICE_PHONE}, מסרו את מיקומכם ואת מספר ההזמנה ודווחו על התאונה בתוך שעה. לאחר מכן מלאו דוח תאונה. אם יש סכנה או נפגעים, פנו קודם לגורמי החירום.` : `Call SmartCar now on ${OFFICE_PHONE} with your location and booking reference, and report the accident within one hour. Then complete an accident report. If anyone is hurt or in danger, contact emergency services first.`)
          : (he ? `התקשרו עכשיו ל־SmartCar במספר ${OFFICE_PHONE}, מסרו את המיקום ומספר ההזמנה כדי שנתאם עזרה או גרר. אל תמשיכו לנסוע אם הרכב אינו בטוח; במקרה של סכנה מיידית פנו לגורמי החירום.` : `Call SmartCar now on ${OFFICE_PHONE} with your location and booking reference so we can arrange help or a tow. Do not drive if the car is unsafe; contact emergency services if there is immediate danger.`)
      : handoffKind === 'safety' && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}להכין|איזה פרטים|what (?:should I|do I need to) (?:prepare|have ready)|what details/i.test(input)
        ? (he ? `כדאי להכין את מספר ההזמנה, המיקום ותיאור קצר של מה שקרה. התקשרו ל־SmartCar ב־${OFFICE_PHONE} כדי לדווח ולתאם את המשך הטיפול.` : `Have your booking reference, location and a short description of what happened ready. Call SmartCar on ${OFFICE_PHONE} to report it and arrange the next steps.`)
      : handoffKind === 'safety' && /אני במקום בטוח|אנחנו במקום בטוח|I'm safe|we are safe/i.test(input)
        ? (he ? `טוב שאתם במקום בטוח. התקשרו עכשיו ל־SmartCar ב־${OFFICE_PHONE} כדי לדווח על האירוע ולתאם עזרה.` : `I am glad you are safe. Call SmartCar now on ${OFFICE_PHONE} to report the incident and arrange help.`)
      : cancellationPending && /(?:האם|זה|הביטול).{0,20}(?:נכנס לתוקף|בוטל|מאושר|אושר)|(?:is|has).{0,20}(?:cancelled|canceled|approved|effective)/i.test(input)
        ? (he ? 'הביטול עדיין לא אושר ולכן ההזמנה נשארת בתוקף. נציג SmartCar יבדוק את הבקשה ויחזור אליכם עם תשובה.' : 'The cancellation has not been confirmed, so the booking remains in effect. A SmartCar representative will review the request and follow up.')
      : cancellationPending && /חיוב|תשלום|charge|payment/i.test(input)
        ? (he ? 'צירפנו גם את שאלת החיוב לפנייה על הביטול כדי שנציג SmartCar יבדוק את שניהם יחד. אם יש פרטי חיוב או אסמכתא, כדאי לשמור אותם לבדיקה.' : 'We have added the charge question to the cancellation enquiry so a SmartCar representative can review both. Keep any charge details or records for review.')
      : cancellationPending && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|next step|what next/i.test(input)
        ? state.history.some(entry => entry.from === 'bot' && /בקשת הביטול הועברה לנציג|cancellation request has been passed/i.test(entry.text))
          ? (he ? 'כרגע לא נדרשת מכם פעולה נוספת. עד שנציג יאשר את הביטול, ההזמנה נשארת בתוקף.' : 'There is nothing else you need to do now. The booking remains in effect until a representative confirms cancellation.')
          : (he ? `בקשת הביטול הועברה לנציג SmartCar. הוא יבדוק אותה ויחזור אליכם; הביטול ייכנס לתוקף רק לאחר אישור.` : `Your cancellation request has been passed to a SmartCar representative. They will review it and follow up; cancellation takes effect only after confirmation.`)
      : cancellationPending && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}להכין|what.*(?:prepare|have ready)/i.test(input)
        ? (he ? 'מספר ההזמנה שכבר מסרתם שמור בפנייה. אם הפנייה כוללת חיוב, כדאי להכין גם את פרטי החיוב כדי שנציג SmartCar יוכל לבדוק הכול יחד.' : 'The booking reference you gave is included in the enquiry. If it also concerns a charge, have the charge details ready so the SmartCar representative can review both together.')
      : handoffKind === 'booking_change' && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}(?:להכין|שכדאי להכין)|what.*(?:prepare|have ready)/i.test(input)
        ? (he ? `${hasBookingReference ? 'מספר ההזמנה כבר צורף לפנייה.' : 'כדאי לשלוח את מספר ההזמנה.'} כדאי לציין גם את תאריך ההחזרה הרצוי כדי שנציג SmartCar יוכל לבדוק את השינוי.` : `${hasBookingReference ? 'Your booking reference is already included.' : 'Please send your booking reference.'} It also helps to state the return date you want so a SmartCar representative can check the change.`)
      : handoffKind === 'booking_change' && /(?:זה|השינוי|הדחייה).{0,12}(?:כבר )?מאושר|כבר אישרתם|is (?:it|the change) (?:already )?approved|has (?:it|the change) been approved/i.test(input)
        ? (he ? 'השינוי עדיין לא אושר. נציג SmartCar יבדוק את הזמינות ויחזור אליכם; רק לאחר אישורו תאריך ההחזרה יתעדכן.' : 'The change is not approved yet. A SmartCar representative will check availability and follow up; the return date changes only after confirmation.')
      : handoffKind === 'booking_change' && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|what(?: is)? next|next step/i.test(input)
        ? (he ? 'נציג SmartCar יבדוק אם אפשר לדחות את ההחזרה ויחזור אליכם עם תשובה. עד לאישור, תאריך ההחזרה הקיים נשאר בתוקף.' : 'A SmartCar representative will check whether the return can be moved and follow up. Until confirmed, the current return date remains in effect.')
      : handoffKind === 'safety' && /גרר|tow|roadside/i.test(input)
      ? (he ? `לתיאום גרר, הישארו במקום בטוח והתקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `To arrange a tow, stay somewhere safe and call SmartCar now: ${OFFICE_PHONE}.`)
      : /חויבתי|חיוב כפול|שילמתי פעמיים|charged twice|double charg/i.test(input)
        ? (he ? 'תודה שציינת גם את החיוב. צירפנו את הפרטים לפנייה כדי שנציג SmartCar יוכל לטפל בהם יחד עם הבקשה הקודמת.' : 'Thank you for flagging the charge as well. We have added it to your enquiry so a SmartCar representative can review it with your earlier request.')
      : handoffKind === 'safety' && /כתובת|מיקום|נמצא ב|נמצאת ב|(?:אני|אנחנו|הרכב)\s+(?:ב(?!דרך|נסיעה|טיול|אזור|מקום בטוח)|ליד(?! מקום בטוח))|location|address/i.test(input)
        ? (he ? `תודה, קיבלנו את המיקום וצירפנו אותו לפנייה. לתיאום עזרה דחופה התקשרו עכשיו ל־${OFFICE_PHONE}.` : `Thank you. We have added your location to the enquiry. For urgent help call ${OFFICE_PHONE} now.`)
      : handoffKind === 'safety' && /צריך עזרה|צריכ(?:ה|ים) עזרה|need help|help me/i.test(input)
        ? (he ? `כדי לתאם עזרה לרכב, התקשרו עכשיו ל־SmartCar ב־${OFFICE_PHONE} ומסרו את המיקום ומספר ההזמנה. אם יש סכנה מיידית, פנו קודם לגורמי החירום.` : `To arrange help for the car, call SmartCar now on ${OFFICE_PHONE} with your location and booking reference. If there is immediate danger, contact emergency services first.`)
      : cancellationPending && /היום|דחוף|עכשיו|today|urgent|right now/i.test(input)
        ? (he ? `בקשת הביטול כבר הועברה לנציג, אבל הביטול עדיין דורש אישור. אם אתם צריכים מענה היום, התקשרו ל־${OFFICE_PHONE}.` : `Your cancellation request has been passed to a representative, but it still needs confirmation. If you need an answer today, call ${OFFICE_PHONE}.`)
      : cancellationPending && /(?:תוכלו|אפשר|יכול(?:ים)?).{0,20}(?:לחזור|שיחזרו)|call (?:me|us) back/i.test(input)
        ? (he ? 'כן, נציג SmartCar יחזור אליכם לגבי בקשת הביטול. עד לאישורו ההזמנה נשארת בתוקף.' : 'Yes, a SmartCar representative will follow up about the cancellation request. The booking remains in effect until it is confirmed.')
      : /תודה|thanks|thank you/i.test(input)
      ? handoffKind === 'safety' ? (he ? 'בשמחה. שמרו על עצמכם.' : 'You are welcome. Take care.')
        : (he ? 'בשמחה. נציג SmartCar יחזור אליכם בהקדם.' : 'You are welcome. A SmartCar representative will follow up as soon as possible.')
      : /מתי.{0,25}(?:חוזר|חוזרים|יחזור|יחזרו|תחזרו|תענו)|תוך כמה זמן|when.{0,25}(?:call|reply|hear back)|how long.{0,25}(?:response|reply)/i.test(input)
        ? (he ? `נציג SmartCar יחזור אליכם בהקדם. אם העניין דחוף, אפשר להתקשר עכשיו ל־${OFFICE_PHONE}.` : `A SmartCar representative will follow up as soon as possible. If it is urgent, please call ${OFFICE_PHONE} now.`)
      : /מספר\s+ה?הזמנה\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}|booking\s+(?:number|reference)\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(input)
        ? (he ? 'תודה, קיבלנו את מספר ההזמנה וצירפנו אותו לפנייה.' : 'Thank you, we have added your booking reference to the enquiry.')
      : billingIssue && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|what(?: is)? next|next step/i.test(input)
        ? /שני החיובים|both charges/i.test(lastBotReply)
          ? (he ? 'כרגע לא נדרשת מכם פעולה נוספת. אם יש אסמכתא לחיוב הכפול, כדאי לשמור אותה לבדיקת הנציג.' : 'There is nothing else you need to do now. If you have a record of the duplicate charge, keep it for the representative to review.')
          : (he ? 'נציג SmartCar יבדוק את פרטי ההזמנה מול שני החיובים ויחזור אליכם עם תשובה. אם יש לכם תאריכים או סכומים של החיובים, אפשר לציין אותם כאן.' : 'A SmartCar representative will review the booking and both charges, then follow up. You can share the charge dates and amounts here if available.')
      : billingIssue && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}להכין|what.*(?:prepare|have ready)/i.test(input)
        ? (he ? `${hasBookingReference ? 'מספר ההזמנה כבר צורף לפנייה.' : 'כדאי לציין את מספר ההזמנה.'} אם יש אסמכתאות לשני החיובים, שמרו אותן לבדיקה. אין צורך לשלוח מספר כרטיס מלא.` : `${hasBookingReference ? 'Your booking reference is already included.' : 'Please provide the booking reference.'} Keep records of both charges for review. Do not send a full card number.`)
      : billingIssue && /אסמכתא|קבלה|צילום מסך|receipt|screenshot|proof/i.test(input)
        ? (he ? 'כן, אסמכתאות לשני החיובים יעזרו לנציג לבדוק את המקרה. אפשר לציין גם את התאריכים והסכומים; אין צורך לשלוח מספר כרטיס מלא.' : 'Yes, records of both charges will help the representative review this. You can include their dates and amounts; do not send a full card number.')
      : billingIssue && /כמה זמן לוקח|מתי (?:תבדקו|אקבל תשובה)|how long.*(?:check|review)/i.test(input)
        ? (he ? `נציג SmartCar יחזור אליכם לאחר בדיקת החיובים. אם זה דחוף, אפשר להתקשר ל־${OFFICE_PHONE}.` : `A SmartCar representative will follow up after reviewing the charges. If urgent, call ${OFFICE_PHONE}.`)
      : billingIssue && /תעביר|נציג|pass.*representative|send.*team/i.test(input)
        ? (he ? 'הפנייה על שני החיובים כבר הועברה לנציג SmartCar. הוא יחזור אליכם לאחר הבדיקה.' : 'The enquiry about both charges has been passed to a SmartCar representative. They will follow up after review.')
      : cleanlinessIssue && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|what(?: is)? next|next step/i.test(input)
        ? (he ? 'נציג SmartCar יבדוק את תלונת הניקיון ויחזור אליכם. אם יש תמונות של מצב הרכב בעת הקבלה, כדאי לשמור אותן לבדיקה.' : 'A SmartCar representative will review the cleanliness complaint and follow up. If you took photos when you received the car, keep them for review.')
      : cleanlinessIssue && /מה תעשו|איך תטפלו|מה הפתרון|what will you do|how will you handle/i.test(input)
        ? (he ? 'נציג SmartCar יבדוק את פרטי המקרה ויחזור אליכם כדי להציע פתרון מתאים. אפשר לציין מתי והיכן קיבלתם את הרכב.' : 'A SmartCar representative will review the details and follow up to discuss a suitable solution. You can share when and where you received the car.')
      : cleanlinessIssue && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}להכין|what.*(?:prepare|have ready)/i.test(input)
        ? (he ? `${hasBookingReference ? 'מספר ההזמנה כבר צורף לפנייה.' : 'כדאי לציין את מספר ההזמנה.'} תמונות של מצב הרכב בעת הקבלה, אם יש, ומועד קבלתו יעזרו בבדיקה.` : `${hasBookingReference ? 'Your booking reference is already included.' : 'Please provide your booking reference.'} Photos of the car when collected, if available, and the collection time will help the review.`)
      : cleanlinessIssue && /נציג|לדבר עם|representative|speak to someone/i.test(input)
        ? (he ? `בוודאי. נציג SmartCar יחזור אליכם לגבי מצב הרכב. אם זה דחוף, אפשר להתקשר ל־${OFFICE_PHONE}.` : `Of course. A SmartCar representative will follow up about the car's condition. If urgent, call ${OFFICE_PHONE}.`)
      : cleanlinessIssue && /היום|דחוף|עכשיו|today|urgent|right now/i.test(input)
        ? (he ? `אני מבין שזה דחוף. לבירור מיידי, התקשרו עכשיו ל־SmartCar ב־${OFFICE_PHONE}; נציג יבדוק את הפנייה.` : `I understand this is urgent. For immediate help, call SmartCar now on ${OFFICE_PHONE}; a representative will review your enquiry.`)
      : handoffKind === 'safety'
        ? (he ? `תודה על העדכון. אל תמשיכו לנסוע אם יש חשש בטיחותי; לתיאום עזרה התקשרו עכשיו ל־${OFFICE_PHONE}.` : `Thanks for the update. Do not keep driving if the car may be unsafe; call ${OFFICE_PHONE} now to arrange help.`)
        : handoffKind === 'commercial' && state.interest
          ? (he ? `קיבלנו את הפרטים על ${state.interest === 'sale' ? 'רכישת רכב' : 'ליסינג'}. נציג SmartCar יחזור אליכם להמשך; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your ${state.interest === 'sale' ? 'car purchase' : 'leasing'} details. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`)
        : handoffKind === 'service_issue' || handoffKind === 'human'
          ? (he ? `תודה על העדכון. נציג SmartCar יטפל בפנייה שלכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thanks for the update. A SmartCar representative will handle your enquiry; for immediate help call ${OFFICE_PHONE}.`)
        : cancellationPending
          ? (he ? `קיבלנו את בקשת הביטול. נציג SmartCar יחזור אליכם; הביטול תקף רק לאחר אישור. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your cancellation request. A SmartCar representative will follow up; cancellation takes effect only after confirmation. You can also call ${OFFICE_PHONE}.`)
          : (he ? `קיבלנו את בקשת השינוי. נציג SmartCar יחזור אליכם; השינוי תקף רק לאחר אישור. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your change request. A SmartCar representative will follow up; the change takes effect only after confirmation. You can also call ${OFFICE_PHONE}.`);
  } else if (state.durationClarification) {
    const corrected = explicitDateRange(input);
    if (corrected) {
      Object.assign(state.booking, corrected);
      state.durationClarification = false;
      reply = he ? `עדכנתי את התאריכים. ${question('pickupLocation', state.locale)}` : `I have updated the dates. ${question('pickupLocation', state.locale)}`;
    } else if (confirmsDuration) {
      state.durationClarification = false;
      reply = he ? `הבנתי, התאריכים שציינת הם הנכונים. ${question('pickupLocation', state.locale)}` : `Understood, the dates you gave are correct. ${question('pickupLocation', state.locale)}`;
    } else if (/^(?:לא|no|not quite|לא נכון)/i.test(input)) {
      state.booking.pickupDate = undefined;
      state.booking.returnDate = undefined;
      state.durationClarification = false;
      reply = he ? 'תודה על התיקון. לאילו תאריכים תרצו את הרכב?' : 'Thanks for clarifying. What dates do you need the car?';
    } else reply = he ? 'כדי לדייק: התכוונת לתאריכים שציינת, או לנסיעה של כשבוע?' : 'Just to be sure: did you mean the dates you gave, or a trip of about one week?';
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
      : lastBotReply === greeting(input, state.locale)
        ? (he ? 'היי שוב 🙂 מה תרצה לבדוק?' : 'Hi again 🙂 What would you like to check?')
        : greeting(input, state.locale)!;
  } else if (/^(?:אחשוב על זה|I'll think about it)[.!\s]*$/i.test(input)) {
    reply = he ? 'בשמחה. קח את הזמן; כשתרצה להמשיך, נוכל לחזור להעדפות שכבר ציינת.' : 'Of course. Take your time; when you are ready, we can continue from the preferences you already shared.';
  } else if (/^(?:אחזור עם תאריך|אחזור כשאדע תאריך|I'll come back with a date)[.!\s]*$/i.test(input)) {
    reply = he ? 'בשמחה. כשתדע את התאריך, כתוב לי כאן ונמשיך מהפרטים שכבר מסרת.' : 'Of course. Send the date when you know it and we can continue from the details you already shared.';
  } else if (!state.interest && uncertainDateAnswer(input)
    && !/מה כדאי|מה תמליצ|what (?:would you )?recommend/i.test(input)
    && (/אין לי (?:עדיין )?תאריכ|אין תאריך סופי|עדיין אין תאריך|no dates? yet/i.test(input) || asksRentalDates(lastBotReply) || Boolean(state.booking.datePreference) || state.phase === 'booking' && state.step === 'rental_dates')) {
    reply = he ? 'אין בעיה. כשתדעו את התאריכים המדויקים, כתבו אותם כאן ונוכל להמשיך מהפרטים שכבר מסרתם.' : 'No problem. When you know the exact dates, send them here and we can continue with the details you already shared.';
  } else if (!state.interest && vagueDateAnswer(input)
    && !/מה כדאי|מה תמליצ|what (?:would you )?recommend/i.test(input)
    && (!state.booking.pickupDate || !state.booking.returnDate)) {
    const previous = state.booking.datePreference;
    state.booking.datePreference = [previous, input].filter(Boolean).join(' עד ').slice(0, 120);
    const clarifiedAlready = state.history.some(entry => entry.from === 'bot' && /באילו תאריכים מדויקים|כשתדעו את התאריכים המדויקים|which exact pickup and return dates|when you know the exact dates/i.test(entry.text));
    reply = clarifiedAlready
      ? (he ? 'הבנתי את הטווח המשוער. כשתדעו את התאריכים המדויקים, כתבו אותם כאן ונמשיך.' : 'I understand the approximate timing. Send the exact dates here when you know them and we can continue.')
      : (he ? 'הבנתי את הכיוון. כדי לבדוק זמינות ולהכין בקשה, באילו תאריכים מדויקים תרצו לאסוף ולהחזיר את הרכב? אפשר לכתוב למשל 2/11–26/11.' : 'I understand the approximate timing. Which exact pickup and return dates would you like? For example, 2/11–26/11.');
  } else if (state.phase === 'booking' && state.step === 'rental_age' && /אני לא מבין|לא הבנתי|מה זאת אומרת|i don'?t understand|what do you mean/i.test(input) && /מגיל 21|aged 21 or older/i.test(lastBotReply)) {
    reply = he ? 'אם הנהג הראשי בן 20, אי אפשר להשכיר על שמו. אם אדם אחר בן 21 ומעלה יהיה הנהג הראשי, אפשר להמשיך עם קבוצת הגיל שלו בכפוף לתנאי הרכב והביטוח.' : 'A 20-year-old cannot be the main renter. If someone aged 21 or older will be the main driver, we can continue with that person’s age group, subject to the vehicle and insurance terms.';
  } else if (state.phase === 'booking' && state.step === 'rental_dates' && affirms(input) && /כשתדעו את התאריכים המדויקים|when you know the exact dates/i.test(lastBotReply)) {
    reply = he ? 'בסדר. כשתדעו את התאריכים, כתבו אותם כאן ונמשיך מהפרטים שכבר מסרתם.' : 'Of course. Send the dates when you know them and we will continue with the details already shared.';
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
    const explicitRentalDates = /אני צריך(?:ה)? אותו|אנחנו צריכים אותו|I need it|we need it/i.test(input) && Boolean(singleDateAnswer(input) || explicitDateRange(input));
    const resumedIntake = state.phase === 'explore' && !state.interest && (asksRentalDates(lastBot) || Boolean(state.booking.datePreference))
      && (affirms(input) || explicitRentalDates || Boolean(priorVehicleRequest) && acceptsDateIntake);
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
    const statedDays = statedRange ? Math.round((Date.parse(statedRange.returnDate) - Date.parse(statedRange.pickupDate)) / 86_400_000) : 0;
    const mentionedOneWeek = state.history.some(entry => entry.from === 'customer' && /(?:לשבוע|למשך שבוע|לשבוע אחד|for (?:one |a )week|for one week)/i.test(entry.text));
    const mentionedOneMonth = state.history.some(entry => entry.from === 'customer' && /(?:לשכור|השכרה|רכב).{0,20}לחודש|למשך חודש|for (?:one |a )month/i.test(entry.text));
    const durationMismatch = Boolean(statedRange) && (statedDays > 14 && mentionedOneWeek || mentionedOneMonth && (statedDays < 21 || statedDays > 45)) && !/למעשה|בעצם|שיניתי|actually|changed my plans/i.test(input);
    if (durationMismatch) state.durationClarification = true;
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
    if (/אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input)) state.booking.returnLocation = state.booking.pickupLocation;
    const statedAgeRange = driverAgeRange(input, state);
    if (statedAgeRange) state.booking.driverAgeRange = statedAgeRange;
    const declines = /לא רוצה להזמין|לא מבקש להזמין|אל תזמין|לא עכשיו|רק מתעניין|עדיין בודק|don't book|cancel this request|not ready to book|just looking/i.test(input);
    const modelSupportedProceed = reading?.route === 'book' && /^(?:כן|יאללה|בוא|בואי|yes|okay|ok|go ahead|let's proceed)/i.test(input)
      && /להתחיל.{0,25}(?:בקשה|הזמנה)|start.{0,25}(?:request|booking)/i.test(lastBot);
    const acceptsRentalOffer = confirmedOffer;
    const asksHuman = /(?:רוצה|אפשר|צריך|צריכה).{0,22}(?:לדבר|נציג|בן אדם)|(?:לדבר|נציג|בן אדם).{0,22}(?:בבקשה|אפשר|רוצה)|\b(?:speak|talk|connect)\b.{0,28}\b(?:human|representative|person)\b|\b(?:human|representative|real person)\b.{0,20}\b(?:please|help)\b/i.test(input);
    const clearlyRental = /לשכור|השכרה|rental|rent/i.test(input);
    const leaveVehicleOpen = /(?:leave|keep).{0,30}(?:vehicle|car).{0,30}(?:open|undecided)|(?:not|don'?t).{0,30}(?:choose|decide).{0,30}(?:vehicle|car)/i.test(input);
    const wantsToContinueRental = !state.interest && (/^(?:אני רוצה להתקדם|רוצה להתקדם|בוא(?:ו)? נתקדם|I want to proceed|let'?s continue)[.!\s]*$/i.test(input)
      || /\b(?:let'?s|let us) continue\b/i.test(input))
      && Boolean(state.booking.pickupDate || state.booking.vehicleNeed || state.booking.passengers || offersRentalRequest(lastBot));
    const wantsBooking = !declines && !asksHuman && ((explicitBooking(input) && (!state.interest || clearlyRental)) || modelSupportedProceed || acceptsRentalOffer || wantsToContinueRental || state.phase === 'booking');
    const rentalPivot = /מעדיף (?:את ה)?השכרה|מעדיף לשכור|עדיף לי לשכור|אעדיף לשכור|חוזר להשכרה|רוצה לשכור במקום|prefer (?:a )?rental|prefer to rent|back to renting/i.test(input);
    const specificProblem = /חויבתי|חיוב כפול|חיוב שגוי|שילמתי פעמיים|תקלה בהזמנה|(?:רכב|הרכב).{0,35}מלוכלך|לא קיבלתי|(?:מזגן|מיזוג).{0,25}(?:לא עובד|מקולקל)|(?:air conditioning|car ac).{0,25}(?:not working|broken)|double charg|charged twice|wrong charge|billing issue|dirty car|booking problem/i.test(input);
    const statedVehicle = customerVehicleChoice(input, state);
    if (acceptsRentalOffer && !state.booking.vehicleNeed) {
      const offeredVehicle = explicitVehicleNeed(lastBot, state.locale);
      if (offeredVehicle) state.booking.vehicleNeed = offeredVehicle;
    }
    const commercialVehicle = reading?.route === 'sale' || reading?.route === 'leasing' || /ליסינג|לקנות|למכירה|לרכישה|buy|purchase|leasing/i.test(input);
    if (statedVehicle && (wantsBooking || state.phase === 'booking' || !commercialVehicle && !state.interest)
      && (!state.booking.vehicleNeed || /^רכב (?:לנוסע אחד|ל־\d+ נוסעים)|^car for \d+ passengers?/i.test(state.booking.vehicleNeed)
        || /בעצם|מעדיף|במקום|actually|instead|prefer/i.test(input))) state.booking.vehicleNeed = statedVehicle;
    if (rentalPivot) state.interest = undefined;
    else if (reading?.route === 'leasing' || /ליסינג|leasing/i.test(input)) state.interest = 'leasing';
    else if (reading?.route === 'sale' || state.phase !== 'booking' && /נסיעת מבחן|test drive/i.test(input) || /לקנייה|למכירה|רכב לקנות|רוצה לקנות|לקנות (?:את ה)?רכב|buy (?:a |the )?(?:used |new )?(?:family |compact |small |suv )?(?:car|vehicle)|purchase (?:a |the )?car|car for sale|used car/i.test(input)) state.interest = 'sale';
    if (durationMismatch) {
      reply = mentionedOneMonth
        ? (he ? 'ציינת השכרה לחודש, אבל התאריכים ששלחת הם לתקופה אחרת. אלה התאריכים הרצויים?' : 'You mentioned a month-long rental, but the dates you sent cover a different period. Are those the dates you want?')
        : (he ? 'ציינת נסיעה של כשבוע, אבל התאריכים ששלחת הם לתקופה ארוכה יותר. אלה התאריכים הרצויים?' : 'You mentioned a trip of about a week, but the dates you sent cover a longer period. Are those the dates you want?');
    } else if (declines) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'בסדר, לא שלחתי בקשה. הפרטים יישארו כאן אם תרצה להמשיך להתלבט.' : 'Okay, I have not sent a request. The details stay here if you want to think it over.';
    } else if (rentalPivot) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'הבנתי, נחזור לבדוק השכרה. לתקופה שתבחר חשוב להתאים רכב וקילומטראז׳ למסלול; באילו תאריכים תרצה לאסוף ולהחזיר?' : 'Understood, let us check a rental. The vehicle and mileage terms should fit the period you choose. What pickup and return dates do you need?';
    } else if (specificProblem) {
      state.phase = 'service'; state.step = 'menu'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue'; escalate = true;
      reply = he ? `תודה שפניתם אלינו. נציג SmartCar יבדוק את המקרה ויחזור אליכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thank you for contacting us. A SmartCar representative will review your case and follow up; for immediate help call ${OFFICE_PHONE}.`;
    } else if (/את[ה]? סוגר(?:ת)? לי רכב|סוגר(?:ת)? לי (?:את ה)?רכב|האם (?:זה|הרכב) (?:כבר )?סגור|are you booking (?:me |the )?(?:a )?car|is (?:the )?car booked/i.test(input)) {
      reply = he ? 'אפשר להכין בקשת השכרה עם הפרטים שלך. הרכב והמחיר יאושרו לפני שההזמנה תהיה סופית. תרצה שנתקדם לבקשה?' : 'We can prepare a rental request with your details. The car and price are confirmed before the booking becomes final. Would you like to proceed with the request?';
    } else if (wantsBooking) {
      state.phase = 'booking';
      state.interest = undefined;
      state.requestKey ??= randomUUID();
      if (leaveVehicleOpen) {
        state.booking.vehicleNeed = he ? 'סוג רכב פתוח להתאמה' : 'vehicle group to be matched';
      } else if (state.booking.passengers && (!state.booking.vehicleNeed || /^(?:rental car|car|vehicle|רכב|רכב להשכרה|\d{1,2}\s+(?:אנשים|נוסעים|people|passengers)(?:\s|$).*)$/i.test(state.booking.vehicleNeed))) {
        const people = state.booking.passengers;
        const bags = state.booking.luggage;
        state.booking.vehicleNeed = he ? `רכב ${people === 1 ? 'לנוסע אחד' : `ל־${people} נוסעים`}${bags ? ` ול־${bags} מזוודות` : ''}` : `car for ${people} ${people === 1 ? 'passenger' : 'passengers'}${bags ? ` and ${bags} bags` : ''}`;
      }
      const missing = nextMissing(state.booking);
      state.step = bookingStep(missing);
      const asksVehicleAdvice = /מה אתה ממליץ|מה את ממליצה|מה היית ממליץ|איזה רכב כדאי|what (?:car|vehicle) (?:do you )?recommend/i.test(input);
      const openVehicleChoice = /לא יודע|לא יודעת|לא בטוח|לא בטוחה|not sure|don'?t know/i.test(input)
        && /קומפקט|קטן|compact|small car/i.test(lastBot);
      if (openVehicleChoice) {
        state.booking.vehicleNeed = he ? `רכב לנוסע אחד; סוג הרכב ייקבע לפי התאמה` : 'car for one person; vehicle group to be matched';
        const next = nextMissing(state.booking);
        state.step = bookingStep(next);
        reply = he ? `אין בעיה, נשאיר את הבחירה פתוחה ונציין שהרכב מיועד לאדם אחד. ${next ? question(next, state.locale) : summary(state)}` : `No problem. We can leave the car group open and note that it is for one person. ${next ? question(next, state.locale) : summary(state)}`;
      } else if (asksVehicleAdvice && state.booking.passengers === 1) {
        state.step = 'rental_vehicle';
        reply = he ? 'לנסיעה לבד הייתי מתחיל ברכב קומפקטי: נוח לנסיעה ולחניה. אם חשוב לך יותר מקום, אפשר לבדוק גם משפחתית. תרצה שאציין רכב קומפקטי בבקשה, או להשאיר את הסוג פתוח?' : 'For one person I would start with a compact car, which is easier to drive and park. If you prefer more space, we can check a family car. Should I put a compact car on the request or leave the group open?';
      } else if (!missing) reply = summary(state);
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
        const policy = reading?.route === 'policy' || /[?؟]/.test(input) ? getSmartCarServiceAnswer(input, state.locale)?.reply : null;
        if (/אפשר לשנות.{0,20}תאריך|לשנות תאריך.{0,20}בהמשך|שינוי תאריכים|can (?:I|we) change (?:the )?dates?|change (?:the )?dates? later/i.test(input)) {
          reply = he ? 'אפשר לבקש שינוי תאריכים בהמשך. השינוי תלוי בזמינות ובתנאי ההזמנה, ונציג SmartCar יאשר מה אפשרי ואם המחיר משתנה.' : 'You can request a date change later. It depends on availability and the booking terms; a SmartCar representative will confirm what is possible and whether the price changes.';
        } else if (reportedAge && Number(reportedAge) < 21) {
          state.step = 'rental_age';
          reply = he ? 'השכרה אפשרית לנהגים מגיל 21. אם ינהג אדם אחר שעומד בתנאים, אפשר לציין את קבוצת הגיל שלו ונשמח להמשיך.' : 'Rental is available to drivers aged 21 or older. If another eligible person will drive, please tell us their age group and we will be happy to continue.';
        } else if (policy && /מה כדאי|מה תמליצ|what (?:would you )?recommend/i.test(input) && /ביטוח|insurance/i.test(input) && state.booking.vehicleNeed) {
          reply = he
            ? `לפי מה שתיארתם, הייתי מתחיל בבדיקת ${state.booking.vehicleNeed}; התאמה לכיסא בטיחות ולציוד נוודא לפי הדגם. ${policy} ${question(missing, state.locale)}`
            : `From what you described, I would start by checking a ${state.booking.vehicleNeed}; child-seat and luggage fit depend on the model. ${policy} ${question(missing, state.locale)}`;
        } else if (/איך עובד התשלום|איך משלמים|how does payment work|how do (?:i|we) pay/i.test(input)) {
          reply = he
            ? 'הסכום, מועד התשלום ותנאי הפיקדון יפורטו בהצעה ובחוזה לפני אישור ההשכרה. אפשר לשאול כל שאלה על התנאים כשנקבל את ההצעה.'
            : 'The amount, payment timing and deposit terms are set out in the quote and agreement before the rental is confirmed. You can ask about any of those terms when you receive the quote.';
        } else if (policy && /ביטוח|insurance/i.test(input) && lastBot === policy) {
          reply = he
            ? 'הכיסוי הבסיסי כולל ביטוח חובה וכיסוי לנזקי תאונה, אש וגניבה, בכפוף להשתתפות עצמית. בהצעה יופיעו סכום ההשתתפות והאפשרויות להפחתתה.'
            : 'The basic cover includes compulsory liability and accident, fire and theft cover, subject to an excess. Your quote will show that excess and any available reduction options.';
        } else if (/מה עוד צריך|איזה פרטים חסרים|what else do you need|what details are missing/i.test(input)) {
          const labels: Record<BookingKey, string> = { pickupDate: 'תאריך איסוף', returnDate: 'תאריך החזרה', pickupLocation: 'מקום איסוף', returnLocation: 'מקום החזרה', vehicleNeed: 'צרכי הרכב', driverAgeRange: 'קבוצת גיל הנהג', customerName: 'שם', customerEmail: 'מייל' };
          const remaining = ORDER.filter(key => !state.booking[key]);
          reply = he ? `נשארו רק ${remaining.map(key => labels[key]).join(' ו־')}. ${question(missing, state.locale)}` : `I still need ${remaining.join(', ')}. ${question(missing, state.locale)}`;
        } else if (/אפשר לקבל הצעה(?: מסודרת)?|רוצה הצעה(?: מסודרת)?|can (?:I|we) get (?:a )?(?:quote|offer)/i.test(input)) {
          reply = he
            ? `בשמחה, נכין בקשה להצעה מסודרת לפי הרכב שביקשתם. כדי לבדוק מחיר וזמינות, ${!state.booking.pickupDate || !state.booking.returnDate ? 'מה תאריכי האיסוף וההחזרה הרצויים?' : !state.booking.pickupLocation || !state.booking.returnLocation ? 'מאיפה תרצו לאסוף ולהחזיר את הרכב?' : 'נמשיך עם הפרטים החסרים לבקשה.'}`
            : `Of course. We can prepare a detailed quote request for the car you want. To check price and availability, ${!state.booking.pickupDate || !state.booking.returnDate ? 'what pickup and return dates do you need?' : !state.booking.pickupLocation || !state.booking.returnLocation ? 'where would you like to collect and return the car?' : 'we can continue with the remaining request details.'}`;
        } else if (wasBooking && affirms(input) && missing === 'pickupDate') {
          reply = /כתבו את תאריך האיסוף|type the pickup date/i.test(lastBot)
            ? (he ? 'כשתדעו את תאריך האיסוף, כתבו לי אותו ונמשיך.' : 'When you know the pickup date, send it here and we can continue.')
            : (he ? 'כדי להתקדם, כתבו את תאריך האיסוף עצמו, למשל 15/11.' : 'To continue, please send the pickup date itself, for example 15/11.');
        } else if (wasBooking && missing === 'pickupDate' && explicitBooking(input)
          && state.history.some(entry => entry.from === 'bot' && entry.text.includes(question('pickupDate', state.locale)))) {
          reply = he ? 'בשמחה, נכין בקשת השכרה. כדי לבדוק את הרכב שביקשתם דרושים תאריכי האיסוף וההחזרה; כתבו לי את שניהם ונמשיך.' : 'Of course, we can prepare a rental request. I need the pickup and return dates to check the car you want; send both and we can continue.';
        } else if (wasBooking && statedVehicle && missing === 'driverAgeRange' && state.booking.vehicleNeed !== previousVehicleNeed) {
          const changedChoice = /בעצם|מעדיף|במקום|actually|instead|prefer/i.test(input);
          reply = he
            ? `${changedChoice ? `עדכנתי את סוג הרכב ל${state.booking.vehicleNeed}` : `רשמתי ${state.booking.vehicleNeed}`}. נשארה קבוצת הגיל של הנהג — 21–23 או 24+?`
            : `${changedChoice ? `I updated the vehicle to ${state.booking.vehicleNeed}` : `I have ${state.booking.vehicleNeed}`}. Which driver age group applies: 21–23 or 24+?`;
        } else if (wasBooking && statedAgeRange && missing === 'customerName' && lastBot.includes(question('customerName', state.locale))) {
          reply = he
            ? `קבוצת הגיל ${statedAgeRange === '24-plus' ? '24+' : '21–23'} כבר רשומה. ${question('customerName', state.locale)}`
            : `The ${statedAgeRange === '24-plus' ? '24+' : '21–23'} age group is already noted. ${question('customerName', state.locale)}`;
        } else if (policy && missing === 'pickupLocation' && /מאיפה אפשר לאסוף|איפה אפשר לאסוף|where can (?:i|we) pick up/i.test(input)) {
          reply = `${policy} ${question('pickupLocation', state.locale)}`;
        } else if (wasBooking && missing === 'driverAgeRange' && /לסיים את הבקשה|finish (?:the|my) request/i.test(input)
          && /קבוצת הגיל|age group/i.test(lastBot)) {
          reply = he
            ? `בשמחה. כדי לסיים נצטרך קודם את קבוצת הגיל של הנהג — 21–23 או 24+ — ואז שם ומייל לאישור הבקשה.`
            : `Of course. To finish the request, please give the driver's age group, 21–23 or 24+, then a name and email for the request.`;
        } else if (wasBooking && /^(?:אני רוצה להתקדם|רוצה להתקדם|let'?s proceed|I want to proceed|I would like to make a request)[.!\s]*$/i.test(input)
          && lastBot.includes(question(missing, state.locale))) {
          reply = missing === 'driverAgeRange'
            ? (he ? 'בשמחה. כדי להתקדם חסרה קבוצת הגיל של הנהג: 21–23 או 24+. אחריה נבקש שם ומייל ונציג את הבקשה לאישורכם.' : 'Of course. To move forward I need the driver age group, 21–23 or 24+. Then I will ask for a name and email and show the request for your confirmation.')
            : (he ? `בשמחה. כדי להתקדם נשאר לי הפרט הזה: ${question(missing, state.locale)}` : `Of course. To move forward I still need this detail: ${question(missing, state.locale)}`);
        } else {
          const alreadyAsked = state.history.filter(entry => entry.from === 'bot').slice(-2)
            .some(entry => entry.text.includes(question(missing, state.locale)));
          reply = policy && alreadyAsked ? policy : `${policy ? `${policy}\n\n` : prefix}${question(missing, state.locale)}`;
        }
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
      const cancellationPending = state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text));
      const suppliedReference = /(?:מספר\s+ה?הזמנה|booking\s+(?:number|reference)|reference)\s*(?:שלי|הוא|:|#|is)?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(input)
        || (/^[A-Z0-9-]*\d[A-Z0-9-]{2,}$/i.test(input) && /מספר הזמנה|booking reference/i.test(state.history.at(-1)?.text ?? ''));
      if (!cancellationPending && /לשנות|לשינוי|להאריך|לדחות|לדחייה|להקדים|להזיז|יום ההחזרה|יום מאוחר|change|extend|postpone|move (?:the )?return|return date/i.test(input)) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'booking_change'; escalate = true;
        reply = he ? `קיבלנו את בקשת השינוי. היא תיכנס לתוקף לאחר בדיקת זמינות ואישור SmartCar. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have your change request. It takes effect after SmartCar checks availability and confirms it. For immediate help call ${OFFICE_PHONE}.`;
      } else if (specificProblem || suppliedReference) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = cancellationPending ? 'booking_change' : 'service_issue'; escalate = true;
        reply = cancellationPending
          ? (he ? `קיבלנו את מספר ההזמנה לבקשת הביטול. נציג SmartCar יחזור אליכם; הביטול תקף רק לאחר אישור. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have the reference for your cancellation request. A SmartCar representative will follow up; cancellation takes effect only after confirmation. For immediate help call ${OFFICE_PHONE}.`)
          : (he ? `תודה שפניתם אלינו. נציג SmartCar יבדוק את המקרה ויחזור אליכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thank you for contacting us. A SmartCar representative will review your case and follow up; for immediate help call ${OFFICE_PHONE}.`);
      } else if (answer) reply = answer.reply;
      else if (booking) reply = he ? `מצאתי את ההזמנה שלכם. לבירור או לשינוי נשמח לעזור בטלפון ${OFFICE_PHONE}.` : `I found your booking. For details or changes, we will be happy to help at ${OFFICE_PHONE}.`;
      else reply = he ? `כדי לבדוק מקרה מסוים נדרש מספר ההזמנה. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `To check a specific case, please send the booking reference or call ${OFFICE_PHONE}.`;
    } else if (state.interest) {
      const answer = commercialReply(input, state);
      reply = answer.reply; escalate = answer.escalate;
      if (escalate) { state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'commercial'; }
    } else if (state.phase === 'explore' && /קומפקט|רכב קטן|compact|small car/i.test(input)
      && /משפחת|family car/i.test(input) && /למה|יותר|לעומת|הבדל|why|versus|compared|more comfortable/i.test(input)) {
      reply = he
        ? `ל${state.booking.passengers === 1 ? 'נסיעה לבד' : 'צרכים שתיארתם'}${state.booking.luggage === 1 ? ' עם מזוודה אחת' : ''}, קומפקטי הוא נקודת פתיחה בגלל הגודל והחניה. משפחתי מציע בדרך כלל יותר מקום; נוחות והתאמה לציוד תלויות בדגם המסוים. אפשר להשאיר את שתי האפשרויות פתוחות עד שתבחרו.`
        : `For ${state.booking.passengers === 1 ? 'solo travel' : 'the needs you described'}${state.booking.luggage === 1 ? ' with one suitcase' : ''}, a compact is a starting point for easier parking. A family car usually offers more room; comfort and luggage fit depend on the actual model. We can keep both options open until you choose.`;
    } else if (state.phase === 'explore' && hasVehicleContext(state.booking, input) && /אפשר לשנות.{0,20}תאריך|לשנות תאריך.{0,20}בהמשך|שינוי תאריכים|can (?:I|we) change (?:the )?dates?|change (?:the )?dates? later/i.test(input)) {
      reply = he
        ? `אפשר לבקש שינוי תאריכים בהמשך, בכפוף לזמינות ולתנאי ההזמנה. ${!state.booking.pickupDate || !state.booking.returnDate ? 'לאילו תאריכים תצטרכו את הרכב?' : !state.booking.pickupLocation ? 'מאיפה תרצו לאסוף את הרכב?' : 'נוכל להמשיך לפי הפרטים שכבר מסרתם.'}`
        : `You can request a date change later, subject to availability and the booking terms. ${!state.booking.pickupDate || !state.booking.returnDate ? 'What dates do you need the car?' : !state.booking.pickupLocation ? 'Where would you like to collect the car?' : 'We can continue with the details you already gave.'}`;
    } else if (statedRange && state.booking.pickupDate && state.booking.returnDate
      && /אפשר (?:לבקש )?שינוי תאריכים|אפשר לשנות תאריך|can (?:I|we) (?:request a )?change (?:the )?dates?/i.test(lastBot)) {
      reply = he
        ? `הבנתי את תאריכי האיסוף וההחזרה. ${question('pickupLocation', state.locale)}`
        : `I have noted the pickup and return dates. ${question('pickupLocation', state.locale)}`;
    } else if (statedRange && state.booking.pickupDate && state.booking.returnDate) {
      reply = advice(input, state, reading);
    } else if (/מה כדאי|מה תמליצ|what (?:would you )?recommend/i.test(input) && /ביטוח|insurance/i.test(input) && state.booking.vehicleNeed) {
      const insurance = getSmartCarServiceAnswer(input, state.locale)?.reply ?? '';
      reply = he ? `לפי מה שתיארתם, הייתי מתחיל בבדיקת ${state.booking.vehicleNeed}; התאמה לכיסא בטיחות ולציוד נוודא לפי הדגם. ${insurance}` : `From what you described, I would start by checking a ${state.booking.vehicleNeed}; child-seat and luggage fit depend on the model. ${insurance}`;
    } else if (/כיסא(?:\s+ה?)?בטיחות|child seat|car seat/i.test(input) && /מה חשוב|מה צריך|מה לוודא|what.*(?:check|verify)|what matters/i.test(input)) {
      reply = advice(input, state, reading);
    } else if (/מה חשוב לבדוק ברכב קטן|מה חשוב ברכב קטן|what(?: should I| to) (?:check|look for) in a (?:small|compact) car/i.test(input)) {
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
    } else if (/טעינה|להטעין|מטעינ|עמדת טעינה|\bcharg(?:e|ing|er)\b/i.test(input) && /חשמל|חשמלי|electric|\bEV\b/i.test(input)) {
      reply = he ? 'אופן הטעינה והעלות תלויים בדגם ובעמדת הטעינה. לפני ההשכרה נוכל להסביר את אופן הטעינה של הרכב המסוים ואת התנאים הרלוונטיים. האם מדובר ברכב שכבר שכרתם או שאתם מחפשים רכב חשמלי?' : 'Charging steps and cost depend on the car and charging station. Before a rental, we can explain the specific car and relevant terms. Is this about a car you already rented or are you looking for an electric car?';
    } else if (/(?:בן|בת|גיל|aged?)\s*(?:21|22|23)(?!\d)/i.test(input) && PRICE_OR_AVAILABILITY.test(input)) {
      reply = he ? `${getSmartCarServiceAnswer(input, 'he')?.reply ?? 'אפשר לשכור מגיל 21, בכפוף לתנאי הרכב והביטוח.'} המחיר המדויק תלוי ברכב, בתאריכים ובתנאים האישיים. לאילו תאריכים תצטרכו אותו?` : `${getSmartCarServiceAnswer(input, 'en')?.reply ?? 'Rental is available from age 21, subject to vehicle and insurance terms.'} The exact price depends on the car, dates and applicable terms. What dates do you need it?`;
    } else if (/מסירה.{0,20}(?:בית|כתובת)|(?:מביאים|תביאו|להביא).{0,25}(?:בית|כתובת)|עד הבית|deliver(?:y)? (?:to )?(?:my |our )?(?:home|address)|bring (?:the )?car to (?:my |our )?(?:home|address)/i.test(input)) {
      reply = he ? 'אפשר לתאם מסירה לכתובת בארץ מראש, בכפוף לזמינות ולתנאי ההצעה. באיזו עיר ובאילו תאריכים תצטרכו את הרכב?' : 'Delivery to an address in Israel can be arranged in advance, subject to availability and the quote terms. Which city and dates do you need the car for?';
    } else if (PRICE_OR_AVAILABILITY.test(input)) {
      reply = /מחיר סופי|הצעה סופית|final (?:price|quote)/i.test(input) && state.history.at(-1)?.text.includes(priceAnswer(state.locale))
        ? (he ? 'נשמח להכין הצעה מדויקת לפי התאריכים, הרכב והתוספות שתבחרו. תרצו שנתחיל בקשה?' : 'We will be happy to prepare an accurate offer for your dates, vehicle and chosen extras. Shall we start a request?')
        : AVAILABILITY_ONLY.test(input) && !/מחיר|עלות|עול|יעל|price|cost|rate/i.test(input)
        ? availabilityAnswer(state.locale)
        : `${priceAnswer(state.locale)} ${!state.booking.pickupDate ? (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?') : !state.booking.returnDate ? question('returnDate', state.locale) : !state.booking.pickupLocation ? question('pickupLocation', state.locale) : !state.booking.returnLocation ? question('returnLocation', state.locale) : (he ? 'תרצו שנתקדם לבקשה עם הפרטים שכבר מסרתם?' : 'Shall we continue with the details you already gave?')}`;
    } else if ((reading?.route === 'policy' || /[?؟]/.test(input)) && getSmartCarServiceAnswer(input, state.locale)) {
      const fact = getSmartCarServiceAnswer(input, state.locale);
      const alreadyAnsweredInsurance = fact!.topic === 'insurance'
        && state.history.some(entry => entry.from === 'bot' && entry.text === fact!.reply);
      reply = fact!.topic === 'different_location' && state.booking.pickupLocation && state.booking.returnLocation
        ? (he
          ? `רשמתי איסוף ב${state.booking.pickupLocation} והחזרה ב${state.booking.returnLocation}. אפשר לבקש מסלול כזה בתיאום מראש; שירות נתב״ג עשוי להיות כרוך בתוספת. כשתדעו את התאריכים, נבדוק זמינות והצעה מתאימה.`
          : `I have pickup at ${state.booking.pickupLocation} and return in ${state.booking.returnLocation}. We can check that route by prior arrangement; airport service may carry an additional charge. Once you know the dates, we can check availability and a quote.`)
        : alreadyAnsweredInsurance
        ? (he
          ? 'הכיסוי הבסיסי כולל ביטוח חובה וכיסוי לנזקי תאונה, אש וגניבה, בכפוף להשתתפות עצמית. בהצעה יפורטו סכום ההשתתפות והאפשרויות להפחתתו. יש חלק מסוים בביטוח שתרצו שאסביר?'
          : 'Basic cover includes compulsory liability and accident, fire and theft cover, subject to an excess. The quote will show that excess and any reduction options. Is there a particular part you would like me to explain?')
        : fact!.topic === 'branches' && state.booking.pickupDate && !state.booking.pickupLocation
        ? `${fact!.reply} ${question('pickupLocation', state.locale)}` : fact!.reply;
    } else if (/^(?:תודה(?: רבה)?[.!\s]*|תודה[,!]?\s*אעדכן כש(?:אדע|יהיו לי) תאריכים[.!\s]*|thanks?(?: a lot)?[.!\s]*|thank you[.!\s]*)$/i.test(input)) {
      reply = he ? 'בשמחה. כשתרצו להמשיך, אני כאן.' : 'You are welcome. I am here when you are ready.';
    } else if (/איזה פרטים|מה (?:צריך|תצטרכו)|what details|what do you need/i.test(input)) {
      reply = he ? 'כדי לבדוק השכרה נצטרך תאריכי איסוף והחזרה, מיקומים, סוג רכב או מספר נוסעים וציוד, וקבוצת גיל נהג 21–23 או 24+. שם ומייל נבקש רק אם תרצו לשלוח בקשה.' : 'To check a rental we need pickup and return dates, locations, a vehicle type or passenger and luggage details, and the driver age group: 21–23 or 24+. We only ask for name and email if you choose to send a request.';
    } else if (state.phase === 'explore' && state.booking.passengers === 1 && /לא יודע|לא יודעת|לא בטוח|לא בטוחה|not sure|don'?t know/i.test(input) && /קומפקט|קטן|compact|small car/i.test(lastBot)) {
      reply = he ? 'זה בסדר, לא צריך לבחור דגם עכשיו. לנסיעה לבד רכב קומפקטי הוא כיוון טוב, ואפשר להשאיר את הבחירה פתוחה. הפרטים שמסרת שמורים כאן כשתרצה להמשיך.' : 'That is fine; you do not have to choose a model now. A compact is a good starting point for one person, and we can leave the choice open. Your details are here when you want to continue.';
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
