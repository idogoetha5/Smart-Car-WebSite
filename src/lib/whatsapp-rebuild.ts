import { OFFICE_PHONE } from '@/lib/constants';
import { randomUUID } from 'node:crypto';
import { termsConsent } from '@/lib/consent';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { readBotTurn, type BotReading, type GeminiBotContext, type VehicleDirection } from '@/lib/whatsapp-rebuild-gemini';

type Locale = 'he' | 'en';
type Phase = 'explore' | 'booking' | 'service';
type BookingKey = 'pickupDate' | 'returnDate' | 'pickupLocation' | 'returnLocation' | 'vehicleNeed' | 'driverAgeRange' | 'customerName' | 'customerEmail';
type BookingDraft = Partial<Record<BookingKey, string>> & { passengers?: number; luggage?: number; childSeats?: number };
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
const UNSAFE_CLAIM = /(?:יש לנו|יש אצלנו|זמין עכשיו|זמין בדיוק|פנוי עכשיו|מובטח|בטוח ש|בהחלט ייכנס|בהחלט יתאים|מזווד.{0,25}(?:ייכנס|יספיק)|חיסכון בדלק|we have available|available for (?:your|the) (?:trip|dates)|guaranteed|(?:definitely|easily) fits?|fits? (?:your|two|three|the) (?:bags|suitcases|luggage)|great fuel efficiency|fuel savings|confirmed booking)/i;
const PRICE_OR_AVAILABILITY = /מחיר|עלות|כמה.{0,12}(?:עול|יעל)|(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:price|cost|rate|available|availability)\b/iu;
const AVAILABILITY_ONLY = /(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:available|availability|in stock)\b/iu;
const MONTHS: Record<string, number> = { ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12, january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const EXPLICIT_RANGE = new RegExp(`(\\d{1,2})\\s*(?:עד|[-–]|to|until)\\s*(\\d{1,2})\\s+(?:ב)?(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?`, 'iu');

function priceAnswer(locale: Locale): string {
  return locale === 'he'
    ? 'המחיר באתר הוא הערכה, לא הצעה סופית. מחיר וזמינות מדויקים נבדקים לפי התאריכים, הרכב והתוספות; אין לי אישור מלאי כרגע.'
    : 'The website price is an estimate, not a final offer. Exact price and availability depend on the dates, vehicle and extras; I cannot confirm inventory here.';
}

function availabilityAnswer(locale: Locale): string {
  return locale === 'he'
    ? 'אין לי גישה למלאי חי, ולכן לא אוכל לאשר שרכב מסוים פנוי. שלחו תאריכים ואבדוק עם הצוות מה אפשר להציע.'
    : 'I do not have live inventory access, so I cannot confirm a specific car is available. Send your dates and the team can check options.';
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

function applyExplicitLocations(input: string, draft: BookingDraft): void {
  const stop = '(?=\\s+(?:ו?החזרה|להחזיר|return|drop.?off)|[,.!?]|$)';
  const hePickup = input.match(new RegExp(`(?:איסוף|לאסוף)\\s+[במ]([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const enPickup = input.match(new RegExp(`pick.?up\\s+(?:at|from)\\s+([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const pickup = (hePickup ?? enPickup)?.trim();
  if (pickup) draft.pickupLocation = pickup;
  if (draft.pickupLocation && /אותו מקום|שם גם|same place|same location/i.test(input)) draft.returnLocation = draft.pickupLocation;
}

function explicitBooking(input: string): boolean {
  if (/לא רוצה להזמין|רק מתעניין|רק שואל|לא עכשיו|not ready|just asking|don't book|do not book/i.test(input)) return false;
  if (/[?؟]/.test(input) && /כדאי|האם|should|would it|how/i.test(input)) return false;
  return /אני רוצה (?:להזמין|לשכור)|בוא(?:ו)? נתקדם|בוא(?:ו)? נלך על זה|אפשר להתחיל (?:הזמנה|בקשה)|תכין(?:ו)? (?:לי )?בקשה|אני (?:אזמין|אשכור)|I(?:'d| would) like to (?:book|rent)|let'?s (?:book|proceed)|I want to (?:book|rent)|go ahead with (?:the )?(?:rental|request)/i.test(input);
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
  if (/פנצ[׳']?ר|נתקעתי|לא מניע|רעש.{0,25}בלמ|בלמ.{0,25}רעש|עשן|תקלה ברכב|flat tire|breakdown|won'?t start|brake.{0,25}(?:noise|problem)|(?:noise|problem).{0,25}brake|(?:אני צריך|אני זקוק|תשלחו|שולחים).{0,25}גרר|גרר.{0,15}(?:עכשיו|דחוף)|(?:need|send).{0,25}tow|tow.{0,15}(?:now|urgent)/i.test(input)) return 'breakdown';
  return null;
}

function commercialReply(input: string, state: RebuildState): { reply: string; escalate: boolean } {
  const he = state.locale === 'he';
  const previous = state.history.filter(item => item.from === 'customer').map(item => item.text).join(' ');
  const context = `${previous} ${input}`;
  if (state.interest === 'leasing') {
    if (/הבדל|difference|compare/i.test(input)) return { reply: he ? 'ליסינג פרטי מיועד לשימוש אישי, ועסקי לצורכי העסק. ההתחייבויות, השירותים והמחיר נקבעים רק בהצעה ובחוזה של המסלול המתאים. תרצה לבדוק מסלול פרטי או עסקי?' : 'Private leasing serves personal use; business leasing serves a company. Commitments, services and price are set in the specific offer and contract. Which route would you like us to check?', escalate: false };
    if (/מחיר|חודשי|תשלום|כמה|price|monthly|cost/i.test(input)) return { reply: he ? 'אי אפשר להבטיח תשלום חודשי לפני הצעה אישית. המחיר תלוי במסלול, ברכב, בתקופה ובקילומטראז׳. אפשר להעביר לצוות את הפרטים שכבר ציינת כדי שיבדוק הצעה.' : 'I cannot promise a monthly payment before a tailored offer. It depends on the plan, car, term and mileage. I can pass the details you supplied to the team for a quote.', escalate: false };
    if (/הצעה|צעד הבא|להתקדם|quote|next step|proposal/i.test(input)) return { reply: he ? `כדי לקבל הצעת ליסינג, הצוות צריך לבדוק את המסלול, התקופה, הקילומטראז׳ וסוג הרכב. אשאיר את פרטי השיחה לטיפול הצוות; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `For a leasing quote, the team needs to check the plan, term, mileage and vehicle. I will leave this conversation for the team; you can also call ${OFFICE_PHONE}.`, escalate: true };
    if (!/לשנה|שנה|חודש|year|month/i.test(context)) return { reply: he ? 'ב־SmartCar אפשר לבדוק ליסינג פרטי או עסקי. לכמה זמן תרצה את הרכב?' : 'SmartCar can check private or business leasing. What term do you have in mind?', escalate: false };
    if (!/קילומ|ק״מ|קמ|mileage|km/i.test(context)) return { reply: he ? 'רשמתי את משך הליסינג. כמה קילומטרים בערך תיסע בשנה?' : 'I have the term. Roughly how many kilometres would you drive each year?', escalate: false };
    return { reply: he ? 'רשמתי את התקופה ואת הקילומטראז׳ שציינת. איזה סוג רכב מתאים לך כדי שהצוות יוכל לבדוק הצעה?' : 'I have the term and mileage you mentioned. What kind of car should the team check for your offer?', escalate: false };
  }
  if (/דגמים|מלאי|זמינ|what cars|models|stock|available/i.test(input)) return { reply: he ? 'אין לי רשימת מלאי מכירה עדכנית, ולכן לא אציג דגם כזמין. אפשר להעביר לצוות את סוג הרכב והתקציב שכבר ציינת לבדיקה.' : 'I do not have live sales stock, so I cannot confirm a model is available. I can pass the vehicle type and budget you mentioned to the team.', escalate: false };
  if (/נסיעת מבחן|test drive/i.test(input)) return { reply: he ? `נסיעת מבחן דורשת תיאום ואישור מול הצוות לפי הרכב הזמין. אפשר לברר זאת בטלפון ${OFFICE_PHONE}; לא נקבע תור בשיחה הזו.` : `A test drive needs team coordination and confirmation for an available car. Please call ${OFFICE_PHONE}; no appointment has been booked here.`, escalate: false };
  if (/מה תצטרכו|לבדוק|הצעה|next step|what do you need|quote/i.test(input)) return { reply: he ? `הסוג, התקציב והעדפות השנתון או הקילומטראז׳ יעזרו לצוות לבדוק רכבים למכירה. אשאיר את פרטי השיחה לטיפול הצוות; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Vehicle type, budget, and preferred year or mileage help the team check sale cars. I will leave the conversation for the team; you can also call ${OFFICE_PHONE}.`, escalate: true };
  if (!/משפחת|קומפקט|עירונ|ג[׳'י]?יפ|סדאן|רכב.{0,12}יד שנייה|family|compact|suv|sedan/i.test(context)) return { reply: he ? 'איזה סוג רכב תרצה לקנות?' : 'What kind of car would you like to buy?', escalate: false };
  if (!/תקציב|אלף|שקל|₪|budget|shekel/i.test(context)) return { reply: he ? 'איזה תקציב תרצה שנבדוק?' : 'What budget should we check?', escalate: false };
  return { reply: he ? 'רשמתי את סוג הרכב והתקציב שציינת. יש שנתון או קילומטראז׳ שחשובים לך, או שתרצה שהצוות יבדוק לפי מה שכבר כתבת?' : 'I have the vehicle type and budget you mentioned. Do you have a preferred year or mileage, or should the team check with these details?', escalate: false };
}

export function isRebuiltSafetyMessage(input: string): boolean { return safety(input) !== null; }

function direction(reading: BotReading | null, draft: BookingDraft, input: string): VehicleDirection {
  const people = draft.passengers ?? 0;
  if (people >= 6) return 'seven_seat';
  if (draft.childSeats || /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input)) return 'family';
  if (people >= 3 || (draft.luggage ?? 0) >= 3) return 'family';
  if (/פגיש|עיר|חניה|city|meeting|parking/i.test(input)) return 'compact';
  return reading?.direction && reading.direction !== 'none' ? reading.direction : 'none';
}

function advice(input: string, state: RebuildState, reading: BotReading | null): string {
  const he = state.locale === 'he';
  if (/כיסא(?:\s+ה?)?בטיחות|child seat|car seat/i.test(input) && /לאן|איפה|מספיק מקום|where|install|enough (?:room|space)/i.test(input)) {
    return he
      ? 'כיסא בטיחות צריך להתקין במושב מתאים לפי הוראות יצרני הרכב והכיסא, לא בתא המטען. לגבי המזוודות, נבדוק מקום בדגם המסוים לפני שנבטיח התאמה. לאילו תאריכים תצטרכו רכב?'
      : 'A child seat must be fitted in a suitable seat following the car and seat makers’ instructions, never in the boot. We need to check luggage space in the actual model before promising a fit. What dates do you need the car?';
  }
  if (/מזווד|מטען|תא מטען|luggage|suitcase|boot|trunk/i.test(input) && /כמה|נכנס|יספיק|מקום|יכול|fit|space|room|how many/i.test(input)) {
    return he
      ? 'כמות המזוודות שתיכנס תלויה בדגם המסוים ובגודל המזוודות. אוכל להציע קבוצת רכב לבדיקה, אבל לא להבטיח התאמה בלי בדיקת הרכב עצמו. כמה נוסעים ומזוודות יהיו?'
      : 'Luggage fit depends on the actual model and suitcase sizes. I can suggest a vehicle group to check, but cannot promise fit without checking that car. How many passengers and suitcases will you have?';
  }
  const group = direction(reading, state.booking, input);
  const topic = /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input) || Boolean(state.booking.childSeats) ? 'child' :
    /פגיש|עיר|חניה|city|meeting|parking/i.test(input) ? 'city' : 'trip';
  const lead = he ? ({ compact: 'הייתי מתחיל מרכב קומפקטי של SmartCar', family: 'הייתי מתחיל ממשפחתית של SmartCar', suv: 'ג׳יפון של SmartCar הוא כיוון לבדיקה', seven_seat: 'הייתי בודק רכב שבעה מקומות של SmartCar', none: 'אפשר לבחור רכב של SmartCar לפי הנסיעה שלכם' } as const)[group]
    : ({ compact: 'I would start with a SmartCar compact', family: 'I would start with a SmartCar family car', suv: 'A SmartCar SUV is a direction to check', seven_seat: 'I would check a SmartCar seven-seater', none: 'We can choose a SmartCar car around your trip' } as const)[group];
  const benefit = he ? topic === 'child' ? 'זה כיוון נוח לבדיקת מקום לנוסעים ולציוד; את התאמת כיסא הבטיחות צריך לוודא בדגם המסוים.' : topic === 'city' ? 'רכב שיעמוד לרשותכם בין היעדים נותן גמישות לאורך היום.' : 'כך אפשר להתאים את המרחב והנוחות למשך הנסיעה ולציוד שלכם.'
    : topic === 'child' ? 'It is a good starting point for passenger and luggage space; the child seat must be checked against the actual car.' : topic === 'city' ? 'Having the car at your disposal gives flexibility between stops during the day.' : 'We can match passenger space and comfort to the trip and your luggage.';
  const next = state.booking.pickupDate ? (he ? 'מאיפה תרצו לאסוף?' : 'Where would you like to pick it up?') : (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?');
  const price = PRICE_OR_AVAILABILITY.test(input) ? `${priceAnswer(state.locale)} ` : '';
  return `${lead}. ${benefit} ${price}${next}`.replace(/\s+/g, ' ').trim();
}

function safeModelReply(reading: BotReading | null, input: string, state: RebuildState): string | null {
  if (!reading || OUTSIDE.test(input) || /תינוק|ילד|כיסא(?:\s+ה?)?בטיחות|baby|child seat|car seat/i.test(input)) return null;
  if (/מזווד|מטען|תא מטען|luggage|suitcase|boot|trunk/i.test(input) && /כמה|נכנס|יספיק|מקום|יכול|fit|space|room|how many/i.test(input)) return null;
  if (PRICE_OR_AVAILABILITY.test(input)) return null;
  const reply = reading.reply;
  if (OUTSIDE.test(reply) || UNSAFE_CLAIM.test(reply) || /₪|\b\d{2,}\b/.test(reply)) return null;
  if (!state.booking.pickupDate && /תאריכים (?:שכבר )?ציינ|dates (?:you(?:'ve| have) )?(?:already )?mentioned/i.test(reply)) return null;
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
      const latest = new Date(`${israelDate()}T00:00:00Z`);
      latest.setUTCFullYear(latest.getUTCFullYear() + 2);
      if (!validDate(field.value) || field.value < israelDate() || field.value > latest.toISOString().slice(0, 10)) continue;
    }
    if ((source === 'pickupLocation' || source === 'returnLocation')
      && !/איסוף|לאסוף|להחזיר|החזרה|pick.?up|return|drop.?off/i.test(input)
      && !(state.phase === 'booking' && state.step === 'rental_locations' && input.trim().split(/\s+/).length <= 3)) continue;
    if (source === 'vehicleNeed' && state.phase !== 'booking' && !explicitBooking(input)) continue;
    state.booking[target] = field.value;
  }
  for (const name of ['passengers', 'luggage', 'childSeats'] as const) {
    const field = fields[name];
    const count = Number(field?.value);
    if (field && input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase()) && Number.isInteger(count) && count >= 0 && count <= 20) state.booking[name] = count;
  }
  if (!state.booking.returnLocation && state.booking.pickupLocation && /אותו מקום|שם גם|same place|same location/i.test(input)) state.booking.returnLocation = state.booking.pickupLocation;
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
    const candidate = explicit ?? (state.step === 'rental_name' && /^[\p{L}' -]{3,60}$/u.test(input.trim()) ? input.trim() : '');
    if (candidate && candidate.split(/\s+/).length <= 4) { state.booking.customerName = candidate; return true; }
  }
  return false;
}

function summary(state: RebuildState): string {
  const b = state.booking;
  const consent = termsConsent(state.locale);
  if (state.locale === 'en') return `Request summary: ${b.vehicleNeed}, ${b.pickupDate} to ${b.returnDate}, pickup ${b.pickupLocation}, return ${b.returnLocation}, driver age ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}, name ${b.customerName}, email ${b.customerEmail}. This is a request, not a confirmed booking. ${consent.text} Terms: https://www.smartcar.co.il/en/terms Privacy: https://www.smartcar.co.il/en/privacy Reply “I confirm” only if you agree to the details and terms and want to send the request.`;
  return `סיכום הבקשה: ${b.vehicleNeed}, מ־${b.pickupDate} עד ${b.returnDate}, איסוף ב${b.pickupLocation}, החזרה ב${b.returnLocation}, גיל נהג ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}, שם ${b.customerName}, מייל ${b.customerEmail}. זו בקשה לבדיקה, לא הזמנה מאושרת. ${consent.text} תנאים: https://www.smartcar.co.il/he/terms פרטיות: https://www.smartcar.co.il/he/privacy שלחו ״אני מאשר/ת״ רק אם אתם מסכימים לפרטים ולתנאים ורוצים לשלוח את הבקשה.`;
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

  const incident = safety(input);
  if (incident) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt ??= new Date().toISOString();
    const recentAlert = state.safetyAlertAt && Date.now() - Date.parse(state.safetyAlertAt) < 24 * 60 * 60 * 1000;
    reply = /גרר|tow|roadside/i.test(input) && recentAlert
      ? (he ? `לא אוכל לאשר שנשלח גרר. הישארו במקום בטוח והתקשרו עכשיו ל־SmartCar לתיאום סיוע: ${OFFICE_PHONE}.` : `I cannot confirm a tow has been dispatched. Stay somewhere safe and call SmartCar now to arrange help: ${OFFICE_PHONE}.`)
      : (he ? `אם הרכב אינו בטוח, אל תמשיכו לנסוע. עצרו במקום בטוח אם אפשר; אם יש סכנה מיידית או נפגעים, פנו לגורמי החירום. התקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `If the car may be unsafe, do not continue driving. Stop somewhere safe if you can; call emergency services if anyone is hurt or in immediate danger. Call SmartCar now: ${OFFICE_PHONE}.`);
    source = 'safety'; escalate = !recentAlert;
    if (escalate) state.safetyAlertAt = new Date().toISOString();
  } else if (state.handedOff) {
    reply = /תודה|thanks|thank you/i.test(input)
      ? (he ? 'בשמחה. שמרו על עצמכם.' : 'You are welcome. Take care.')
      : state.safetyAlertAt
        ? (he ? `תודה על העדכון. אל תמשיכו לנסוע אם יש חשש בטיחותי; לתיאום עזרה התקשרו עכשיו ל־${OFFICE_PHONE}.` : `Thanks for the update. Do not keep driving if the car may be unsafe; call ${OFFICE_PHONE} now to arrange help.`)
        : (he ? `השינוי מחייב בדיקה ואישור של הצוות; לא שיניתי את ההזמנה בשיחה הזו. אפשר להתקשר ל־${OFFICE_PHONE}.` : `The change needs team review and approval; I have not changed your booking here. Please call ${OFFICE_PHONE}.`);
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
      state.completedRequestId = id; state.phase = 'explore'; state.step = 'menu'; state.booking = {};
      delete state.requestKey;
      reply = store.isSimulation ? (he ? 'בסימולציה הבקשה נקלטה לצורכי בדיקה בלבד; לא נוצרה הזמנה אמיתית.' : 'The request was recorded in this simulation only; no real booking was created.') : (he ? `בקשת ההשכרה נשלחה לבדיקה, מספר ${id}. היא עדיין אינה הזמנה מאושרת.` : `Your rental request was sent for review, reference ${id}. It is not a confirmed booking yet.`);
    } else reply = he ? 'לא הצלחתי לשמור את הבקשה כרגע. לא נוצרה הזמנה; אפשר לנסות שוב או להתקשר למשרד.' : 'I could not save the request. No booking was created; please try again or call the office.';
    }
  } else {
    privateTurn = state.phase === 'booking' && (state.step === 'rental_name' || state.step === 'rental_email');
    const gotPrivate = privateDetail(input, state);
    privateTurn ||= gotPrivate;
    let reading: BotReading | null = null;
    if (!gotPrivate && !(state.phase === 'booking' && state.step === 'rental_age' && driverAgeRange(input, state)) && !EMAIL.test(input) && !/(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}/.test(input)) {
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
    applyExplicitLocations(input, state.booking);
    const statedAgeRange = driverAgeRange(input, state);
    if (statedAgeRange) state.booking.driverAgeRange = statedAgeRange;
    const declines = /לא רוצה להזמין|לא מבקש להזמין|אל תזמין|לא עכשיו|רק מתעניין|עדיין בודק|don't book|cancel this request|not ready to book|just looking/i.test(input);
    const lastBot = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
    const modelSupportedProceed = reading?.route === 'book' && /^(?:כן|יאללה|בוא|בואי|yes|okay|ok|go ahead|let's proceed)/i.test(input)
      && /להתחיל.{0,25}(?:בקשה|הזמנה)|start.{0,25}(?:request|booking)/i.test(lastBot);
    const wantsBooking = !declines && (explicitBooking(input) || modelSupportedProceed || state.phase === 'booking');
    const rentalPivot = /מעדיף (?:את ה)?השכרה|חוזר להשכרה|רוצה לשכור במקום|prefer (?:a )?rental|back to renting/i.test(input);
    if (rentalPivot) state.interest = undefined;
    else if (reading?.route === 'leasing' || /ליסינג|leasing/i.test(input)) state.interest = 'leasing';
    else if (reading?.route === 'sale' || /לקנייה|למכירה|רכב לקנות|buy a car|car for sale/i.test(input)) state.interest = 'sale';
    if (declines) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'בסדר, לא שלחתי בקשה. הפרטים יישארו כאן אם תרצה להמשיך להתלבט.' : 'Okay, I have not sent a request. The details stay here if you want to think it over.';
    } else if (rentalPivot) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'הבנתי, נחזור לבדוק השכרה. לחודש וחצי חשוב להתאים רכב וקילומטראז׳ למסלול ההשכרה; באילו תאריכים תרצה לאסוף ולהחזיר?' : 'Understood, let us check a rental instead. For a longer rental, the vehicle and mileage terms matter. What pickup and return dates do you need?';
    } else if (wantsBooking) {
      state.phase = 'booking';
      state.requestKey ??= randomUUID();
      const missing = nextMissing(state.booking);
      state.step = bookingStep(missing);
      if (!missing) reply = summary(state);
      else {
        const prefix = PRICE_OR_AVAILABILITY.test(input) ? `${priceAnswer(state.locale)} `
          : /הזמנה סופית|הזמנה מאושרת|final booking|confirmed booking/i.test(input)
            ? (he ? 'זו בקשה לבדיקה בלבד, לא הזמנה מאושרת. ' : 'This is a request for review, not a confirmed booking. ')
            : '';
        const policy = reading?.route === 'policy' ? getSmartCarServiceAnswer(input, state.locale)?.reply : null;
        reply = `${policy ? `${policy}\n\n` : prefix}${question(missing, state.locale)}`;
      }
    } else if (reading?.route === 'human' || /(?:דבר|לדבר|נציג|בן אדם|human|representative|person)/i.test(input) && /רוצה|אפשר|need|want|speak/i.test(input)) {
      state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); escalate = true;
      reply = he ? `כדי שהצוות יטפל בזה, התקשרו ל־SmartCar: ${OFFICE_PHONE}.` : `Please call SmartCar so the team can handle this: ${OFFICE_PHONE}.`;
    } else if (reading?.route === 'service' || /הזמנה קיימת|ההזמנה שלי|שכרתי|existing booking|my booking|I rented/i.test(input)) {
      state.phase = 'service';
      const booking = await store.activeBooking(phone);
      const answer = getSmartCarServiceAnswer(input, state.locale);
      if (/לשנות|לשינוי|להאריך|יום ההחזרה|יום מאוחר|change|extend|return date/i.test(input)) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); escalate = true;
        reply = he ? `שינוי הזמנה דורש בדיקת זמינות ואישור של הצוות; לא שיניתי אותה עכשיו. השיחה נשמרת לטיפול, ואפשר להתקשר ל־${OFFICE_PHONE}.` : `A booking change needs the team's availability check and approval; I have not changed it. This conversation is retained for the team, and you can call ${OFFICE_PHONE}.`;
      } else if (answer) reply = answer.reply;
      else if (booking) reply = he ? `מצאתי הזמנה במצב ${booking.status}. שינוי או בירור ספציפי דורשים טיפול צוות; התקשרו ל־${OFFICE_PHONE}.` : `I found a booking with status ${booking.status}. A specific change or case review needs the team; please call ${OFFICE_PHONE}.`;
      else reply = he ? `כדי לבדוק מקרה מסוים נדרש מספר ההזמנה. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `To check a specific case, please send the booking reference or call ${OFFICE_PHONE}.`;
    } else if (state.interest && (!reading || reading.route === state.interest || reading.route === 'explore' || reading.route === 'policy' || reading.route === 'social')) {
      const answer = commercialReply(input, state);
      reply = answer.reply; escalate = answer.escalate;
      if (escalate) { state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); }
    } else if (/נהג צעיר|young driver/i.test(input) && /תוספת|מחיר|עלות|כמה|surcharge|extra|price|cost/i.test(input)) {
      reply = he ? 'ייתכן שתנאי המחיר והביטוח ישתנו לפי גיל הנהג וקבוצת הרכב. אין לי תוספת מאושרת לנקוב בה; הצוות יאשר אותה בהצעה האישית.' : 'Price and insurance terms may vary by driver age and vehicle group. I cannot quote an approved surcharge here; the team will confirm it in your offer.';
    } else if (/ביטוח|כיסוי|insurance|covered/i.test(input) && /אותי|בשבילי|בוודאות|personal|me|definitely/i.test(input)) {
      reply = he ? 'לא אוכל לאשר כיסוי ביטוחי אישי בשיחה. הזכאות תלויה בגיל, בוותק הרישיון, בנהגים הרשומים ובקבוצת הרכב; הצוות יאשר את תנאי הכיסוי בהצעה ובחוזה לפני ההזמנה.' : 'I cannot confirm personal insurance cover here. Eligibility depends on age, licence experience, named drivers and vehicle group; the team will confirm the terms in the offer and agreement before booking.';
    } else if (PRICE_OR_AVAILABILITY.test(input)) {
      reply = AVAILABILITY_ONLY.test(input) && !/מחיר|עלות|עול|יעל|price|cost|rate/i.test(input)
        ? availabilityAnswer(state.locale)
        : `${priceAnswer(state.locale)} ${state.booking.pickupDate ? (he ? 'מאיפה תרצו לאסוף?' : 'Where would you like to pick it up?') : (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?')}`;
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

  pushHistory(state, input, reply, privateTurn);
  await store.saveState(phone, state);
  return { reply, state, escalate, source, model };
}
