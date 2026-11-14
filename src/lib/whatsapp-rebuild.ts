import { OFFICE_PHONE } from '@/lib/constants';
import { isShabbat } from '@/lib/booking-notices';
import { randomUUID } from 'node:crypto';
import { termsConsent } from '@/lib/consent';
import { getSmartCarServiceAnswer, getSmartCarApprovedFacts } from '@/lib/smartcar-service-knowledge';
import { updateCommercialMemory, renderCommercialMemory, type CommercialMemory } from '@/lib/whatsapp-commercial-memory';
import { asksRentalAgeTerms, hasUndecidedRentalDates, validateConversationalReply } from '@/lib/whatsapp-ai-reply';
import { readBotTurn, type BotReading, type GeminiBotContext, type VehicleDirection } from '@/lib/whatsapp-rebuild-gemini';
import { isHypotheticalFactEvidence, isRentalCapacityQuestionEvidence, validateFactPatches } from '@/lib/whatsapp-fact-patch';

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
  commercial?: CommercialMemory;
  serviceReference?: string;
  /** Set only by a selected change request or acceptance of its review offer. */
  serviceChangeRequested?: boolean;
  safetyAlertAt?: string;
  safetyKind?: 'accident' | 'breakdown';
  handedOff?: boolean;
  handoffAt?: string;
  handoffKind?: 'safety' | 'booking_change' | 'service_issue' | 'commercial' | 'human';
  completedRequestId?: string;
  completedRental?: Pick<BookingDraft, 'pickupDate' | 'returnDate' | 'pickupLocation' | 'returnLocation' | 'vehicleNeed' | 'passengers' | 'luggage' | 'childSeats'>;
  durationClarification?: boolean;
  humanHandoffDeferred?: boolean;
};

export type RebuildResult = { reply: string; state: RebuildState; escalate?: boolean; source: 'gemini' | 'local' | 'safety'; model?: string; notes?: string[] };
export type RebuildStore = {
  isSimulation?: boolean;
  beforeEscalationSave?: (phone: string) => Promise<void>;
  loadState(phone: string): Promise<RebuildState | null>;
  saveState(phone: string, state: RebuildState): Promise<void>;
  activeBooking(phone: string): Promise<{ id: string; status: string; pickup_date: string; dropoff_date: string; pickup_location: string; dropoff_location: string } | null>;
  createRentalRequest(phone: string, state: RebuildState): Promise<string | null>;
  readTurn?: typeof readBotTurn;
  /** Rewording of fixed application replies. Defaults to the live reader; a store that injects its own
   * readTurn (tests, evaluation) gets rewording only if it also provides this. */
  rewordTurn?: typeof readBotTurn;
};

// WhatsApp itself is the required contact channel. Email is welcome when offered,
// but must never block a rental request.
const ORDER: BookingKey[] = ['pickupDate', 'returnDate', 'pickupLocation', 'returnLocation', 'vehicleNeed', 'driverAgeRange', 'customerName'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Final consent stays an explicit confirmation, with only a short casual lead
// ("אוקיי אני מאשר") or courtesy tail. Any other content keeps the summary open.
const FINAL_CONSENT = /^(?:(?:אוקיי?|אוקי|טוב|סבבה|יאללה|כן|ok(?:ay)?|yes)[,!.\s]+)?(?:אני מאשר(?:ת)?|מאשר(?:ת)?|i confirm|confirm(?:ed)?|(?:please )?send it|(?:go ahead and )?send (?:it|the request)|תשלח(?:ו)?(?: את זה| את הבקשה)?|שלח(?:ו)?(?: את הבקשה)?)(?:[,\s]+(?:בבקשה|תודה|please|thanks|thank you))?[.!\s]*\p{Extended_Pictographic}*$/iu;
const PRIVATE_PAYMENT_DETAIL = /מספר (?:כרטיס|אשראי)|קוד אבטחה|\b(?:full card|(?:credit )?card number|security code|CVV|CVC)\b/i;
const PRICE_OR_AVAILABILITY = /מחיר|(?<![לב])עלות|כמה.{0,12}(?:עול|יעל)|(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:prices?|cost|rate|available|availability)\b/iu;
const AVAILABILITY_ONLY = /(?<![\p{L}])(?:זמין|זמינות|פנוי|פנויה)|\b(?:available|availability|in stock)\b/iu;
const MONTHS: Record<string, number> = { ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12, january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const EXPLICIT_RANGE = new RegExp(`(\\d{1,2})\\s*(?:עד|[-–]|to|until)\\s*(\\d{1,2})\\s+(?:ב)?(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?`, 'iu');

function priceAnswer(locale: Locale): string {
  return locale === 'he'
    ? 'המחיר נסגר סופית מול נציג SmartCar, לפי התאריכים, סוג הרכב והתוספות שתבחרו.'
    : 'The final price is set with a SmartCar representative, based on your dates, vehicle type and chosen extras.';
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
    vehicleNeed: 'איזה סוג רכב תרצו, או כמה נוסעים וציוד יהיו?', driverAgeRange: 'בן כמה הנהג? מספיקה לנו קבוצת הגיל: 21–23 או 24 ומעלה.', customerName: 'על איזה שם לרשום את הבקשה?',
    customerEmail: 'מה כתובת המייל ליצירת קשר לגבי הבקשה?',
  };
  const en: Record<BookingKey, string> = {
    pickupDate: 'What date would you like to pick up the car?', returnDate: 'What date will you return it?',
    pickupLocation: 'Where would you like to pick it up?', returnLocation: 'Where will you return it?',
    vehicleNeed: 'What kind of car do you need, or how many passengers and bags?', driverAgeRange: 'How old is the driver? The driver age group is enough: 21–23 or 24 and over.', customerName: 'What name should I put on the request?',
    customerEmail: 'What email address can we use to contact you about the request?',
  };
  return (locale === 'he' ? he : en)[key];
}

function conversationalKnown(state: RebuildState): GeminiBotContext['known'] {
  // The sent request has its own immutable public snapshot. Clearing the
  // editable draft must not make a follow-up look like a first enquiry.
  const booking: BookingDraft = state.completedRental && state.phase === 'explore' && !state.interest
    ? { ...state.completedRental, ...state.booking } : state.booking;
  return {
    pickupDate: booking.pickupDate, returnDate: booking.returnDate,
    pickupLocation: booking.pickupLocation, returnLocation: booking.returnLocation,
    vehicleNeed: booking.vehicleNeed, passengers: booking.passengers,
    luggage: booking.luggage, childSeats: booking.childSeats, driverAgeRange: booking.driverAgeRange,
    customerNameProvided: booking.customerName ? 'provided' : undefined,
    datePreference: booking.datePreference,
    commercialInterest: state.interest,
    commercialBudget: state.commercial?.budget?.amount, commercialCurrency: state.commercial?.budget?.currency,
    commercialTermMonths: state.commercial?.termMonths === null ? 'undecided' : state.commercial?.termMonths,
    commercialAnnualMileageKm: state.commercial?.annualMileageKm === null ? 'undecided' : state.commercial?.annualMileageKm,
    commercialVehiclePreference: state.commercial?.vehiclePreference === null ? 'undecided' : state.commercial?.vehiclePreference,
    commercialUse: state.commercial?.usage?.join(', '),
    commercialPassengers: state.commercial?.passengers, commercialLuggage: state.commercial?.luggage,
  };
}

/** Demo diagnostics only: why the last model draft was not used (reason codes, never customer text). */
let draftNotes: string[] = [];
function groundedModelReply(reading: BotReading | null, input: string, state: RebuildState, onRejectOuter?: (reason: string) => void): string | null {
  const onReject = (reason: string) => { draftNotes.push(`${reason}: ${(reading?.reply ?? '').slice(0, 160)}`); onRejectOuter?.(reason); };
  if (!reading) draftNotes.push('no_reading'); else if (!reading.groundedContext) draftNotes.push('not_grounded');
  // The provider boundary attaches this flag only after approved facts were
  // actually supplied. It is context provenance, not a promise of correctness.
  if (!reading?.groundedContext) return null;
  // The model must not swap the relative the customer named (observed: "אמא
  // שלי" answered as "אשתך"). Only a relation the customer used may appear.
  const customerText = [input, ...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text)].join('\n');
  const relationMismatch = [
    [/אשתך|אשתכם|your wife/iu, /אשתי|אישתי|אשתו|my wife|wife/iu],
    [/בעלך|בעלכם|your husband/iu, /בעלי|בעלה|my husband|husband/iu],
  ].some(([inReply, stated]) => inReply.test(reading.reply) && !stated.test(customerText));
  // "אין בצי רכבים עם וו גרירה" stated as a fact when nothing approved says so. Equipment or models that the
  // approved facts do not cover are checked by a representative, not denied (commercial vehicles are approved).
  const absence = reading.reply.match(/(?:אין (?:לנו|אצלנו|בצי(?: הרכבים)?(?: שלנו)?)|לא קיימ(?:ים|ות)? (?:אצלנו|בצי)|we (?:do not|don['’]?t) (?:have|offer|carry)|not (?:available )?in our fleet)[^.!?\n]{0,80}/iu)?.[0];
  if (absence && !/מסחרי|טנדר|commercial|van|סניף|branch|מידע|information/iu.test(absence)) {
    onReject('unapproved_absence');
    return null;
  }
  // The model said the case is being passed on, but it did not judge that a person must act now, or the message
  // is a what-if question: nothing will be passed on, so the sentence would be untrue.
  const hypotheticalAsk = /מה (?:קורה|עושים|יקרה) אם|what (?:happens )?if|(?:^|\s)אם\s|\bif\b/iu.test(input);
  if ((hypotheticalAsk || !reading.needsRepresentative) && !state.handedOff
    && /עוב(?:ר|רת) (?:כרגע |עכשיו )?(?:לטיפול|לנציג)|(?:אני )?מעביר(?:ה)? (?:את זה |את הפנייה )?(?:עכשיו |מיד )?(?:לטיפול|לנציג)|העברתי (?:את זה |את הפנייה )?(?:לטיפול|לנציג)|\b(?:i am|i['’]m|we are|we['’]re) passing (?:this|it) on\b|\bpassed (?:this|it) (?:on )?to\b/iu.test(reading.reply)) {
    onReject('handoff_claim');
    return null;
  }
  if (relationMismatch) {
    onReject?.('relationship_mismatch');
    return null;
  }
  // Do not offer child seats to customers who never mentioned children or seats.
  if (/כיסא(?:ות)? בטיחות|child seats?|car seats?|booster/iu.test(reading.reply) && /[?؟]/u.test(reading.reply)
    && !/ילד|ילדה|ילדים|תינוק|פעוט|בן \d|בת \d|כיסא|kid|child|baby|toddler|infant|seat|booster/iu.test(customerText) && state.booking.childSeats === undefined) {
    onReject?.('irrelevant_offer');
    return null;
  }
  // A city the customer never mentioned ("ממודיעין הסניף בירושלים") is invented context.
  const CITY_NAMES = /(?<![\p{L}])[בלמה]?(מודיעין|חיפה|באר שבע|נתניה|אשדוד|אשקלון|רחובות|ראשון לציון|חולון|בת ים|רמת גן|פתח תקווה|כפר סבא|רעננה|הוד השרון|נהריה|עכו|טבריה|צפת|אילת|קריית שמונה|Modiin|Haifa|Beer Sheva|Netanya|Ashdod|Eilat|Ramat Gan|Rishon)(?![\p{L}])/giu;
  const customerSaid = [input, ...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text), JSON.stringify(state.booking)].join(' ');
  for (const city of reading.reply.matchAll(CITY_NAMES)) {
    if (!customerSaid.toLowerCase().includes(city[1].toLowerCase())) { onReject?.('unknown_place'); return null; }
  }
  const validated = validateConversationalReply({
    // Today's date is always a supported number (a draft may say "היום, 13 בנובמבר").
    reply: reading.reply, input, locale: state.locale, known: { ...conversationalKnown(state), today: israelDate(), rentalDraft: state.phase !== 'service' && !state.interest && !state.handedOff && !state.completedRequestId ? 'open' : undefined, hasServiceReference: state.serviceReference ? 'yes' : undefined },
    approvedFacts: getSmartCarApprovedFacts(state.locale).map(fact => fact.text),
    handoffDeferred: Boolean(state.humanHandoffDeferred), bookingPhase: state.phase === 'booking',
    nextMissingField: state.phase === 'booking' ? nextMissing(state.booking) ?? undefined : undefined,
    onReject: reason => {
      onReject(reason);
      if (process.env.NODE_ENV === 'production') console.warn('WhatsApp AI draft fallback', { reason });
    },
  });
  return validated && state.locale === 'he' ? neutralHebrewAddress(validated).replace(/(?<![\p{L}])ממ(?=ירושלים)/gu, 'מ').replace(/(?<![\p{L}])בה בהחלט/gu, 'בהחלט').replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/gu, '').replace(/(?<![\p{L}])בתואם מראש/gu, 'בתיאום מראש') : validated;
}

/** "אני משה כהן" / "שמי דנה לוי" / "קוראים לי רון" as its own clause. Verbs, ages,
 * roles and filler after "אני" are not a name ("אני בן 38", "אני רוצה", "אני הנהג"). */
const HEBREW_NOT_NAME = /^(?:רוצה|רוצים|צריך|צריכה|צריכים|מעוניין|מעוניינת|בן|בת|הנהג|הנהגת|נהג|נהגת|גם|רק|לא|עם|בלי|מגיע|מגיעה|נוסע|נוסעת|טס|טסה|חושב|חושבת|מתלבט|מתלבטת|בסדר|מאשר|מאשרת|שוב|כבר|עדיין|פה|כאן|מחכה|שואל|שואלת|יודע|יודעת|זוכר|זוכרת|מבין|מבינה|לבד|תושב|תושבת|תייר|תיירת|סטודנט|סטודנטית|חייל|חיילת|אבא|אמא|ההורה|בעלים|הבעלים|הלקוח|הלקוחה|מירושלים|מתל|מהרצליה|מהרכב|בטוח|בטוחה|מאוד|ממש|קצת|אחד|אחת|שלכם|שלך|איתכם|הולך|הולכת|יכול|יכולה|אוהב|אוהבת|מחפש|מחפשת|שוכר|שוכרת|נשוי|נשואה|גר|גרה)$/u;
function hebrewIntroducedName(input: string): string | undefined {
  const match = input.match(/(?:^|[.!,;]\s*|\s)(?:אני|שמי|קוראים לי|השם שלי)\s+([\p{L}'׳-]{2,20}(?:\s+[\p{L}'׳-]{2,20})?)(?=\s*(?:,|$|\s+(?:בן|בת)\s*\d{2}\b|[.!]))/u)?.[1];
  if (!match || /[a-z]/i.test(match)) return undefined;
  const words = match.split(/\s+/u);
  if (words.some(word => HEBREW_NOT_NAME.test(word))) return undefined;
  return match;
}

/** After a mileage question, a bare "בערך 15 אלף בשנה" / "around 15k" is the annual mileage. */
function applyPromptedMileage(input: string, state: RebuildState): void {
  if (!state.commercial || state.commercial.annualMileageKm != null) return;
  const lastBot = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
  if (!/קילומטר|קילומטראז|mileage|kilomet|\bkm\b/iu.test(lastBot)) return;
  if (/(?:^|\s)אם\s|מה אם|\bif\b|what if/iu.test(input)) return;
  const m = input.trim().match(/^(?:בערך|בסביבות|משהו כמו|כ[־-]?|around|about|roughly|maybe|probably)?\s*(\d{1,3})(?:\s*(?:אלף|אלפים)|\s*k\b|,000|000)\s*(?:ק["״]?מ|קמ|km)?\s*(?:בשנה|לשנה|a year|per year|annually)?[.!\s]*$/iu);
  if (!m) return;
  const km = Number(m[1]) * 1000;
  if (km >= 1000 && km <= 100000) state.commercial.annualMileageKm = km;
}

function lastBotForFeeShabbat(state: RebuildState): string {
  return [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
}

/** Return place for "same place": a home delivery becomes a collection from the same home. */
function sameReturnLabel(state: RebuildState): string | undefined {
  const city = state.booking.pickupLocation?.match(/^(?:מסירה עד הבית|Home delivery) \((.+)\)$/u)?.[1];
  return city ? (state.locale === 'he' ? `איסוף מהבית (${city})` : `Collection from home (${city})`) : state.booking.pickupLocation;
}

/** The customer's gender is unknown: feminine-singular second person in model
 * wording becomes the plural form used elsewhere (תרצו, תוכלו, לכם). */
const FEMININE_TO_PLURAL: Array<[string, string]> = [
  ['תרצי', 'תרצו'], ['תוכלי', 'תוכלו'], ['תצטרכי', 'תצטרכו'], ['תגידי', 'תגידו'], ['תשלחי', 'תשלחו'], ['תכתבי', 'תכתבו'],
  ['תבחרי', 'תבחרו'], ['תעדכני', 'תעדכנו'], ['תאשרי', 'תאשרו'], ['תספרי', 'תספרו'], ['תביאי', 'תביאו'], ['תחזירי', 'תחזירו'],
  ['תאספי', 'תאספו'], ['תסעי', 'תסעו'], ['תתקשרי', 'תתקשרו'], ['תשמחי', 'תשמחו'], ['מעוניינת', 'מעוניינים'], ['צריכה', 'צריכים'],
  ['שלך', 'שלכם'], ['לך', 'לכם'], ['אלייך', 'אליכם'], ['איתך', 'איתכם'], ['עבורך', 'עבורכם'], ['אותך', 'אתכם'],
];
function neutralHebrewAddress(reply: string): string {
  if (!/(?:תרצי|תוכלי|תצטרכי|תגידי|תשלחי|תכתבי|תבחרי|תעדכני|תאשרי|תספרי|תביאי|תחזירי|תאספי|תסעי|תתקשרי|תשמחי|מעוניינת|אלייך)(?![\p{L}])/u.test(reply)) return reply;
  return FEMININE_TO_PLURAL.reduce((text, [from, to]) => text.replace(new RegExp(`(?<![\\p{L}])(?:([והשב]))?${from}(?![\\p{L}])`, 'gu'), (_m, prefix = '') => `${prefix}${to}`), reply);
}

function israelDate(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); }
function validDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** An exact trip length ("לשבוע בדיוק", "for a week", "ל-5 ימים"). Approximate or
 * hypothetical lengths are not a return date. */
function statedDurationDays(input: string): number | null {
  if (/אולי|בערך|בסביבות|מתלבט|(?:^|\s)אם\s|מה אם|\b(?:maybe|about|around|roughly|if|might)\b/iu.test(input)) return null;
  const he = input.match(/(?:למשך\s+|ל[-־]?)(שבועיים|שבוע|יום אחד|יומיים|שלושה ימים|ארבעה ימים|חמישה ימים|שישה ימים|עשרה ימים|\d{1,2}\s*ימים)(?![\p{L}])/u)?.[1];
  const en = input.match(/\bfor\s+(?:a|one|two|three|four|five|six|seven|ten|\d{1,2})\s+(?:days?|weeks?)\b/iu)?.[0];
  const words: Record<string, number> = { 'שבוע': 7, 'שבועיים': 14, 'יום אחד': 1, 'יומיים': 2, 'שלושה ימים': 3, 'ארבעה ימים': 4, 'חמישה ימים': 5, 'שישה ימים': 6, 'עשרה ימים': 10 };
  if (he) return words[he] ?? Number(he.match(/\d+/)?.[0]) ?? null;
  // "רכב לחודש לעבודה" / "for a month": a rental month is 30 days. Not "לחודש הבא" (next month) or a price per month.
  if (!/כמה|מחיר|עולה|עלות|תשלום|ליסינג|how much|price|cost|per month|a month\?|leasing/iu.test(input)) {
    if (/(?:למשך\s+|ל[-־]?)חודשיים(?![\p{L}])|\bfor\s+(?:two|2)\s+months\b/iu.test(input)) return 60;
    if (/(?:למשך\s+|ל[-־]?)חודש(?![\p{L}])(?!\s*(?:הבא|הקרוב|הזה|דצמבר|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר))|\bfor\s+(?:a|one|1)\s+month\b/iu.test(input)) return 30;
  }
  if (en) {
    const n = en.match(/\d+/)?.[0] ? Number(en.match(/\d+/)![0]) : ({ a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 } as Record<string, number>)[en.split(/\s+/)[1].toLowerCase()];
    return n ? (/week/i.test(en) ? n * 7 : n) : null;
  }
  return null;
}

function relativeRentalDuration(input: string): { pickupDate: string; returnDate: string } | null {
  for (const clause of input.split(/[.!?;\n]|\b(?:but|actually)\b|אבל|בעצם/iu)) {
    if (/אולי|מתלבט|עוד לא|עדיין לא|(?:^|\s)אם(?:\s|$)|לא (?:אקח|ניקח|נלך|רוצה)|\b(?:maybe|might|if|considering)\b|not sure|(?:do not|don['’]?t) (?:take|want|rent)/iu.test(clause)) continue;
    const startMatch = clause.match(/(?:^|[\s,])(?:מ|from\s+)?(מחרתיים|מחר|היום|day after tomorrow|tomorrow|today)(?=[\s,.!?]|$)/iu);
    const start = startMatch?.[1];
    if (!start) continue;
    const days = clause.match(/(?:למשך\s+|ל)(יום אחד|יומיים|שלושה ימים|ארבעה ימים|חמישה ימים|\d{1,2}\s*ימים)|\bfor\s+(one|two|three|four|five|\d{1,2})\s+days?\b/iu);
    if (!days) continue;
    const chosen = /נלך על|אלך על|לשכור|להשכיר|(?:אקח|ניקח|רוצה|צריך|צריכה|צריכים).{0,15}(?:רכב|קטן|משפחת)|\b(?:rent|hire)\b|\brental car\b|take (?:a |the )?(?:(?:compact|small|family) )?car|go with/iu.test(clause);
    const briefDateAnswer = clause.replace(startMatch![0], '').replace(days[0], '').replace(/[\s,־-]/gu, '') === '';
    if (!chosen && !briefDateAnswer) continue;
    const counts: Record<string, number> = { 'יום אחד': 1, 'יומיים': 2, 'שלושה ימים': 3, 'ארבעה ימים': 4, 'חמישה ימים': 5, one: 1, two: 2, three: 3, four: 4, five: 5 };
    const token = (days[1] ?? days[2]).toLowerCase();
    const count = counts[token] ?? Number(token.match(/\d+/)?.[0]);
    const pickupDate = singleDateAnswer(start);
    if (!pickupDate || !Number.isInteger(count) || count < 1 || count > 60) continue;
    const returned = new Date(`${pickupDate}T00:00:00Z`);
    returned.setUTCDate(returned.getUTCDate() + count);
    return { pickupDate, returnDate: returned.toISOString().slice(0, 10) };
  }
  return null;
}

function explicitDateRange(input: string): { pickupDate: string; returnDate: string } | null {
  // "monday to friday" / "משני עד שישי": the coming such days.
  {
    const en = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const he = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const enRange = input.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\.?\s*(?:to|until|till|through|thru|-|–)\s*(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\b/iu);
    const heRange = input.match(/(?<![\p{L}])מ(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s*(?:עד|ועד|-|–)\s*(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|מוצ["״']?ש)(?![\p{L}])/u);
    const index = (value: string) => he.includes(value) ? he.indexOf(value) : /^מוצ/u.test(value) ? 6 : en.findIndex(day => day.startsWith(value.toLowerCase().slice(0, 3)));
    const pair = enRange ? [enRange[1], enRange[2]] : heRange ? [heRange[1], heRange[2]] : null;
    if (pair && !/\d{1,2}[./]\d|(?:^|\s)אם\s|מה אם|אולי|\bwhat if\b|\bif\b|\bmaybe\b/iu.test(input)) {
      const first = index(pair[0]); const last = index(pair[1]);
      if (first >= 0 && last >= 0) {
        const start = new Date(`${israelDate()}T12:00:00Z`);
        start.setUTCDate(start.getUTCDate() + ((first - start.getUTCDay() + 7) % 7 || 7));
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + ((last - first + 7) % 7 || 7));
        return { pickupDate: start.toISOString().slice(0, 10), returnDate: end.toISOString().slice(0, 10) };
      }
    }
  }
  // "נוחתים ב-2 בדצמבר, לשבועיים" / "on dec 5 for 4 days": one date and a length make the range.
  {
    const heMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const enMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const heDate = input.match(/(?<![\d./])(\d{1,2})\s*(?:ב|ל)?(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/u);
    const enDate = input.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b|\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/iu);
    const day = heDate ? Number(heDate[1]) : enDate ? Number(enDate[2] ?? enDate[3]) : 0;
    const month = heDate ? heMonths.indexOf(heDate[2]) + 1 : enDate ? enMonths.indexOf((enDate[1] ?? enDate[4]).toLowerCase().slice(0, 3)) + 1 : 0;
    const length = statedDurationDays(input);
    if (day >= 1 && day <= 31 && month >= 1 && length && length <= 60 && !/(?:עד|until|till|to)\s+(?:ה[-־]?)?\d|\d\s*[-–]\s*\d/iu.test(input) && !/(?:^|\s)אם\s|מה אם|אולי|\bwhat if\b|\bif\b|\bmaybe\b/iu.test(input)) {
      const today = israelDate(); let year = Number(today.slice(0, 4));
      const iso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso(year) < today) year += 1;
      const start = iso(year);
      if (validDate(start)) { const end = new Date(`${start}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + length); return { pickupDate: start, returnDate: end.toISOString().slice(0, 10) }; }
    }
  }
  // "מה 17 לחודש הבא עד ה 20" / "17 עד 20 לחודש הבא": both days in next month.
  const nextMonth = input.match(/(?:מה?|מ-|מ־)?\s*(\d{1,2})\s+(?:ל|ב)חודש הבא\s+(?:עד|ועד|-)\s*(?:ה|ה-|ה־)?\s*(\d{1,2})(?!\d)/u)
    ?? input.match(/(?:מה?|מ-|מ־)?\s*(\d{1,2})\s+(?:עד|ועד|-)\s*(?:ה|ה-|ה־)?\s*(\d{1,2})\s+(?:ל|ב)חודש הבא/u);
  if (nextMonth && !/(?:^|\s)אם\s|מה אם|אולי/u.test(input)) {
    const today = israelDate(); const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7));
    const nm = m === 12 ? 1 : m + 1; const ny = m === 12 ? y + 1 : y;
    const nested = explicitDateRange(`${nextMonth[1]}/${nm}/${ny}-${nextMonth[2]}/${nm}/${ny}`);
    if (nested) return nested;
  }
  // "מחמישי 19.11 עד ראשון 22.11" / "thu 19.11 - sun 22.11": a weekday before an explicit date is decoration.
  const withoutWeekdays = input
    .replace(/(?<![\p{L}])([מל]?)(?:יום\s+)?(?:ה)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s+(?=(?:ה|ה-|ה־)?\d{1,2}[./])/gu, '$1')
    .replace(/(?<![\p{L}])מיום\s+(?=\d{1,2}[./])/gu, 'מ')
    .replace(/\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?\.?,?\s+(?=\d{1,2}[./])/giu, '');
  if (withoutWeekdays !== input) return explicitDateRange(withoutWeekdays);
  const mon: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const abbrev = input.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:morning|afternoon|evening|night|noon|am|pm))?\s*(?:to|until|till|-|–)\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+)?(?:(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (abbrev && !/\bwhat if\b|\bif\b|\bmaybe\b/i.test(input)) {
    const today = israelDate(); const year = Number(today.slice(0, 4));
    const m1 = mon[abbrev[1].toLowerCase()]; const m2 = abbrev[3] ? mon[abbrev[3].toLowerCase()] : m1;
    const y1 = `${year}-${String(m1).padStart(2, '0')}-${abbrev[2].padStart(2, '0')}` < today ? year + 1 : year;
    const y2 = m2 < m1 ? y1 + 1 : y1;
    const nested = explicitDateRange(`${abbrev[2]}/${m1}/${y1}-${abbrev[4]}/${m2}/${y2}`);
    if (nested) return nested;
  }
  // "תאריכים 23 עד 26 לחודש" / "the 23rd to the 26th of this month": day-only range in
  // the current month, or next month when that day has already passed.
  const dayRange = input.match(/(?:(?:תאריכים|dates?|בין|from)\s*:?\s*)?(?:ה[-־]?|the )?(\d{1,2})(?:st|nd|rd|th)?\s*(?:עד|ל[-־]?|[-–]|to|until|till)\s*(?:ה[-־]?|the )?(\d{1,2})(?:st|nd|rd|th)?\s*(?:לחודש|בחודש|החודש|של החודש|(?:of )?this month|of the month)(?![\p{L}])/iu)
    ?? input.match(/(?:תאריכים|dates?)\s*:?\s*(?:ה[-־]?|the )?(\d{1,2})(?:st|nd|rd|th)?\s*(?:עד|[-–]|to|until|till)\s*(?:ה[-־]?|the )?(\d{1,2})(?:st|nd|rd|th)?(?![\d./])/iu);
  if (dayRange && !/מה אם|(?:^|\s)אם\s|אולי|\bwhat if\b|\bif\b|\bmaybe\b/iu.test(input)) {
    const [first, last] = [Number(dayRange[1]), Number(dayRange[2])];
    const today = israelDate();
    let year = Number(today.slice(0, 4)); let month = Number(today.slice(5, 7));
    if (first < Number(today.slice(8, 10))) { month += 1; if (month > 12) { month = 1; year += 1; } }
    let returnMonth = month; let returnYear = year;
    if (last < first) { returnMonth += 1; if (returnMonth > 12) { returnMonth = 1; returnYear += 1; } }
    if (first >= 1 && first <= 31 && last >= 1 && last <= 31) {
      const nested = explicitDateRange(`${first}/${month}/${year}-${last}/${returnMonth}/${returnYear}`);
      if (nested) return nested;
    }
  }
  const relativeRange = input.match(new RegExp(`(?:^|\\s)(?:מ|from\\s+)?(מחרתיים|מחר|היום|day after tomorrow|tomorrow|today)\\s*(?:עד|until|through|to|[-–])\\s*(20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}[./]\\d{1,2}(?:[./]20\\d{2})?|\\d{1,2}\\s+(?:ב)?(?:${Object.keys(MONTHS).join('|')})(?:\\s+20\\d{2})?)(?=[\\s,.!?]|$)`, 'iu'));
  if (relativeRange) {
    const pickupDate = singleDateAnswer(relativeRange[1]);
    const returnDate = pickupDate ? singleDateAnswer(relativeRange[2], pickupDate) : null;
    if (pickupDate && returnDate) return { pickupDate, returnDate };
  }
  const hebrewRouteDates = input.match(new RegExp(`(?:איסוף|לאסוף).{0,70}?ב[-־]?\\s*(\\d{1,2})\\s+ב?(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?.{0,80}?(?:החזרה|להחזיר|נחזיר|אחזיר).{0,70}?ב[-־]?\\s*(\\d{1,2})\\s+ב?(${Object.keys(MONTHS).join('|')})(?:\\s+(20\\d{2}))?`, 'iu'));
  if (hebrewRouteDates) {
    const year = hebrewRouteDates[3] ?? hebrewRouteDates[6] ?? israelDate().slice(0, 4);
    return explicitDateRange(`${hebrewRouteDates[1]}/${MONTHS[hebrewRouteDates[2].toLowerCase()]}/${year}-${hebrewRouteDates[4]}/${MONTHS[hebrewRouteDates[5].toLowerCase()]}/${hebrewRouteDates[6] ?? year}`);
  }
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
  const numeric = input.match(/(?:^|\s)(?:מ-?|מה[-־]?\s*|from\s+(?:the\s+)?)?(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\s*(?:[-–־]|עד|to|until|till)\s*(?:ה[-־]?\s*|the\s+)?(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?(?=\s|$|[,.!?])/iu);
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
  if (!match) return relativeRentalDuration(input);
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

const VAGUE_DATE_PHRASE = /\b(?:next week|next month|in a week|in a month|about a week|about a month)\b|(?:מ|ב)?עוד\s+(?:כשבוע|כחודש|שבוע|חודש)|מ?עוד\s*שבוע|(?:ב|מ)שבוע הבא|(?:ב|מ)חודש הבא/iu;
function vagueDateAnswer(input: string): boolean {
  return VAGUE_DATE_PHRASE.test(input)
    && !explicitDateRange(input) && !singleDateAnswer(input);
}

function uncertainDateAnswer(input: string): boolean {
  if (/\b(?:do not|don't|still do not|still don't) know (?:the )?dates|stop asking for dates/i.test(input)) return true;
  return /(?:לא יודע|לא יודעת|לא בטוח|לא בטוחה|לא סגור(?:ים|ות)? על (?:ה)?תאריכ|לא סגרנו תאריכ|אין לי (?:עדיין )?תאריכ|אין תאריך סופי|עדיין אין תאריך|not sure|don'?t know|no dates? yet|haven'?t decided|(?:have|has) not (?:chosen|picked|decided on) dates? yet)/i.test(input);
}

function mentionsRentalChange(input: string): boolean {
  return /לשנות|לשינוי|להאריך|הארכ(?:ה|ת)|לדחות|לדחייה|להקדים|להזיז|לקצר|יום ההחזרה|יום מאוחר|יום נוסף|להחזיר.{0,40}מאוחר|להחזיר.{0,30}(?:בעוד|ב)\S*.{0,20}במקום|\breturn (?:it|the car).{0,25}instead of\b|\b(?:change|extend|extension|shorten|shortening|postpone)\b|move (?:the )?return|return date|return (?:the )?(?:car|it).{0,45}later|extra days?/i.test(input);
}

/** A topic mention is not authority to queue a change, now or in history. */
function rentalChangeRequest(input: string): boolean {
  if (advisoryRentalChange(input)) return false;
  // Adding a driver to an existing booking (with its reference) is a change request.
  if (/\badd (?:an? )?(?:another|second|additional|extra)? ?driver\b.{0,30}\b(?:booking|reservation|rental)\b|להוסיף\s+(?:את\s+)?(?:\S+\s+)?(?:כ)?נהג(?:ת)?(?:\s+נוסף|\s+נוספת)?.{0,20}(?:להזמנה|לחוזה|להשכרה)/iu.test(input) && explicitServiceReference(input)) return true;
  // "במקום ראשון שיהיה שלישי" / "make it Tuesday instead of Sunday": a concrete new date is a request.
  if (/במקום\s+(?:יום\s+)?[\p{L}\d./]{2,12}\s+(?:ש)?(?:יהיה|תהיה|נעשה|נזיז ל|ל)\s*(?:יום\s+)?[\p{L}\d./]{2,12}|\b(?:make it|move it to|change it to)\s+[\p{L}\d./ ]{2,20}\s+instead of\b/iu.test(input) && !/(?:^|\s)אם\s|\bif\b|what if|מה אם/iu.test(input)) return true;
  if (/^(?:רוצה|רוצים|צריך|צריכה|מבקש|מבקשת)\s+(?:לשנות|להאריך|לדחות|להקדים|להזיז|לקצר)/u.test(input)) return true;
  return /(?:אני|אנחנו)\s+(?:כבר\s+)?(?:רוצה|רוצים|צריך|צריכה|צריכים|מבקש|מבקשת|מבקשים)\s+(?:לשנות|להאריך|לדחות|להקדים|להזיז|לקצר)|(?:החלטתי|החלטנו)\s+(?:להאריך|לשנות|לדחות|לקצר)|(?:בבקשה\s+)?(?:תאריכו|האריכו|תדחו|תשנו|תזיזו|תקצרו|קצרו)(?:\s|[.!?]|$)|(?:^|[.!?]\s*|,\s*)(?:בבקשה\s+)?(?:תעבירו|שלחו)\s+(?:לי\s+)?בקשת\s+(?:הארכה|שינוי|קיצור)|(?:אני|אנחנו)\s+(?:כבר\s+)?(?:רוצה|רוצים|מבקש|מבקשת)\s+(?:להעביר|לשלוח)\s+בקשת\s+(?:הארכה|שינוי|קיצור)/iu.test(input)
    // Asking SmartCar to request/add the extra day is a selected change request.
    || /\b(?:please\s+)?(?:go ahead and\s+)?(?:ask|apply|request)\s+for\s+(?:the\s+|an\s+|one\s+|that\s+)?(?:extra|additional|another|one more)\s+(?:day|days|night|nights)\b|\bgo ahead (?:and|with)\b.{0,40}\b(?:extension|extra day|additional day|extend|shorten)\b|\b(?:please\s+)?(?:add|book)\s+(?:the\s+|an\s+|one\s+|that\s+)?(?:extra|additional|another|one more)\s+day\b/iu.test(input)
    || /(?:^|[\s,.!])(?:בבקשה\s+)?(?:קדימה,?\s+)?(?:תבקשו|תגישו|תוסיפו|תזמינו)\s+(?:לי\s+|לנו\s+)?(?:עוד\s+(?:יום|יומיים|לילה)|יום\s+נוסף|הארכה|בקשת\s+הארכה)/u.test(input)
    || /\b(?:I|we) (?:want|need|would like|have decided) to (?:extend|shorten|change|postpone|move|return.{0,45}later)\b|\b(?:I|we)(?: would|'d) like to request\b.{0,25}\b(?:extension|shortening|date change)\b|\b(?:please|kindly)\s+(?:extend|shorten|change|postpone|move)\b|(?:^|[.!?]\s*|,\s*)(?:please\s+)?(?:request|submit|pass|send)\b.{0,35}\b(?:extension|shortening|date change|change request)\b/iu.test(input);
}

function advisoryRentalChange(input: string): boolean {
  if (/(?:do not|don['’]?t|not)\s+(?:want|wish|intend|ask)\s+(?:you\s+)?(?:to\s+)?(?:extend|shorten|change|request)|לא (?:רוצה|רוצים|צריך|צריכה|מבקש|מבקשת)\s+(?:להאריך|לשנות|לדחות|לקצר)|אל\s+(?:תאריכו|האריכו|תדחו|תשנו|תזיזו|תקצרו|קצרו)/iu.test(input)) return true;
  if (/\b(?:haven['’]?t|have not|has not) (?:chosen|decided)|\b(?:still deciding|undecided)\b|(?:עוד |עדיין )?לא (?:החלטתי|החלטנו|בחרתי|בחרנו)/iu.test(input)) return true;
  return /\b(?:what if|if (?:I|we) (?:(?:ever|actually) )?(?:need|needed|wanted|decide)|may need|might need|not requesting|only asking|just asking|no (?:change|extension) request(?: yet)?)\b|(?:leave|keep).{0,35}\bunchanged\b|(?:do not|don't)\s+(?:change|extend)|מה (?:קורה |יקרה )?אם|אם (?:אצטרך|נצטרך|ארצה)|אולי (?:אצטרך|נצטרך)|רק (?:שואל|שואלת|מברר|מבררת)|לא מבקש(?:ת)? (?:שינוי|הארכה)|להשאיר.{0,25}ללא שינוי|אל תשנ|לא לשנות/i.test(input);
}

function cancellationRequest(input: string): boolean {
  if (/לא (?:רוצה|רוצים|מבקש|מבקשת|צריך|צריכה)\s+לבטל|עוד לא לבטל|אל תבטל|(?:do not|don't|not) want to cancel|(?:do not|don't) cancel|no cancellation request|(?:^|\s)אם.{0,25}(?:החלטתי|החלטנו)|\bif\b.{0,25}\b(?:decide|decided)\b/i.test(input)) return false;
  if (/(?:החלטתי|החלטנו)\s+לבטל(?:\s|[.!?]|$)|(?:I|we) (?:have )?decided to cancel|please cancel (?:my |the )?(?:booking|rental)/i.test(input)) return true;
  // Everyday decisions: "טוב בואו נבטל", "תבטלו לי", "let's cancel it".
  if (!/[?؟]\s*$/u.test(input.split(/[.!]/u).find(part => /נבטל|תבטל|cancel/iu.test(part)) ?? '')
    && /(?:^|[\s,.!])(?:בוא(?:ו)?|יאללה|טוב|אז)\s+נבטל(?![\p{L}])|(?:^|[\s,.!])(?:בבקשה\s+)?(?:תבטלו|בטלו)(?:\s+(?:לי|לנו|את\s+ה(?:הזמנה|השכרה)|אותה|אותו))?(?![\p{L}])|\blet['’]?s cancel\b|\b(?:please |just )?cancel (?:it|that|my reservation|the reservation|our booking)\b|\bgo ahead and cancel\b/iu.test(input)) return true;
  return /(?:רוצה|רוצים|מבקש|מבקשת|צריך|צריכה|אפשר).{0,18}(?:לבטל|ביטול).{0,25}(?:הזמנה|השכרה)|(?:הזמנה|השכרה).{0,100}לבטל\s+(?:אותה|אותו|את הקיימת)|(?:want|need|have|would like) to cancel (?:my |the |our )?(?:car |rental )?(?:booking|rental|reservation)|(?:booking|rental).{0,100}(?:want|need|would like) to cancel (?:it|that)/i.test(input);
}

function explicitServiceReference(input: string): string | undefined {
  // "תבטלו לי את ההזמנה בבקשה, 334455": a lone booking-length number in a cancellation/change message.
  if (/לבטל|תבטל|ביטול|cancel|להזיז|לשנות|להאריך|change|extend|move/iu.test(input)) {
    const lone = input.match(/(?:^|[\s,.:])(\d{5,8})(?=[\s,.!?]|$)/u);
    if (lone && !/(?:\d{5,8})\s*(?:₪|ש["״]?ח|nis|ils|km|ק["״]?מ)|0\d{8,9}/iu.test(input)) return lone[1];
  }
  const bare = input.match(/(?:^|[\s,.])(?:[לבה])?הזמנה\s+(?:שלי\s+)?(?:מספר\s+)?(\d{5,12})(?!\d)|\b(?:booking|reservation|ref\.?|ref(?:erence)? (?:no\.?|number|#))(?:\s+(?:is|number|no\.?|#))?\s*#?\s*(\d{5,12})(?!\d)/iu);
  if (bare && !/(?:\d{5,12})\s*(?:₪|ש["״]?ח|nis|ils|km|ק["״]?מ)/iu.test(input)) return bare[1] ?? bare[2];
  const value = input.match(/(?:מספר\s+ה?הזמנה|booking\s+number|(?:booking\s+)?reference|(?:booking|הזמנה)\s*#|ההזמנה\s+שלי\s+מספר\s*#)[\s,:#]*(?:(?:שלי|הוא|it\s+is|it['’]s|is)[\s,:#]*)*([A-Z0-9-]*\d[A-Z0-9-]{2,})(?![A-Z0-9-])/i)?.[1];
  return value && value.length <= 40 ? value : undefined;
}

function hasOtherReferenceQuestion(input: string): boolean {
  return input.split(/[?؟;]|\b(?:and|also)\b|ו(?=מה|האם|איזה|איך|מתי)/i).some(clause =>
    !/(?:מספר\s+ה?הזמנה|booking\s+(?:number|reference))/i.test(clause)
      && /מה|איך|איזה|האם|מתי|\b(?:what|which|how|where|when|can|could|should|have you|has it|is it)\b/i.test(clause));
}

function redactServiceReference(text: string, reference?: string): string {
  const labelled = text.replace(/((?:מספר\s+ה?הזמנה|booking\s+(?:number|reference)|(?:booking|הזמנה)\s*#|ההזמנה\s+שלי\s+מספר\s*#)[\s,:#]*(?:(?:שלי|הוא|it\s+is|is)[\s,:#]*)*)[A-Z0-9-]*\d[A-Z0-9-]{2,}/gi, '$1[booking reference removed]');
  return reference ? labelled.split(reference).join('[booking reference removed]') : labelled;
}

function explicitSameReturn(input: string): boolean {
  return input.split(/[.!?;,]|אבל|\bbut\b/iu).some(clause =>
    /(?:להחזיר|נחזיר|אחזיר|החזרה)\s+שם(?:\s|$)/u.test(clause)
      && !/(?:לא|אל|בלי).{0,12}(?:להחזיר|נחזיר|אחזיר|החזרה)/u.test(clause));
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

function temporalLocation(value: string): boolean {
  return /^(?:ב[-־]?\s*)?(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|היום|מחר(?:תיים)?|מוצ["״']?ש|מוצאי שבת|הבוקר|הערב|בערב|בבוקר|בצהריים|הלילה)(?:\s|$)|^(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)(?:\s|$)|^\d{1,4}[-/.]\d/i.test(value.trim());
}

/** Everyday branch abbreviations: ת"א / ת״א / תא → תל אביב, י-ם → ירושלים, נתבג → נתב״ג, TLV → Tel Aviv (airport if "TLV airport"). */
function expandBranchAbbreviations(input: string): string {
  return input
    .replace(/(?<![\p{L}])([מבל]?)ת["״'׳]?א(?![\p{L}])/gu, '$1תל אביב')
    .replace(/(?<![\p{L}])([מבל]?)י[-־]?ם(?![\p{L}])/gu, '$1ירושלים')
    .replace(/\bTLV\b(?!\s+airport)/gi, 'Tel Aviv');
}

function applyExplicitLocations(input: string, draft: BookingDraft): void {
  input = expandBranchAbbreviations(input);
  let bothLabel: string | undefined;
  // "Airport both ways" / "לאסוף ולהחזיר בנתב״ג": one known branch for both legs.
  if (!/\bwhat if\b|\bif\b|\bmaybe\b|מה אם|(?:^|\s)אם\s|אולי/iu.test(input)) {
    const branch = '(the airport|airport|ben gurion(?: airport)?|tlv(?: airport)?|natbag|herzliya|tel aviv|jerusalem|נתב["״׳\']?ג|שדה התעופה|הרצליה|תל אביב|ירושלים)';
    const both = input.match(new RegExp(`(?:^|[\\s,.])(?:at |from |in |[במ])?${branch}\\s+(?:both ways|for both pick.?up and return|הלוך ושוב|לשני הכיוונים)`, 'iu'))?.[1]
      ?? input.match(new RegExp(`(?:pick(?:ing)?.?up and (?:return|drop.?off)|both ways)\\s+(?:at|from|in)\\s+${branch}(?![\\p{L}])`, 'iu'))?.[1]
      ?? input.match(new RegExp(`(?:לאסוף ולהחזיר|איסוף והחזרה|גם לאסוף וגם להחזיר)\\s+[במ]${branch}(?![\\p{L}])`, 'iu'))?.[1];
    if (both) {
      const he = /[א-ת]/u.test(input);
      const key = /air|ben gurion|tlv|natbag|נתב|שדה/iu.test(both) ? 'airport' : /herz|הרצ/iu.test(both) ? 'herzliya' : /tel aviv|תל אביב/iu.test(both) ? 'telaviv' : 'jerusalem';
      const label = he ? { airport: 'נתב״ג', herzliya: 'הרצליה', telaviv: 'תל אביב', jerusalem: 'ירושלים' }[key] : { airport: 'Ben Gurion Airport', herzliya: 'Herzliya', telaviv: 'Tel Aviv', jerusalem: 'Jerusalem' }[key];
      bothLabel = label;
    }
  }
  const sameCity = input.trim().match(/^([\p{L}\s'׳״-]{2,50})\s+גם\s+(?:להחזיר\s+(?:גם\s+)?לאסוף|לאסוף\s+(?:(?:וגם|גם)\s+)?להחזיר)$/u)?.[1]?.trim();
  if (sameCity && !temporalLocation(sameCity)) { draft.pickupLocation = sameCity; draft.returnLocation = sameCity; return; }
  const stop = '(?=\\s+(?:ו?החזרה|להחזיר|נחזיר|אחזיר|נשאר(?:ת)?|מחרתיים|מחר|היום|ליומיים|ליום|tomorrow|today|day after tomorrow|for\\s+(?:one|two|three|four|five)\\s+days?|unchanged|remains?|stays?|(?:and\\s+)?return|(?:and\\s+)?drop.?off|ב[-־]?\\s*\\d)|[,.!?]|$)';
  const hePickup = input.match(new RegExp(`(?:איסוף|לאסוף)\\s+(?!מחר(?:תיים)?(?:\\s|$))[במ]([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${stop}`, 'iu'))?.[1];
  const enPickupStop = stop.replace('(?=', '(?=\\s+on\\s+\\d{1,2}|');
  const enPickup = input.match(new RegExp(`pick.?up\\s+(?:at|from|in)\\s+([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)${enPickupStop}`, 'iu'))?.[1];
  const enFromPickup = /rent|rental|pick.?up|\b(?:need|want|looking for)\b.*\b(?:suv|car|vehicle|van|sedan|minivan)\b/i.test(input)
    ? input.match(/\bfrom\s+([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=\s+(?:on\s+\d{1,2}|(?:on\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+\d{1,2}))/iu)?.[1]
    : undefined;
  const pickup = (hePickup ?? enPickup ?? enFromPickup)?.trim();
  if (pickup && !temporalLocation(pickup)) draft.pickupLocation = /^(?:the )?airport$/i.test(pickup) && /Ben Gurion Airport/i.test(input) ? 'Ben Gurion Airport' : pickup;
  const heReturnMatch = input.match(/(?:החזרה|להחזיר|נחזיר|אחזיר|מחזיר(?:ה|ים|ות)?)\s+(?:גם\s+)?(?:(?:את\s+)?הרכב\s+)?(?:גם\s+)?(?:(?:תהיה|יהיה)\s+)?(?!מחר(?:תיים)?(?:\s|[,.!?]|$))[במ]([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=\s+(?:כמו|כפי|נהג|גיל|בן|בת|למשך|לתאריכים|מחרתיים|מחר|היום|ליומיים|ליום|ב[-־]?\s*\d)|[,.!?]|$)/iu);
  const heReturn = heReturnMatch && !/(?:לא|אל|בלי)\s*$/u.test(input.slice(0, heReturnMatch.index)) ? heReturnMatch[1] : undefined;
  const enReturn = input.match(/(?:return|drop.?off)\s+(?:(?:the car|it)\s+)?(?:(?:will be|will remain|stays?|remains?)\s+)?(?:at|in|to)\s+([\p{L}][\p{L}\s'׳״-]{1,70}?)(?=\s+(?:on\s+\d{1,2}|tomorrow|today|day after tomorrow|for\s+(?:one|two|three|four|five)\s+days?)|[,.!?]|$)/iu)?.[1];
  const returnLocation = (heReturn ?? enReturn)?.split(/\s+(?:במקום|instead of)\s+/i)[0].trim().replace(/(?:\s+(?:בסוף|לבסוף|כרגיל|בבקשה|גם|אחר כך|please|too|as well|also|then))+$/iu, '');
  if (returnLocation && !temporalLocation(returnLocation)) draft.returnLocation = returnLocation;
  // "need a car in jerusalem" / "rental from herzliya": the named branch is the pickup.
  if (!draft.pickupLocation) {
    const enBranch = input.match(/\b(?:need|want|looking for|rent)\b[^.!?]{0,40}\b(?:car|rental|vehicle|suv|van)\b\s+(?:in|at|from)\s+(tel aviv|herzliya|jerusalem)\b/iu)?.[1];
    if (enBranch) draft.pickupLocation = { 'tel aviv': 'Tel Aviv', herzliya: 'Herzliya', jerusalem: 'Jerusalem' }[enBranch.toLowerCase()] ?? enBranch;
  }
  if (draft.pickupLocation && !draft.returnLocation && /\bsame place\b|\bsame location\b|\breturn(?:ing)? (?:it )?there\b|לאותו מקום|באותו מקום/iu.test(input)) draft.returnLocation = draft.pickupLocation;
  // A reply that opens with "מירושלים, …" / "from Herzliya, …" is where the car is picked up.
  const openingBranch = input.match(/^\s*(?:מ|from\s+)(תל אביב|הרצליה|ירושלים|tel aviv|herzliya|jerusalem)(?![\p{L}])/iu)?.[1];
  if (!draft.pickupLocation && openingBranch && !/(?:^|\s)אם\s|\bif\b/iu.test(input)) {
    draft.pickupLocation = ({ 'tel aviv': 'Tel Aviv', herzliya: 'Herzliya', jerusalem: 'Jerusalem' } as Record<string, string>)[openingBranch.toLowerCase()] ?? openingBranch;
  }
  // "צריך רכב לסופש מתל אביב": a branch after "מ" in a rental need is the pickup.
  if (!draft.pickupLocation && /(?:צריך|צריכה|צריכים|רוצה|רוצים|מחפש|מחפשת|לשכור|להשכיר|לקבל|לאסוף)\s+(?:[\p{L}]+\s+){0,4}?(?:רכב|אוטו)|(?:רכב|אוטו)\s+(?:[\p{L}]+\s+){0,3}?מ(?:תל אביב|הרצליה|ירושלים)/u.test(input)) {
    const branch = input.match(/(?<![\p{L}])מ(תל אביב|הרצליה|ירושלים)(?![\p{L}])/u)
      ?? (!/להחזיר|החזרה|נחזיר|מחזיר/u.test(input) ? input.match(/(?<![\p{L}])ב(תל אביב|הרצליה|ירושלים)(?![\p{L}])/u) : null);
    const before = branch ? input.slice(Math.max(0, branch.index! - 12), branch.index!) : '';
    if (branch && !/(?:להחזיר|החזרה|נחזיר|מחזיר|עד|ל)\s*$/u.test(before)) draft.pickupLocation = branch[1];
  }
  // "landing at ben gurion" / "נוחתים בנתב״ג": arrival at the airport is the pickup;
  // "returning at the airport (too)" is the return.
  const airportLabel = /[א-ת]/u.test(input) && !/[a-z]{4,}/i.test(input) ? 'נתב״ג' : 'Ben Gurion Airport';
  const airportWord = '(?:ben gurion(?: airport)?|tlv(?: airport)?|natbag|the airport|airport|נתב.?ג|נמל התעופה|שדה התעופה)';
  if (!draft.pickupLocation && new RegExp(`\\b(?:landing|land|arriving|arrive|fly(?:ing)? into)\\s+(?:at|in|to|into)?\\s*${airportWord}|(?:נוחת(?:ים|ת)?|נוחתות|ננחת|אנחת|מגיע(?:ים|ה)?)\\s+(?:ל|ב)${airportWord.replace('(?:', '(?:')}`, 'iu').test(input)
    && !/(?:^|\s)אם\s|\bif\b|what if/iu.test(input)) draft.pickupLocation = airportLabel;
  if (!draft.returnLocation && new RegExp(`\\b(?:returning|return(?:ing)? it|drop(?:ping)? (?:it )?off)\\s+(?:at|to)\\s+${airportWord}|(?:מחזיר(?:ים|ה)?|נחזיר|להחזיר)\\s+(?:גם\\s+)?(?:ב|ל)${airportWord}`, 'iu').test(input)) draft.returnLocation = airportLabel;
  if (bothLabel) { draft.pickupLocation = bothLabel; draft.returnLocation = bothLabel; }
  const dateText = `(?:\\d{1,2}[./]\\d{1,2}(?:[./]20\\d{2})?|\\d{1,2}\\s+(?:ב)?(?:${Object.keys(MONTHS).join('|')})(?:\\s+20\\d{2})?)`;
  // Parse each labelled date independently: customers may correct the return
  // before restating an unchanged pickup. Never associate dates by text order.
  const labelledDates: Partial<Record<'pickupDate' | 'returnDate', string>> = {};
  const labels = /(?:ה?איסוף|לאסוף|pick.?up|ה?החזרה|להחזיר|נחזיר|אחזיר|return|drop.?off)/giu;
  const mentions = [...input.matchAll(labels)];
  for (let index = 0; index < mentions.length; index++) {
    const mention = mentions[index];
    const clause = input.slice(mention.index! + mention[0].length, Math.min(mentions[index + 1]?.index ?? input.length, mention.index! + 130)).split(/[,!?\n]|(?<!\d)\.|\.(?!\d)/u)[0];
    if (/\b(?:or|maybe|if)\b|(?:^|\s)(?:או|אולי|אם)(?:\s|$)/iu.test(clause)) continue;
    const date = clause.match(new RegExp(dateText, 'iu'))?.[0];
    if (date) labelledDates[/איסוף|לאסוף|pick/iu.test(mention[0]) ? 'pickupDate' : 'returnDate'] = date;
  }
  if (labelledDates.pickupDate) {
    const date = singleDateAnswer(labelledDates.pickupDate);
    if (date) draft.pickupDate = date;
  }
  if (labelledDates.returnDate) {
    const date = singleDateAnswer(labelledDates.returnDate, draft.pickupDate);
    if (date) draft.returnDate = date;
  }
  const datedReturn = input.match(new RegExp(`(?:נחזיר|אחזיר|להחזיר|return(?:\\s+(?:it|the car))?|drop.?off)\\s+(?:ב[-־]?|on\\s+)?(${dateText})\\s+(?:ב[-־]?|in\\s+|to\\s+|at\\s+)([\\p{L}][\\p{L}\\s'׳״-]{1,70}?)(?=\\s+(?:במקום|instead\\s+of)|[,.!?]|$)`, 'iu'));
  if (datedReturn) {
    const date = singleDateAnswer(datedReturn[1], draft.pickupDate);
    if (date) draft.returnDate = date;
    if (!temporalLocation(datedReturn[2])) draft.returnLocation = datedReturn[2].trim();
  }
  // "רכב 7 מקומות … מנתב״ג", "need a car next week in jerusalem": one branch named in a rental request is the pickup.
  if (!draft.pickupLocation && /רכב|לשכור|השכרה|car|rent|vehicle|suv|van/iu.test(input) && !/\bwhat if\b|\bif\b|\bmaybe\b|מה אם|(?:^|\s)אם\s|אולי|להחזיר|החזרה|return|drop.?off/iu.test(input)) {
    const he = /[א-ת]/u.test(input);
    const found = [...input.matchAll(/(?:^|[\s,.])(?:from |in |at |מ|ב)(the airport|ben gurion(?: airport)?|tlv|natbag|herzliya|tel aviv|jerusalem|נתב["״׳']?ג|שדה התעופה|הרצליה|תל אביב|ירושלים)(?![\p{L}])/giu)].map(match => match[1]);
    const keys = [...new Set(found.map(place => /air|ben gurion|tlv|natbag|נתב|שדה/iu.test(place) ? 'airport' : /herz|הרצ/iu.test(place) ? 'herzliya' : /tel aviv|תל אביב/iu.test(place) ? 'telaviv' : 'jerusalem'))];
    if (keys.length === 1) draft.pickupLocation = (he ? { airport: 'נתב״ג', herzliya: 'הרצליה', telaviv: 'תל אביב', jerusalem: 'ירושלים' } : { airport: 'Ben Gurion Airport', herzliya: 'Herzliya', telaviv: 'Tel Aviv', jerusalem: 'Jerusalem' })[keys[0] as 'airport'];
  }
  if (draft.pickupLocation && (/אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input) || explicitSameReturn(input))) draft.returnLocation = draft.pickupLocation;
}

function explicitBooking(input: string): boolean {
  if (/להשכיר.{0,25}(?:לכם|לחברה)|(?:הרכב שלי|רכב שבבעלותי).{0,30}להשכיר/i.test(input)) return false;
  if (/לא נתחיל\s+(?:בקש(?:ה|ת השכרה)|הזמנה)|\b(?:do not|don't) start\s+(?:a\s+)?(?:request|booking)/i.test(input)) return false;
  if (/(?:לא רוצה|לא רוצים|לא מעוניין|אל).{0,15}(?:להתחיל|להתחילו?|לפתוח).{0,12}(?:בקש(?:ה|ת השכרה)|הזמנה)/i.test(input)) return false;
  if (/לא רוצה להזמין|לא רוצה (?:לשכור|להשכיר)|רק מתעניין|רק שואל|לא עכשיו|not ready|just asking|don't book|do not book/i.test(input)) return false;
  // Asking what the customer must supply in order to proceed is a request to
  // start, not a policy question. It does not consent to sending anything.
  if (/(?:מה|אילו פרטים|איזה פרטים)\s+(?:עוד\s+)?(?:אתה|את|אתם)?\s*(?:צריך|צריכה|צריכים)\s+(?:ממני|מאיתנו|ממנו)\s+(?:כדי|בשביל)\s+(?:להתקדם|להזמין|לסגור|לשריין|להגיש)|\bwhat (?:else )?do you need from (?:me|us) to (?:proceed|book|go ahead|move forward)\b|\bwhat do (?:I|we) need to (?:give|send|provide) (?:you )?to (?:proceed|book|go ahead)\b/iu.test(input)) return true;
  if (/[?؟]/.test(input) && /כדאי|האם|should|would it|how/i.test(input)) return false;
  if (/(?:כן[,\s]*)?נתחיל\s+(?:בקש(?:ה|ת השכרה)|הזמנה)|\b(?:let'?s|let us)\s+start\s+(?:a\s+)?(?:rental\s+)?(?:request|booking)\b|\bI\s+(?:want|would like)\s+to\s+(?:start|open)\s+(?:a\s+)?(?:rental\s+)?(?:request|booking)\b/i.test(input)) return true;
  if (/^(?:כן[,\s]*)?כבר ביקשתי להתחיל[.!\s]*$/i.test(input)) return true;
  if (/(?<!\b(?:to|if|decide to|before I)\s)\b(?:go ahead|book it|let['’]?s book(?: it)?)\b[,.!\s]+(?:i['’]?m|im|i am|my name is|name['’]?s)\s+(?!(?:still|not|just|only|comparing|thinking|unsure|sure|ok|fine|good|ready|looking|asking|waiting|deciding|a|the|so|also|very|really)\b)[\p{L}'-]{2,20}/iu.test(input) && !/\b(?:don['’]?t|do not|not yet|no change request|still comparing)\b/i.test(input)) return true;
  if (/^(?:ok(?:ay)?|fine|sure|yes|yeah)?[.,!\s]*(?:book it|let['’]?s book it)[.!\s]*$/iu.test(input.trim())) return true;
  if (/^(?:(?:ok(?:ay)?|fine|sure|yes|yeah|great|perfect|cool)[.,!\s]+)?(?:book it|let['’]?s book it|go ahead)[.,!]\s+[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}\b/iu.test(input.trim())) return true;
  if (/(?:^|[\s,.!])(?:תסגור|תסגרו|סגור|סגרנו|נסגור)(?:\s+(?:לי|לנו|את זה|אותו))?\s*[.!]?$/u.test(input.trim()) && !/(?:^|\s)(?:לא|אל|עוד לא)\s+(?:תסגור|לסגור)/u.test(input)) return true;
  if (/(?:^|[\s,.!])(?:תרשום|תרשמו|רשום|רשמו|תפתח(?:ו)?)\s+(?:לי\s+)?(?:את\s+(?:זה|הבקשה)\s+)?על\s+שם\s+[\p{L}'-]{2,20}/u.test(input) || /\b(?:book|put) it under\s+[\p{L}'-]{2,20}/iu.test(input)) return true;
  if (/^(?:יאללה|סבבה|אוקיי?|טוב|כן)?[,\s]*(?:תפתח(?:ו)?|פתח(?:ו)?|תתקדם|תתקדמו|נתקדם|תרשום|תרשמו)(?:\s+לי)?[,.!\s]+[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}(?:\s*,?\s*(?:(?:בן|בת)\s*)?\d{2})?\s*[.!]?$/u.test(input.trim())) return true;
  if (/^(?:(?:ok(?:ay)?|sure|great|perfect|yes|yeah|אוקיי?|מעולה|כן)[,.!\s]+)?(?:יאללה|סבבה|אוקיי?|טוב|ok(?:ay)?|go ahead|let['’]?s (?:go|do it|do this))[.,!\s]+[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}(?:\s*,?\s*(?:(?:בן|בת|aged?)\s*)?\d{2})?\s*[.!]?$/iu.test(input.trim())) return true;
  if (/(?:^|[\s,.!])(?:סבבה|יאללה|טוב|אוקיי?|אז)?\s*(?:תפתח(?:ו)?|פתח(?:ו)?|תכין|תכינו)\s+(?:לי\s+)?(?:בקש(?:ה|ת השכרה)|הזמנה)(?![\p{L}])|\b(?:go ahead and )?open (?:a |the |my )?(?:rental )?(?:request|booking)\b/iu.test(input)) return true;
  if (/(?:אני רוצה|אנחנו רוצים|רוצה|רוצים|כבר ביקשתי)\s+(?:להתחיל|לפתוח)(?:\s+(?:את ה|את|ה))?\s*(?:בקש(?:ה|ת השכרה)|הזמנה)/i.test(input)) return true;
  if (/^I need (?:a )?(?:(?:compact|small|family|SUV|seven[- ]?seat) )?rental car\b/i.test(input)) return true;
  return /אני רוצה (?:להזמין|לשכור|להשכיר|לשלוח בקשה|לסיים את הבקשה|להתקדם עם בקש(?:ה להשכרה|ת השכרה))|(?:^|[.!?]\s*)רוצה (?:לשכור|להשכיר|לשלוח בקשה|לסיים את הבקשה)|(?:אני\s+)?צריך(?:ה)? (?:רכב להשכרה|לשכור רכב|רכב (?:קטן|קומפקטי|משפחתי|פנאי|שבעה מקומות)(?:\s|$))|בוא(?:ו)? נתקדם|בוא(?:ו)? (?:נלך על זה|נסגור)|יאללה נסגור|תשריין לי|שריין לי|אפשר להתחיל (?:הזמנה|בקשה)|אשמח להתחיל (?:בקשה|הזמנה)|תכין(?:ו)? (?:לי )?(?:בקש(?:ה|ת השכרה)|הצעה)|אני (?:אזמין|אשכור)|I(?:'d| would) like to (?:book|rent|make a request)|let'?s (?:book|proceed|close)|I want to (?:book|rent|make a request)|I need (?:a )?(?:rental car|to rent(?: a car)?)|go ahead with (?:the )?(?:rental|request)/i.test(input);
}

function greeting(input: string, locale: Locale): string | null {
  if (/^(?:היי+|הי+|שלום|אהלן|hi+|hello|hey)[,!?.\s]+(?:מה נשמע|מה קורה|מה שלומך|how are you|how is it going)[!?.\s🙂]*$/i.test(input)) {
    return locale === 'he' ? 'היי 🙂 הכול טוב, תודה ששאלת. מה שלומך? איך אפשר לעזור לך היום?' : 'Hi 🙂 Doing well, thanks for asking. How are you? How can I help today?';
  }
  if (/^(?:היי+|הי+|שלום|אהלן|hi+|hello|hey)[,!?.\s]+(?:אפשר לשאול(?: שאלה)?|רציתי לשאול(?: שאלה)?|can I ask(?: a question)?|I have a question)[!?.,\s]*$/i.test(input)) {
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

function declinesHumanHandoff(input: string): boolean {
  return /אל תתקשרו|אל תתקשר|אל תחזרו אלי|לא לחזור אלי|(?:לא רוצה|לא רוצים|לא צריך|לא צריכים|עדיין לא).{0,45}(?:שיחזרו|תחזרו|שיתקשרו|תתקשרו)|אל תעביר|לא להעביר|אל תשלח|לא לשלוח|(?:do not|don['’]?t)\s+(?:pass|send|contact|call)\b|(?:לא רוצה|לא רוצים|לא מוכן|לא מוכנה|לא מוכנים|לא עכשיו|עדיין לא|בלי|לא צריך|לא צריכה|לא צריכים|אין צורך|אין לי צורך).{0,45}(?:נציג|בן אדם|לדבר)|(?:not ready|do not want|don['’]?t want|do not need|don['’]?t need|not yet|no need).{0,60}(?:representative|human|person|call)|\bno\s+(?:representative|human|person|callback|call)\b|(?:representative|human|person).{0,25}(?:not yet|later)|נציג.{0,15}לא עכשיו/i.test(input);
}

function offersHumanHandoff(reply: string): boolean {
  return /תרצ(?:ה|ו).{0,35}(?:שאעביר|שנציג)|would you like.{0,40}(?:representative|pass)/i.test(reply)
    || /(?:תרצ(?:ה|ו)|האם|אפשר)[^?؟.!]{0,35}(?:שנחבר|שנקשר|שנעביר|לחבר|לקשר|להעביר)[^?؟.!]{0,70}(?:נציג|צוות|בן אדם)[^?؟]*[?؟]/i.test(reply);
}

function offersServiceChangeReview(reply: string): boolean {
  if (/(?:תרצ(?:ה|ו)|האם)[^?؟.!]{0,40}(?:שנבדוק|לבדוק|שנעביר|להעביר)[^?؟.!]{0,60}(?:הארכה|להארכה|יום נוסף|עוד יום|קיצור|לקיצור|שינוי)[^?؟.!]*[?؟]/u.test(reply)) return true;
  if (/(?:would you like|shall we|do you want|want us to|תרצ(?:ה|ו)|שנבדוק)[^?؟.!]{0,65}(?:check|לבדוק|נבדוק)[^?؟.!]{0,40}(?:availability|זמינות)[^?؟.!]{0,50}(?:extra day|additional day|one more day|extension|יום נוסף|עוד יום|הארכה)[^?؟.!]*[?؟]/iu.test(reply)) return true;
  return /extension|shortening|date change|הארכה|קיצור|שינוי/iu.test(reply)
    && /(?:would you like|shall we|תרצ(?:ה|ו)|אפשר)[^?؟.!]{0,65}(?:review|submit|send|pass|שנעביר|להעביר|נגיש|להגיש|נשלח|לשלוח)[^?؟.!]{0,45}(?:request|בקשה|בקשת)[^?؟.!]*[?؟]/iu.test(reply);
}

function carryCommercialRentalNeeds(state: RebuildState): void {
  const category = state.commercial?.vehiclePreference;
  if (category && !state.booking.vehicleNeed) {
    const names = state.locale === 'he'
      ? { compact: 'רכב קומפקטי', family: 'רכב משפחתי', suv: 'רכב פנאי', seven_seat: 'רכב שבעה מקומות' }
      : { compact: 'compact car', family: 'family car', suv: 'SUV', seven_seat: 'seven-seat car' };
    state.booking.vehicleNeed = names[category];
  }
  state.booking.passengers ??= state.commercial?.passengers;
  state.booking.luggage ??= state.commercial?.luggage;
}

function offersRentalRequest(reply: string): boolean {
  if (/(?:would you like|shall (?:we|I)|do you want|want (?:me|us) to)[^?]{0,40}\b(?:price )?(?:quote|offer)\b[^?]{0,60}\?|(?:תרצ(?:ה|ו)|האם (?:תרצ(?:ה|ו)|נכין))[^?؟]{0,40}הצע(?:ת|ה)[^?؟]{0,60}[?؟]/iu.test(reply)) return true;
  // Reserve/hold wording is still only an invitation to prepare a request.
  if (/(?:האם|תרצ(?:ה|ו)|שנ)?\s*(?:נשריין|לשריין|שנשריין)[^?؟]{0,80}[?؟]|\b(?:shall|should|can) (?:we|I) (?:reserve|hold|book)\b[^?]{0,80}\?|\bwould you like (?:us|me) to (?:reserve|hold|book)\b[^?]{0,80}\?/iu.test(reply)) return true;
  if (/(?:לאשר|לשלוח|להעביר|נשלח|נעביר|שנגיש|להגיש)[^?؟]{0,40}(?:את )?ה?בקשה[^?؟]{0,40}[?؟]|(?:אפשר|האם) לאשר[^?؟]{0,40}[?؟]|\b(?:confirm|send|submit)\b[^?]{0,40}\b(?:request|booking)\b[^?]{0,30}\?/iu.test(reply)) return true;
  return /(?:נמשיך|נתקדם|להתקדם|נתחיל|להתחיל|שנתחיל|נאסוף|לאסוף).{0,85}(?:הזמנה|בקשה|פרטים|זמינות)|(?:הזמנה|בקשה).{0,55}(?:נתקדם|נתחיל|נמשיך)|(?:continue|proceed|start|prepare|check).{0,70}(?:booking|rental|request|availability)/i.test(reply);
}

function acceptsRentalInvitation(input: string, lastBot: string): boolean {
  if (!offersRentalRequest(lastBot)) return false;
  if (/לא עכשיו|עדיין לא|עוד לא|לא (?:רוצה|רוצים|מעוניין|מעוניינים).{0,20}(?:להתחיל|לפתוח|להזמין)|אל (?:תתחיל|תפתח|תזמין)|not (?:now|yet|ready)|(?:do not|don['’]?t) (?:start|open|book)/iu.test(input)) return false;
  // Accepting the invitation starts a draft, not a booking or consented send.
  // Customers commonly attach their name, a question or a spending boundary.
  return affirms(input) || /^(?:(?:(?:כבר\s+)?אמרתי|כתבתי)\s+)?(?:כן(?:[,\s]+(?:יאללה|בטח|סבבה|בבקשה|קדימה))*|יאללה|סבבה|yes|yeah|sure|okay|ok|go ahead|let['’]?s do it)(?=[\s,.!;]|$|\p{Extended_Pictographic})/iu.test(input)
    || /^I (?:already )?said yes\b/i.test(input);
}

function asksRentalDates(reply: string): boolean {
  if (!/[?؟]/.test(reply) && !/(?:באיזה|איזה|באילו|אילו|לאילו|מתי|מהם|אשמח לדעת|what|which|when)/i.test(reply)) return false;
  return /(?:באיזה|איזה|באילו|אילו|לאילו|מהם)\s+(?:תאריך|תאריכים?)|(?:תאריך|תאריכ|מתי).{0,55}(?:לאסוף|להחזיר|תצטרכ|רכב|השכר|לבדוק)|(?:לאסוף|להחזיר|רכב|השכר).{0,35}(?:תאריך|תאריכים?)|(?:what|which) dates?.{0,55}(?:pick.?up|return|need|car)|when.{0,45}(?:pick.?up|return)/i.test(reply);
}

function directVehicleRequest(input: string, locale: Locale): boolean {
  return !/[?؟]/.test(input) && /^(?:אני רוצה|אנחנו רוצים|אני צריך|אני צריכה|צריך|צריכה|רוצה|I want|I need|we want)\s+(?:(?:לשכור|להשכיר)\s+)?(?:רכב|ג[׳'י]?יפ(?:ון)?|SUV|a\s+(?:car|SUV))/i.test(input)
    && Boolean(explicitVehicleNeed(input, locale));
}

function sameLocationAnswer(value: string): boolean {
  return /^(?:ב?אותו (?:מקום|סניף)|שם גם|(?:at )?(?:the )?same (?:place|location|branch))$/i.test(value);
}

function plainLocationAnswer(input: string, locale: Locale): string | null {
  const location = input.trim().replace(/^(?:ב?סניף\s+|(?:the\s+)?branch\s+(?:in\s+)?)/i, '');
  if (temporalLocation(location)) return null;
  if (sameLocationAnswer(location)) return location;
  if (!/^[\p{L}'׳״ -]{2,45}$/u.test(location) || location.split(/\s+/).length > 3 || /^(?:כן|לא|לא יודע|תודה|yes|no|not sure)$/i.test(location)
    || /רכב|מעדיף|בעצם|רוצה|צריך|מחפש|מחיר|תאריך|זמינ|שאלה|ליסינג|לקנות|rent|prefer|price|booking/i.test(location)
    // A car category ("compact", "קטן", "SUV") answers the car question, never the place.
    || /^(?:a |an |the )?(?:compact|small|big|large|family|suv|jeep|sedan|van|minivan|seven[- ]?seat(?:er)?|7[- ]?seat(?:er)?|economy|cheap(?:est)?|קטן|קטנה|גדול|גדולה|משפחתי|משפחתית|קומפקטי|קומפקטית|פנאי|ג['׳]?יפ|ג['׳]?יפון|חסכוני|זול|7 מקומות|שבעה מקומות)(?: car| one| רכב)?$/iu.test(location.trim())) return null;
  if (/לא בטוח|לא יודעת|לא יודע|not sure|don['’]?t know|do not know/i.test(location)) return null;
  if (affirms(location) || /^(?:thanks?(?: a lot)?|thank you(?: very much)?|תודה(?: רבה)?)[.!\s]*$/i.test(location)) return null;
  // "yes send it", "ok go ahead", "תשלח": an answer or a command, never a place.
  if (/^(?:yes|yeah|yep|ok(?:ay)?|sure|please|go|send|do|book|confirm|כן|אוקיי|סבבה|יאללה|תשלח|תשלחו|שלח|תזמין|תסגור|מאשר|מאשרת)(?:\s|$)/iu.test(location.trim()) || /\b(?:send|book|confirm|go ahead|do it)\b/iu.test(location)) return null;
  const serviceTopic = getSmartCarServiceAnswer(input, locale)?.topic;
  if (serviceTopic && serviceTopic !== 'branches' && serviceTopic !== 'different_location') return null;
  // A sentence containing both locations has already been parsed by
  // applyExplicitLocations; it must never become the pickup-city value.
  if (/איסוף|לאסוף|להחזיר|נחזיר|אחזיר|החזרה|pick.?up|drop.?off|return/i.test(location)) return null;
  return location;
}

function applyPromptedLocation(input: string, state: RebuildState, lastBot: string, pendingField: BookingKey | null): void {
  // "Shall we have the car ready at Ben Gurion Airport?" answered "yes" / "ok lets do it": the suggested place.
  if (!state.booking.pickupLocation && (affirms(input) || explicitBooking(input) || /^\s*(?:yes|כן)\b/iu.test(input)) && /[?؟]\s*$/u.test(lastBot.trim())) {
    const suggested = lastBot.match(/(?:ready|pick(?:\s+it)?\s*up|collect|meet you|לאסוף|איסוף|יחכה|מוכן)[^?؟]{0,60}?(?:\bat\b|\bin\b|\bfrom\b|ב|מ)\s*(Ben Gurion Airport|the airport|Tel Aviv|Herzliya|Jerusalem|נתב״ג|נתב"ג|נתבג|שדה התעופה|תל אביב|הרצליה|ירושלים)/iu)?.[1];
    if (suggested) {
      state.booking.pickupLocation = /airport|נתב|שדה/iu.test(suggested) ? (state.locale === 'he' ? 'נתב״ג' : 'Ben Gurion Airport') : suggested;
      return;
    }
  }
  const location = plainLocationAnswer(input, state.locale);
  if (!location) return;
  if (sameLocationAnswer(location)) {
    if (state.booking.pickupLocation) state.booking.returnLocation = sameReturnLabel(state);
    return;
  }
  // Bare city answers belong to the pending field, independently of how the
  // question was worded (for example “pick it up” versus “pickup”).
  if (state.phase === 'booking' && state.step === 'rental_locations') {
    if (pendingField === 'pickupLocation') { state.booking.pickupLocation = location; return; }
    if (pendingField === 'returnLocation') { state.booking.returnLocation = location; return; }
  }
  if (/מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|עיר האיסוף|pickup (?:city|location)|where.{0,30}pick(?:\s+(?:it|the car))?[\s-]*up/i.test(lastBot)) state.booking.pickupLocation = location;
  else if (/איפה.{0,30}להחזיר|עיר ההחזרה|מקום ההחזרה|return (?:city|location)|where.{0,30}return/i.test(lastBot)) state.booking.returnLocation = location;
  else if (/^(?:הרצליה|תל אביב|ירושלים|נתב["״']?ג|חיפה|רמת גן|פתח תקווה|נתניה|ראשון לציון|רעננה)$/i.test(location)) {
    const recentBot = state.history.filter(entry => entry.from === 'bot').slice(-4).map(entry => entry.text).join(' ');
    if (!state.booking.pickupLocation && /מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|באיזה סניף.{0,30}לאסוף|הסניפים שלנו|pickup (?:city|location)/i.test(recentBot)) state.booking.pickupLocation = location;
    else if (state.booking.pickupLocation && !state.booking.returnLocation && /איפה.{0,30}להחזיר|עיר ההחזרה|מקום ההחזרה|where.{0,30}return/i.test(recentBot)) state.booking.returnLocation = location;
  }
}

function statedCount(value: string): number | null {
  const words: Record<string, number> = { אחד: 1, אחת: 1, שניים: 2, שתיים: 2, שתי: 2, שני: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5, שישה: 6, שש: 6, שבעה: 7, שבע: 7, שמונה: 8, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const count = /^\d{1,2}$/.test(value) ? Number(value) : words[value.toLocaleLowerCase()] ?? null;
  return count !== null && count > 0 && count <= 20 ? count : null;
}

function explicitPartnerAndChildGroup(input: string): boolean {
  for (const sentence of input.split(/[.!?;]/u)) {
    const match = sentence.match(/\b(?:I(?: am|['’]m)?\s+)?(?:travell?ing|going|coming)\s+with\s+my\s+(?:wife|husband|partner|spouse)\s+and\s+(?:our|my|a|one)\s+(?:child|kid|baby|infant|son|daughter)\b|(?:אני\s+)?(?:נוסע(?:ת)?|מגיע(?:ה)?)\s+עם\s+(?:(?:בן|בת)\s+הזוג\s+שלי|אשתי|בעלי)\s+ו(?:עם\s+)?(?:הילד(?:ה)?\s+שלנו|ילד(?:ה)?\s+אחד(?:ת)?)(?![\p{L}])/iu);
    if (!match) continue;
    const prefix = sentence.slice(0, match.index);
    const self = /^(?:I\b|אני\s)/iu.test(match[0])
      || /,\s*$/u.test(prefix) && /\bI\b|(?:^|\s)אני(?:\s|$)/iu.test(prefix);
    // Only a declared current travelling group; not a hypothetical or someone
    // else's description. Singular child nouns supply the one-child evidence.
    if (self && !/\b(?:if|whether|not|never|might|may|could|would|should|don't|do not|won't)\b[^.!?;]{0,35}$|(?:^|\s)(?:אם|אולי|לא|אינני|ייתכן|יתכן|שוקל|שוקלת)[^.!?;]{0,35}$/iu.test(prefix)) return true;
  }
  return false;
}

function negatedLuggageMention(input: string, index: number): boolean {
  const prefix = input.slice(Math.max(0, index - 55), index);
  return /(?:\b(?:no|without|never|not(?: bringing| taking)?|(?:don['’]?t|do not|won['’]?t|will not|aren['’]?t|are not)\s+(?:have|bring|bringing|take|taking))|(?:אין(?: לנו| לי)?|ללא|בלי|לא(?: מביאים| מביא| מביאה| צריך| צריכים| ניקח)?))\s*$/iu.test(prefix);
}

function applyExplicitNeeds(input: string, draft: BookingDraft): void {
  const count = '(\\d{1,2}|אחד|אחת|שניים|שתיים|שתי|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש|שישה|שש|שבעה|שבע|שמונה|one|two|three|four|five|six|seven|eight)';
  const passengers = [...input.matchAll(new RegExp(`(?:אנחנו|נהיה|we are|we['’]re|there are|there will be)\\s+${count}(?=\\s|$)|${count}\\s+(?:נוסעים|אנשים|מבוגרים|חברים|חברות|passengers|people|adults|friends|of us)`, 'giu'))]
    .filter(match => !negatedLuggageMention(input, match.index) && !isHypotheticalFactEvidence(input, match[0]) && !isRentalCapacityQuestionEvidence(input, match[0])).at(-1);
  const luggage = [...input.matchAll(new RegExp(`${count}\\s+(?:(?:small|medium|large|קטנות|בינוניות|גדולות)\\s+)?(?:מזוודות|מזוודה|תיקים|תיקי נסיעה|bags?|suitcases?)(?![\\p{L}])`, 'giu'))]
    .find(match => !negatedLuggageMention(input, match.index) && !isHypotheticalFactEvidence(input, match[0]) && !isRentalCapacityQuestionEvidence(input, match[0]));
  const passengerCount = statedCount(passengers?.[1] ?? passengers?.[2] ?? '');
  // "2 adults 2 kids" / "3 מבוגרים ושני ילדים": everyone counts.
  const adultsKids = input.match(new RegExp(`${count}\\s+(?:adults?|grown[- ]ups|מבוגרים|מבוגרות)\\s*(?:,|and|\\+|ו[־-]?|עם|with)?\\s*${count}\\s+(?:kids?|children|child|babies|ילדים|ילדות|ילד|ילדה|תינוקות)`, 'iu'));
  if (adultsKids && !/(?:^|\s)אם\s|מה אם|\bif\b|what if/iu.test(input)) {
    const adults = statedCount(adultsKids[1]); const kids = statedCount(adultsKids[2]);
    if (adults && kids) draft.passengers = adults + kids;
  }
  // "זוג עם 2 ילדים" / "couple with two kids": two adults plus the stated children.
  const family = input.match(new RegExp(`(?:זוג|שני הורים|אני ו(?:אשתי|בעלי|בן הזוג שלי|בת הזוג שלי)|(?:a |we(?:'re| are) a )?couple|two adults|me and my (?:wife|husband|partner))\\s+(?:עם|ו[־-]?|with|and|\\+)\\s*${count}\\s+(?:ילדים|ילדות|ילד|ילדה|kids|children|child)`, 'iu'));
  if (family && !passengers && !/(?:^|\s)אם\s|מה אם|\bif\b|what if/iu.test(input)) {
    const kids = statedCount(family[1]);
    if (kids) draft.passengers = 2 + kids;
  }
  // "Me and my girlfriend" / "אני ואשתי" is two travellers when no other
  // count was stated and no third person is added in the same phrase.
  const coupleOnly = !passengers && /\b(?:it['’]?s |just )?(?:me|myself|I) and my (?:gf|girlfriend|bf|boyfriend|wife|husband|partner|spouse|friend|mom|mum|mother|dad|father|brother|sister)\b(?!,?\s*(?:and|&|\+)\s)|(?:^|[\s,.])(?:רק )?אני ו(?:אשתי|בעלי|החבר(?:ה)? שלי|חבר(?:ה)? שלי|בן הזוג שלי|בת הזוג שלי|אמא שלי|אבא שלי|אחי|אחותי)(?!,?\s*(?:ו|\+))(?![\p{L}])/iu.test(input)
    && !isHypotheticalFactEvidence(input, input) && !/what if|\bif\b|\bmaybe\b|מה אם|(?:^|\s)אם\s|אולי/iu.test(input);
  if (coupleOnly && draft.passengers === undefined) draft.passengers = 2;
  const luggageCount = statedCount(luggage?.[1] ?? '');
  if (passengerCount !== null && !(adultsKids && draft.passengers && draft.passengers > passengerCount)) draft.passengers = passengerCount;
  if (luggageCount !== null) draft.luggage = luggageCount;
  if (/מזווד.{0,18}גדול|large (?:bags?|suitcases?|luggage)(?![\p{L}])/iu.test(input) && (luggageCount !== null || !luggage && /מזווד.{0,18}גדול/u.test(input))) draft.luggageSize = 'large';
  if (!family && /אנחנו זוג|זוג עם|שני אנשים|שני נוסעים|we are a couple|two of us/i.test(input)) draft.passengers = 2;
  // Count the child as a passenger when the customer explicitly describes a
  // couple travelling with one. A five-year-old is not luggage or a seat count.
  const coupleWithChild = /(?<![\p{L}])(?:זוג|שני (?:מבוגרים|אנשים)).{0,45}(?:עם|ו[- ]?).{0,20}(?:תינוק|ילד(?:ה)?(?: אחד(?:ת)?)?)(?![\p{L}])|(?:my (?:wife|husband|partner|spouse) and I|myself and my (?:wife|husband|partner|spouse)|two adults?).{0,90}(?:(?:with|and) (?:our|a|one) (?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[- ]year[- ]old|with (?:our|a|one) (?:child|kid|baby|infant|son|daughter)|and (?:one|a) (?:child|kid|baby|infant))/iu.test(input);
  if (coupleWithChild) draft.passengers = 3;
  if (passengerCount === null && explicitPartnerAndChildGroup(input)) draft.passengers = 3;
  if (/זוג עם (?:שני|שתי) ילדים|זוג ושני ילדים|(?:we are a )?couple with two children/i.test(input)) draft.passengers = 4;
  const adultsAndChildren = input.match(new RegExp(`${count}\\s+adults?\\s+(?:and|with)\\s+${count}\\s+(?:children|kids)`, 'iu'))
    ?? input.match(new RegExp(`(\\d{1,2}|שני|שתי|שלושה|ארבעה|one|two)\\s+מבוגרים\\s+(?:ו|עם\\s*)[־-]?\\s*${count}\\s+(?:ילדים|ילדות|ילדות)(?![\\p{L}])`, 'u'));
  if (adultsAndChildren) {
    const adults = statedCount(adultsAndChildren[1]);
    const children = statedCount(adultsAndChildren[2]);
    if (adults !== null && children !== null && adults + children <= 20) draft.passengers = adults + children;
  }
  if (/my (?:wife|husband|partner|spouse) and I.{0,90}with our \d{1,2}[- ]year[- ]old/i.test(input)) draft.passengers = 3;
  const singularLuggage = input.match(/מזוודה(?![\p{L}])|תיק(?: נסיעה)? אחד(?![\p{L}])/iu);
  if (draft.luggage === undefined && singularLuggage && !negatedLuggageMention(input, singularLuggage.index!)) draft.luggage = 1;
  if (/תינוק|baby|infant/i.test(input)) draft.childSeats ??= 1;
  if (/(?:can (?:you|we|i) (?:provide|add|include|arrange|request|get)|do you (?:provide|have|offer)|אפשר (?:לקבל|להוסיף)|תוכלו (?:לספק|להוסיף)|יש (?:לכם|אצלכם)?).{0,18}(?:child seat|car seat|booster|כיסא בטיחות|כיסא בוסטר|בוסטר|כיסא לילד|כיסא לתינוק)/i.test(input)) draft.childSeats ??= 1;
  for (const clause of input.split(/[.!?;,]|\bbut\b|\bactually\b|אבל|בעצם/iu)) {
    const bringsOwnSeat = /(?:bring(?:ing)?|brought|taking)\s+(?:my|our|their)\s+own\s+(?:child|car)\s+seats?|(?:נביא|אביא|מביא(?:ים|ות|ה)?).{0,20}כיסא(?:ות)?(?: בטיחות)?.{0,15}(?:משלנו|משלי)/iu.test(clause)
      && !/(?:not|n['’]t|לא).{0,12}(?:bring|brought|taking|נביא|אביא|מביא)/iu.test(clause);
    const noSeatRequested = /^\s*(?:(?:we|I) need\s+)?(?:no|zero)\s+(?:child|car)\s+seats?(?:\s+(?:needed|required|please))?\s*$/iu.test(clause)
      || /^\s*בלי\s+כיסא(?:ות)?\s+בטיחות\s*$/u.test(clause);
    if (bringsOwnSeat || noSeatRequested || /(?:לא (?:צריך(?:ה|ים)?|רוצ(?:ה|ים)|נרצה|ארצה|נצטרך|נבקש)|אין צורך|do not (?:need|want)|don't (?:need|want)|would not like|wouldn't like|please remove).{0,18}(?:כיסא|child seats?|car seats?)/i.test(clause)) {
      // Keep an explicit zero so later model extraction or a baby mention
      // cannot silently restore a seat request the customer declined.
      draft.childSeats = 0;
      continue;
    }
    const request = clause.match(/(?:צריך(?:ה|ים)?|נבקש|נרצה|ארצה|נצטרך|אפשר לבקש|תוסיפו|תוסיף|להוסיף|we need|I need|(?:we|I) would like|(?:we|I)['’]d like|please add|\badd\b).{0,18}(?:כיסא(?:ות)? בטיחות|כיסא(?:ות)? בוסטר|בוסטר(?:ים)?|child seats?|car seats?|booster(?: seat)?s?)/i);
    if (!request) continue;
    // Limit counts to the requested seat phrase, never the child's later age.
    const seatText = clause.slice(request.index!, request.index! + request[0].length + 12);
    // A count before the noun ("שני כיסאות בטיחות, אחד לתינוק…") is the total;
    // a number after it usually starts a per-child breakdown.
    const seatCount = (/שני\s+כיסאות בטיחות/u.test(seatText) ? '2' : undefined)
      ?? seatText.match(new RegExp(`${count}\\s+(?:כיסא(?:ות)? בטיחות|בוסטר(?:ים)?|child seats?|car seats?|booster(?: seat)?s?)`, 'iu'))?.[1]
      ?? seatText.match(new RegExp(`בוסטר(?:ים)?\\s+${count}(?!\\s+ל)`, 'iu'))?.[1]
      ?? seatText.match(new RegExp(`כיסא(?:ות)? בטיחות\\s+${count}(?!\\s+ל)`, 'iu'))?.[1];
    draft.childSeats = statedCount(seatCount ?? '1') ?? 1;
  }
  if (/אדם אחד|איש אחד|נוסע אחד|נוסעת אחת|אני לבד|(?:^|\s)לבד(?:\s|$)|\b(?:one person|solo|travelling alone|traveling alone)\b/i.test(input)) draft.passengers = 1;
}

function explicitVehicleNeed(input: string, locale: Locale): string | null {
  if (/^\s*קטן\s*$/u.test(input)) return locale === 'he' ? 'רכב קומפקטי' : 'compact car';
  if (/^\s*משפחתי(?:ת)?\s*$/i.test(input)) return locale === 'he' ? 'רכב משפחתי' : 'family car';
  if (/שבעה מקומות|7\s*מקומות|7[- ]?seater|seven[- ]?seater/i.test(input)) return locale === 'he' ? 'רכב שבעה מקומות' : 'seven-seat car';
  if (/רכב\s+משפחתי|רכב\s+למשפחה|^\s*משפחתית\s*$|(?:רוצה|מחפש|צריך|מעדיף)\s+(?:רכב\s+)?משפחתית|(?:רוצה|מחפש|צריך|מעדיף)\s+משפחתי|family car/i.test(input)) return locale === 'he' ? 'רכב משפחתי' : 'family car';
  if (/קומפקטי|קומפקטית|רכב קטן|(?:^|[\s,.])(?:משהו|אחד)\s+קטן(?![\p{L}])|compact (?:rental )?car|small (?:rental )?car|\bsomething small\b|\ba small one\b|\bnothing fancy\b|\b(?:just )?(?:a )?basic (?:car|one)\b|משהו פשוט|רכב פשוט/iu.test(input) && !/(?:^|\s)(?:לא|בלי)\s+(?:משהו\s+)?קטן|\bnot (?:something )?small\b/iu.test(input)) return locale === 'he' ? 'רכב קומפקטי' : 'compact car';
  if (/רכב פנאי|ג[׳'י]?יפ(?:ון)?|suv/i.test(input)) return locale === 'he' ? 'רכב פנאי' : 'SUV';
  // A sedan request belongs to the family group; fit is still model-specific.
  if (/סדאן|סדן(?![\p{L}])|\bsedan\b/iu.test(input)) return locale === 'he' ? 'רכב משפחתי (סדאן)' : 'family car (sedan)';
  return null;
}

function customerVehicleChoice(input: string, state: RebuildState): string | null {
  if (/^(?:ו?מה אם|האם|אולי|למה|מה לגבי|what if|would|should|could)\s/iu.test(input)) return null;
  const vehicle = '(?:רכב\\s+)?(?:שבעה\\s+מקומות|7\\s*מקומות|משפחתית|משפחתי|קטן|קומפקטית|קומפקטי|פנאי|ג[׳\'י]?יפ(?:ון)?|compact(?:\\s+rental)?\\s+car|small(?:\\s+rental)?\\s+car|family\\s+car|suv|seven[- ]?seat(?:er)?)';
  const choice = new RegExp(`(?:רוצה|רוצים|צריך|צריכה|צריכים|מחפש|מחפשת|מעדיף|מעדיפה|אבחר|נבחר|בחרתי|בחרנו|בוחר|בוחרת|החלטתי על|החלטנו על|נלך על|אלך על|אקח|תעשה|תעשו|תשים|תשימו|תחליף ל|תחליפו ל|נעבור ל|עדיף|בעצם|want|need|prefer|choose|chose|looking for|would like|go with|make it|switch to|change (?:it )?to|actually)\\s+(?:(?:לשכור|להזמין|to rent|to book|an?)\\s+)?(${vehicle})`, 'giu');
  const matches = [...input.matchAll(choice)].filter(match => !/(?:לא|don'?t)\s*$/iu.test(input.slice(0, match.index)));
  const chosen = matches.at(-1)?.[1];
  if (chosen) return explicitVehicleNeed(chosen, state.locale);
  if (explicitBooking(input) && !/(?:לא רוצה|don't want|do not want)/iu.test(input)) { const need = explicitVehicleNeed(input, state.locale); if (need) return need; }
  // Accepting the one category the previous bot message recommended ("תשריין לי אחד", "יאללה נלך על זה",
  // "sounds good, book it") chooses that category, as a representative would understand it.
  if (!state.booking.vehicleNeed && !/[?؟]/u.test(input) && !/(?:לא רוצה|don't want|do not want)/iu.test(input)
    && (explicitBooking(input) || /(?:^|\s)(?:אחד כזה|כזה|את זה|על זה|נשמע טוב|מתאים לי|מתאים לנו|תשריינ?ו?|תזמינ?ו?|תסגור|סגור)(?![\p{L}])|\b(?:that one|that works|sounds good|i['’]?ll take (?:it|that|one)|book it|reserve (?:it|one))\b/iu.test(input))) {
    const previous = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
    const offered = [
      [/מכונית קטנה|רכב קטן|קומפקטי|small car|compact|economy/iu, state.locale === 'he' ? 'רכב קומפקטי' : 'compact car'],
      [/משפחתי|family car/iu, state.locale === 'he' ? 'רכב משפחתי' : 'family car'],
      [/רכב פנאי|ג[׳'י]?יפ|\bSUV\b/iu, state.locale === 'he' ? 'רכב פנאי' : 'SUV'],
      [/שבעה מקומות|7 מקומות|seven[- ]?seat/iu, state.locale === 'he' ? 'רכב שבעה מקומות' : 'seven-seat car'],
    ].filter(([pattern]) => (pattern as RegExp).test(previous));
    if (offered.length === 1) return offered[0][1] as string;
  }
  const statedPreference = input.match(new RegExp(`(${vehicle})\\s+(?:עדיף|עדיפה|מתאים\\s+לי|מתאים\\s+לנו|works better|is better for us)`, 'iu'))?.[1];
  if (statedPreference && !/[?؟]/u.test(input)) return explicitVehicleNeed(statedPreference, state.locale);
  // "משהו נוח לנסיעות ארוכות, סדאן נגיד" — a stated body type, not a question.
  if (!/[?؟]/u.test(input) && /(?:^|[\s,])(?:סדאן|סדן|sedan)(?:\s+(?:נגיד|בערך|אולי|maybe|I guess|probably))?\s*[.!]?\s*$/iu.test(input) && !/(?:לא|בלי|not|no)\s+(?:סדאן|סדן|sedan)/iu.test(input)) return explicitVehicleNeed('sedan', state.locale);
  // A short stated preference before a separate question ("nothing fancy. can i get an invoice?").
  const statedClause = input.split(/(?<=[.!,])\s+/u).find(part => !/[?؟]/u.test(part) && /^(?:משהו|רכב|something|nothing|just|a|an|רק)?\s*(?:קטן|פשוט|small|fancy|basic|compact|קומפקטי(?:ת)?|משפחתי(?:ת)?|family(?: car)?|suv|רכב פנאי|ג['׳י]?יפ|שבעה מקומות|7 מקומות|seven[- ]seat(?:er)?)(?:\s+(?:בבקשה|please))?[.!,]?$/iu.test(part.trim()));
  if (statedClause && statedClause.trim().length <= 30) {
    const clause = statedClause.trim().replace(/[.!,]+$/u, '').replace(/\s+(?:בבקשה|please)$/iu, '');
    const need = explicitVehicleNeed(/^משפחתי(?:ת)?$/u.test(clause) ? 'רכב משפחתי' : clause, state.locale);
    if (need) return need;
  }
  if (/[?؟]/u.test(input) || /(?:לא רוצה|לא מעדיף|don't want|do not want)/iu.test(input)) return null;
  const lastBot = state.history.at(-1)?.text ?? '';
  return state.phase === 'booking' && (state.step === 'rental_vehicle' || /איזה סוג רכב|what kind of car/i.test(lastBot) || input.trim().length <= 20)
    ? explicitVehicleNeed(input, state.locale) : null;
}

function driverAgeRange(input: string, state: RebuildState): '21-23' | '24-plus' | null {
  if (/(?:^|\D)21\s*[-–]\s*23(?:\D|$)/u.test(input)) return '21-23';
  if (/(?:^|\D)24\s*\+(?:\D|$)/u.test(input)) return '24-plus';
  const selfAge = input.match(/(?:^|[\s,])ו?אני\s+(?:(?:בן|בת)\s+)?(\d{2})(?!\d)|\b(?:I am|I'm)\s+(\d{2})(?!\d)|\b(?:I am|I['’]?m|im)\s+[\p{L}'-]{2,20}(?:\s+[\p{L}'-]{2,20})?,?\s+(?:aged\s+)?(\d{2})(?!\d)(?!\s*(?:days?|nights?|km|%|₪|nis))/iu);
  // "sarah cohen, 27" as its own clause: a name followed by the driver's age.
  // "sarah cohen, 27" / "יאללה, משה בדיקה 45": a two-word name followed by the driver's age, comma optional.
  const nameAge = input.trim().match(/(?:^|[.!]\s*|,\s*)[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}\s*,?\s*(?:בן|בת)?\s*(\d{2})\s*(?:,\s*[^\s,]+@[^\s,]+)?\s*[.!]?$/u)?.[1];
  const primaryAge = input.match(/(?:הנהג הראשי|הנהגת הראשית|main driver|primary driver)\s+(?:(?:בן|בת|is|aged)\s+)?(\d{2})(?!\d)/iu)?.[1]
    ?? input.match(/(?:ה)?נהג(?:ת)?\s+(?:ה)?ראשי(?:ת)?\s+(?:[\p{L}]+\s+){0,2}(?:בן|בת)\s*(\d{2})(?!\d)/u)?.[1];
  if (!selfAge && !primaryAge && !nameAge && !/(?:בן|בת|גיל|age|aged|\bI am\b|\bI'm\b)/i.test(input) && !(state.phase === 'booking' && state.step === 'rental_age')) return null;
  // Another person's age ("הוא בן 25", "my friend is 25") is not the main driver's age.
  const otherPersonAge = /(?:(?<![\p{L}])(?:הוא|היא|חבר(?:ה)?\s+שלי|אשתי|בעלי|אחי|אחותי|אבא שלי|אמא שלי|הבן שלי|הבת שלי|הנהג(?:ת)? הנוסף(?:ת)?|נהג(?:ת)? נוסף(?:ת)?)[^.!?\n]{0,25}(?:בן|בת)\s*\d{2})|\b(?:he|she|my (?:friend|wife|husband|partner|brother|sister|dad|mom|son|daughter)|the (?:other|second|additional) driver)(?:['’]s| is)?[^.!?\n]{0,15}\b\d{2}\b/iu.test(input);
  // "אחותי בת 25 תנהג" names the driver; "שגם חבר שלי ינהג" adds one.
  const otherIsTheDriver = /(?:תנהג|ינהג|נוהג|נוהגת|will (?:be )?driv|is (?:the )?driv)/iu.test(input) && !/(?:^|\s|ש)גם(?:\s|$)|נוסף|נוספת|\balso\b|\btoo\b|additional|second driver/iu.test(input);
  // A parent booking for a child ("בשביל הבת שלי", "for my son"): that person is the renter.
  const bookingForOther = [input, ...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text)]
    .some(text => /(?:בשביל|עבור|ל)\s*(?:ה)?(?:בת|בן|הבת|הבן|אמא|אבא|אח|אחות|אשתי|בעלי)\s*(?:שלי|שלנו)?|\bfor my (?:daughter|son|mom|mum|mother|dad|father|wife|husband|brother|sister)\b/iu.test(text))
    && !/(?:^|\s|ש)גם(?:\s|$)|נוסף|נוספת|\balso\b|\btoo\b|additional|second driver/iu.test(input);
  if (otherPersonAge && !otherIsTheDriver && !bookingForOther && !selfAge && !primaryAge && !nameAge) return null;
  const age = primaryAge ?? nameAge ?? selfAge?.[1] ?? selfAge?.[2] ?? selfAge?.[3] ?? input.match(/(?:בן|בת|גיל|age(?:d)?(?: is)?|\bI am|\bI'm)\s*(\d{2})(?!\d)/i)?.[1]
    ?? (state.phase === 'booking' && state.step === 'rental_age' ? input.trim().match(/^(\d{2})$/)?.[1] : undefined);
  if (!age) return null;
  const value = Number(age);
  return value >= 21 && value <= 23 ? '21-23' : value >= 24 && value <= 99 ? '24-plus' : null;
}

function withoutCoverageQuestionHazards(input: string): string {
  // Mask only a policy-question clause, never an affirmative incident beside it.
  // Keeping clause boundaries means “does insurance cover accidents? I crashed”
  // still takes the fixed safety path, regardless of the policy wording.
  return input.split(/([.!?;\n]|\bbut\b|אבל|אך)/iu).map(clause => {
    const asksCoverage = /\b(?:cover(?:age)?|insurance|excess)\b|ביטוח|כיסוי|השתתפות עצמית/iu.test(clause)
      && /\b(?:does|do|is|are|can|what|which|include|includes|cover)\b|האם|כולל|מכסה|מכסים|מה|אפשר/iu.test(clause);
    const currentIncident = /\b(?:crashed|collided|hit|struck|injured|hurt)\b|\b(?:I|we|there|my (?:rental )?car|our (?:rental )?car|the (?:rental )?car)\s+(?:have|had|was|were|is|has|just had|just been)\b.{0,45}\b(?:accident|collision|crash|damage|damaged|dent|scratch)\b|\b(?:after|following)\s+(?:the|my|our|an)\s+(?:accident|collision|crash)\b|\b(?:accident|collision|crash)\s+(?:just\s+)?(?:happened|occurred)\b|עברתי|עברנו|התנגשתי|התנגשנו|פגעתי|נפגעתי|פצוע|(?:הייתה|היתה|קרתה|אירעה|עשיתי|עשינו)\s+(?:לי\s+)?תאונה|(?:אחרי|בעקבות)\s+(?:ה?תאונה|התנגשות)|(?:הרכב|רכב שכור).{0,25}(?:נפגע|ניזוק|נשרט|קיבל מכה)/iu.test(clause);
    return asksCoverage && !currentIncident
      ? clause.replace(/\b(?:accidents?|crash(?:es)?|collisions?)(?:[- ]damage)?\b|נזקי? תאונות|נזקי? תאונה|תאונות|תאונה|התנגשות/giu, 'covered event')
      : clause;
  }).join('');
}

function safety(input: string): 'accident' | 'breakdown' | null {
  if (/מה (?:קורה|יקרה|עושים)?\s*אם|אם (?:תהיה|יקרה|אעשה|הרכב ייתקע)|במקרה של|hypothetical|what if|if (?:I have|the car breaks down)/i.test(input)) return null;
  if (/(?:יש לכם שירות|האם אתם מציעים שירות|do you offer|do you have).{0,30}(?:פנצ|גרר|flat tire|tow)/i.test(input)) return null;
  if (/הרכב שלי.{0,35}(?:במוסך|אחרי תאונה)|my own car.{0,35}(?:accident|crash)/i.test(input) && /לשכור|להשכיר|רכב חלופי|rent|replacement car/i.test(input)) return null;
  // A tyre mention may be a hypothetical question, negation, or the reason
  // someone needs a replacement for their own car. Only an affirmative report
  // should enter the immediate rental-roadside flow. Examine clauses so a
  // negated mention does not hide a later affirmative correction.
  const tyreReport = input.split(/[.!?;]|\bbut\b/i).some(clause =>
    /\b(?:flat tyre|puncture)\b/i.test(clause)
    && !/\bin case of\b|\bif (?:i|we|the car|our car) (?:get|gets|have|has|develop)|\b(?:do you offer|do you have)\b/i.test(clause)
    && !/\b(?:(?:do not|don['’]?t|does not|doesn['’]?t|never) have\s+(?:a\s+)?|(?:no|not|without|isn['’]?t|aren['’]?t)\s+(?:a\s+)?)(?:flat tyre|puncture)\b/i.test(clause)
    && !/\b(?:my|our) own (?:car|vehicle)\b/i.test(clause));
  if (tyreReport) return 'breakdown';
  const noInjuries = /אין נפגעים|לא (?:היו )?נפגעים|אף אחד לא נפגע|no injuries|nobody was injured|no one was injured/i.test(input);
  // A vehicle-history check is not a report of an incident. Remove only the
  // historical phrase, so a separate current collision/damage report survives.
  const incidentInput = withoutCoverageQuestionHazards(input)
    .replace(/\b(?:accident|crash|collision|damage)\s+(?:history|records?)\b|\bhistory\s+of\s+(?:(?:past|previous|prior)\s+)?(?:accidents?|crashes|collisions?|damage)\b|\b(?:past|previous|prior)\s+(?:accidents?|crashes|collisions?)(?:\s+damage)?\b/gi, 'vehicle history')
    .replace(/היסטורי(?:ית|ה של)\s+(?:ה?תאונות|התנגשויות|נזקים)|עבר\s+תאונתי|תאונות\s+(?:ה?עבר|קודמות)|נזקי\s+תאונות\s+(?:ה?עבר|קודמות)/gu, 'עבר הרכב');
  if (reportedRentalDamage(incidentInput)) return 'accident';
  // Customers describe a collision without the word accident: someone drove
  // into them, a bumper is crushed. Treat an affirmative report as an incident.
  if (/(?<!לא )(?:נכנס(?:ה|ו)?|התנגש(?:ה|ו)?) ב(?:י|נו)(?=[\s,.!?]|$)|(?<!לא )התנגש(?:ה|ו)? ב(?:רכב|אוטו) (?:שלי|שלנו|שלכם)|(?<!לא )(?:דפק(?:ה|ו)?|עשו לי) (?:לי |אותי |את הרכב )?(?:תאונה|מכה|מאחורה|מאחור)|פגוש.{0,20}(?:מעוך|נמעך|נשבר|התעקם|נכנס)|\brear[- ]?ended\b|\b(?:backed|crashed|drove|ran|bumped|reversed|slammed) into (?:me|us|my car|our car|the car|my rental|the rental)\b|\b(?:someone|somebody|some (?:guy|woman|man|driver)|a car|a truck|a bus|he|she|they|another (?:car|driver))\s+(?:just\s+)?(?:hit|smashed|scraped|clipped)\s+(?:me|us|my car|our car|the car)\b|\bbumper\b.{0,20}\b(?:crushed|smashed|caved in)\b/iu.test(incidentInput)) return 'accident';
  if (/תאונה|התנגשות|פצוע|accident|crash|collision/i.test(incidentInput) || !noInjuries && /(?<!לא )נפגע|(?<!not )injured/i.test(incidentInput)) return 'accident';
  if (/פנצ[׳']?ר|נתקעתי|לא (?:מניע|מתניע|התניע|נדלק)|רעש.{0,25}בלמ|בלמ.{0,25}רעש|עשן|תקלה ברכב|flat tire|breakdown|won'?t start|brake.{0,25}(?:noise|problem)|(?:noise|problem).{0,25}brake|(?:אני צריך|אני זקוק|תשלחו|שולחים).{0,25}גרר|גרר.{0,15}(?:עכשיו|דחוף)|\b(?:need|send)\b.{0,25}\btow\b|\btow\b.{0,15}\b(?:now|urgent)\b/i.test(input)) return 'breakdown';
  return null;
}

function reportedRentalDamage(input: string): boolean {
  return /(?:רכב(?:י|נו)? השכור|הרכב השכור|רכב ששכרתי|שכרתי (?:את )?הרכב|הרכב שלכם|(?:my|the|our) rental(?: car)?\b|car (?:i|we) rented|your car)/i.test(input)
    && /שרט|שריט|שפשוף|נזק|מכה(?:\s+(?:בדלת|בחניה|ברכב))?|פגיעה|מעוך|נמעך|פגוש|\b(?:scratch(?:ed|es)?|scrap(?:e|ed)|dent(?:ed|s)?|damage(?:d)?|bumper)\b/i.test(input);
}

function commercialReply(input: string, state: RebuildState): { reply: string; escalate: boolean } {
  if (declinesHumanHandoff(input)) state.humanHandoffDeferred = true;
  const result = commercialReplyContent(input, state);
  const asksCommitment = /(?:מחייב|מחויב|התחייב|התחייבות).{0,35}(?:לקנות|לעסקה|עסקה|משהו)|לא התחייבתי|(?:commit|obligat|binding).{0,50}(?:buy|purchase|deal|anything)|(?:buy|purchase|deal).{0,35}(?:commit|obligat|binding)/i.test(input);
  if (asksCommitment && !/ללא התחייבות|אין התחייבות|אינה מחייבת|no commitment|not.*(?:commit|binding|obligat)/i.test(result.reply)) {
    result.reply += state.locale === 'he'
      ? ' מסירת פרטים והתלבטות כאן אינן מחייבות לרכישה או לעסקה; התנאים יוצגו לפני החלטה.'
      : ' Sharing details and discussing options here does not commit you to a purchase or deal; the terms are presented before you decide.';
  }
  if (result.escalate && /תעביר|תחזרו אלי|שיחזרו אלי|pass.{0,40}(?:team|representative)|call (?:me|us) back/i.test(input)
    && !declinesHumanHandoff(input)) {
    state.humanHandoffDeferred = false;
    return result;
  }
  if (!state.humanHandoffDeferred) return result;
  // A previous refusal remains in effect while the customer keeps advising or
  // updating details. Explicit later human requests are handled by the caller.
  const reply = result.reply
    .replace(/(?:^|(?<=[.!?])\s+)(?:תרצ(?:ה|ו)|Would you like)[^?]*(?:נציג|שאעביר|representative|pass on|pass the|team)[^?]*\?\s*/gi, ' ')
    .trim();
  return { reply, escalate: false };
}

function commercialReplyContent(input: string, state: RebuildState): { reply: string; escalate: boolean } {
  const he = state.locale === 'he';
  const previous = renderCommercialMemory(state.commercial, state.locale);
  const context = `${previous} ${input}`;
  const hasKnownTerm = state.commercial?.termMonths != null;
  const hasKnownMileage = state.commercial?.annualMileageKm != null;
  const hasKnownVehicle = state.commercial?.vehiclePreference != null || Boolean(state.commercial?.vehicleModel);
  if (/מה.{0,35}(?:זוכר|שמורים|רשמת|שמרת)|(?:what|which).{0,45}(?:remember|recorded|saved|details do you have)/i.test(input)) {
    const commitment = /התחייב|מחויב|commit|binding|obligat/i.test(input)
      ? (he ? ' זו שיחת בירור ללא התחייבות לעסקה.' : ' This is an enquiry with no commitment to a deal.') : '';
    return { reply: `${previous}${commitment}`, escalate: false };
  }
  if (state.interest === 'leasing' && /הצעה|\b(?:offer|quote)\b/i.test(input)
    && /accept|oblig|commit|מחייב|חייב|להסכים|התחייב/i.test(input)
    && /[?؟]|whether|האם|צריך|מחייב/i.test(input)) return { reply: he
    ? 'בקשה להצעה היא לצורך בדיקה והשוואה; היא אינה אישור לעסקה ואינה מחייבת לקבל את ההצעה מיד. לפני החלטה אפשר להשוות את העלות הכוללת, התשלום הראשוני והסופי אם יש, הקילומטראז׳, מה כלול ותנאי היציאה. בדקו גם את תוקף ההצעה ואת התנאים הכתובים לפני קבלתה.'
    : 'Requesting an offer is for review and comparison; it does not accept a deal or require you to accept the offer immediately. Before deciding, compare the total cost, any initial and final payments, mileage, inclusions and early-exit terms. Also check the offer validity period and written terms before accepting it.', escalate: false };
  const lastBot = [...state.history].reverse().find(item => item.from === 'bot')?.text ?? '';
  const comparesSizes = /קטן|קומפקט|small|compact/i.test(input) && /משפחת|family/i.test(input)
    && /הבדל|מול|עדיף|לעומת|יותר|better|versus|\bor\b|compare|difference/i.test(input);
  const gearAlreadyStated = Boolean(state.commercial?.luggage) || [input, ...state.history.filter(item => item.from === 'customer').map(item => item.text)]
    .some(message => /עגלה|מזווד|תיקי נסיעה|stroller|pushchair|suitcases?|bags?/i.test(message));
  const gearFollowup = gearAlreadyStated
    ? (he ? ' נבדוק בדגם המסוים גם מקום לציוד שכבר ציינתם.' : ' We will also check space in the specific car for the luggage you already mentioned.')
    : (he ? ' איזה ציוד אתם לוקחים כשכולכם נוסעים יחד?' : ' What luggage do you take when everyone travels together?');
  if (comparesSizes && !(state.interest === 'leasing' && /\b24\b/.test(input) && /\b36\b/.test(input))) return { reply: he
    ? `רכב קומפקטי נותן יתרון בגודל ובחניה בנסיעות לבד בעיר. משפחתית מציעה בדרך כלל יותר מקום לנוסעים ולציוד; למשפחה של ארבעה כדאי להשוות את מרחב המושבים ותא המטען בדגמים המסוימים, גם אם רוב השבוע נוסעים לבד.${gearFollowup}`
    : `A compact has a size and parking advantage for solo city trips. A family car generally offers more passenger and luggage room; for four people, compare seating and boot space in the actual models even if most weekday trips are solo.${gearFollowup}`, escalate: false };
  // Only an actual handoff invitation can turn a short yes into consent.
  // Asking for a quote or having no vehicle preference continues the advice.
  const handoffOffered = /תרצ(?:ה|ו).{0,30}(?:שאעביר|שנציג|שנחזור אליכם|שיחזרו אליכם|שנעביר)|would you like.{0,35}(?:pass|representative|(?:us|someone) to (?:get back|contact|call))/i.test(lastBot);
  // Answering "shall a representative get back to you?" with a name and phone number is a yes.
  const acceptsTeamCheck = handoffOffered && ((affirms(input) || /(?:\+?972[\s-]?|0)5\d(?:[\s-]?\d){7}|\[phone removed\]|תתקשרו|תחזרו אלי|call me/iu.test(input) || /^(?:כן[, ]+תתקדמו עם הצעה|(?:כן|אוקיי|סבבה|יאללה|sure|yes|yeah|ok|okay)?[, ]*(?:תעביר|תעבירו|תעבירי|העבר|אפשר להעביר|pass (?:it|them) on|please pass (?:it|them) on|go ahead|please do))(?:[.!,]|\s|$)/iu.test(input.trim())) && !/(?:^|\s)(?:לא|עדיין לא|רגע)(?:\s|$)|\b(?:don['’]?t|not yet|wait|hold on)\b/iu.test(input));
  const asksTeamReview = !declinesHumanHandoff(input) && /תעביר(?:ו)?\s+(?:את זה|את הפרטים|את הבקשה|את הפנייה|לצוות|לנציג|להצעה)|שהצוות יבדוק|שיבדקו בשבילי|שהצוות יחזור אלי|שיחזרו אלי|תחזרו אלי|(?:have|ask) the team (?:check|review)|(?:pass|send) (?:this|it|the details|(?:my|the|this) (?:enquiry|inquiry|request|details)) to (?:a |the )?(?:team|representative)|(?:team|someone).{0,15}call me back/i.test(input);
  const asksQuote = /אפשר לקבל הצעה|תכינו (?:לי )?הצעה|אשמח להצעה|(?:can|could) I get (?:a |an )?(?:quote|offer)|please (?:send|prepare) (?:a |an )?(?:quote|offer)/i.test(input);
  if (!declinesHumanHandoff(input) && (asksTeamReview || acceptsTeamCheck || /pass (?:this|it|the details) to a representative/i.test(input))) return { reply: he ? `בשמחה, נציג SmartCar יחזור אליכם לגבי ${state.interest === 'leasing' ? 'הליסינג' : 'רכישת הרכב'} לפי הפרטים שמסרתם. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Of course. A SmartCar representative will follow up about your ${state.interest === 'leasing' ? 'leasing' : 'car purchase'} enquiry using the details you shared. You can also call ${OFFICE_PHONE}.`, escalate: true };
  if (asksQuote && !asksTeamReview) {
    if (state.interest === 'leasing') {
      const missing = !hasKnownTerm ? (he ? 'לכמה זמן תרצו את הרכב?' : 'What term do you have in mind?')
        : !hasKnownMileage ? (he ? 'כמה קילומטרים בערך תיסעו בשנה? אפשר גם לומר אם עדיין אין הערכה.' : 'Roughly how many kilometres will you drive each year? It is fine if you do not know yet.')
        : (he ? 'מה חשוב לכם יותר ברכב — גודל לחניה בעיר, מקום למשפחה או מקום לציוד?' : 'What matters most in the car: a smaller size for city parking, family space or luggage space?');
      return { reply: `${he ? 'אפשר להכין בקשה להצעת ליסינג לפי הצרכים שלכם; המחיר והתנאים יפורטו לפני התחייבות.' : 'We can prepare a leasing quote request around your needs; the price and terms will be set out before any commitment.'} ${missing}`, escalate: false };
    }
    return { reply: he ? 'בשמחה. נוכל למקד בקשה להצעה לפי הצרכים והתקציב, והמחיר ייקבע לפי רכב מסוים. מה השימוש העיקרי ברכב וכמה אנשים נוסעים בדרך כלל?' : 'Of course. We can narrow down a quote request by your needs and budget, with the price confirmed for a specific car. How will you mainly use it and how many people usually travel?', escalate: false };
  }
  const asksNextStep = /מה (?:צריך|הצעד הבא|השלב הבא|תצטרכו).{0,25}(?:להתקדם|הלאה|הצעה)?|איך (?:מתקדמים|ממשיכים)|what.*(?:need|next step|proceed)|how.*(?:proceed|continue)/i.test(input);
  if (state.interest === 'leasing') {
    const knownVehiclePreference = hasKnownVehicle;
    const comparesTerms = /\b24\b/.test(input) && /\b36\b/.test(input)
      && /הבדל|להשוות|מול|לעומת|או|compare|difference|versus|\bvs\b|\bor\b|between/i.test(input);
    if (comparesTerms) return { reply: he
      ? '24 חודשים הם התחייבות קצרה יותר מ־36 חודשים; אי אפשר לדעת איזו אפשרות משתלמת יותר בלי להשוות הצעות לאותו רכב וקילומטראז׳. השוו את העלות הכוללת — תשלום ראשוני, תשלומים חודשיים ותשלום סיום אם יש — ואת תנאי היציאה המוקדמת. בדקו גם מה כלול בטיפולים, בביטוח ובמגבלת הקילומטרים ומה עלות החריגה; הכול נקבע בהצעה ובחוזה.'
      : '24 months means a shorter commitment than 36 months. Compare offers for the same car and annual mileage before deciding which costs less. Check the total cost: any initial payment, monthly payments and final payment, plus early-exit terms. Also check whether maintenance and insurance are included, the mileage allowance and excess-mileage charges; these depend on the specific offer and contract.', escalate: false };
    if (/הבדל|difference|compare/i.test(input) && /השכרה|לשכור|rent/i.test(input)) return { reply: he ? 'השכרה חודשית מאפשרת לבדוק צורך לתקופה קצרה יותר; ליסינג הוא מסלול לתקופה ארוכה יותר. בשניהם ההתחייבות והוצאות השימוש נקבעות בהצעה ובחוזה. כדאי להשוות עלות כוללת, קילומטראז׳, מה כלול בביטוח ובטיפולים ותנאי שינוי או יציאה מוקדמת; אין להניח שהכול כלול או שהיציאה ללא עלות.' : 'Monthly rental can suit a shorter-term need, while leasing is a longer plan. For both, the commitment and running costs are set in the offer and contract. Compare total cost, mileage, insurance and maintenance inclusions, and change or early-exit terms; do not assume everything is included or that exit is free.', escalate: false };
    if (/התחייבתי|מחויב|מחויבת|התחייבות|(?:am|have) I.{0,25}committ|(?:not|already).{0,25}committ|signed.{0,15}(?:anything|deal|contract)/i.test(input)) return { reply: he
      ? 'זו עדיין שיחת בירור, ללא התחייבות לעסקה. ההעדפות והעדכונים שמסרתם נשארים בשיחה, כולל העדפת הרכב אם ציינתם אותה. המחיר, התקופה, הקילומטראז׳ ומה שכלול יוצגו בהצעה לפני כל החלטה.'
      : 'This is still an enquiry, with no commitment to a deal. Your preferences and latest updates remain in the conversation, including the vehicle preference you shared. The price, term, mileage and inclusions will be set out in an offer before any decision.', escalate: false };
    if (/תחזוקה|טיפולים|עלות ה?כוללת|מה.{0,25}לבדוק.{0,25}(?:תשלום|חודשי)|maintenance|servicing|total cost|what.{0,45}check.{0,35}(?:monthly|payment)/i.test(input)) return { reply: he
      ? 'לפני החלטה, בדקו בהצעה את העלות הכוללת, תשלום ראשוני או סופי, מגבלת הקילומטרים ועלות החריגה ותנאי יציאה מוקדמת. בקשו פירוט אילו טיפולים, תיקונים וביטוחים כלולים ומה מוחרג; אין להניח שתחזוקה כלולה בלי שהדבר נכתב בהצעה ובחוזה.'
      : 'Before deciding, check the total cost, any initial or final payment, mileage allowance and excess charges, and early-exit terms. Ask which maintenance, repairs and insurance are included and what is excluded. Do not assume maintenance is included unless the offer and contract state it.', escalate: false };
    if (/איך (?:אני )?מקבל(?:ת)? הצעה|איך (?:אפשר|מקבלים) לקבל הצעה|how (?:do|can) I get (?:a |an )?(?:quote|offer)/i.test(input)) {
      const hasTerm = hasKnownTerm;
      const hasMileage = hasKnownMileage;
      const hasVehicle = knownVehiclePreference;
      return { reply: hasTerm && hasMileage && hasVehicle
        ? (he ? 'כדי לקבל הצעת ליסינג, אפשר להעביר לנציג SmartCar את התקופה, הקילומטראז׳ והעדפת הרכב שכבר מסרת. הוא יחזור אליך עם פירוט התשלום והתנאים. תרצה שאעביר את הפרטים?' : 'To get a leasing offer, I can pass the term, mileage and vehicle preference you gave to a SmartCar representative. They will follow up with the payment and terms. Would you like me to pass on the details?')
        : (he ? `כדי לקבל הצעת ליסינג נצטרך ${[!hasTerm && 'משך תקופה', !hasMileage && 'הערכת קילומטראז׳ לשנה', !hasVehicle && 'העדפת סוג רכב'].filter(Boolean).join(' ו')}. אפשר גם לומר אם אין עדיין העדפה; אחרי שנרשום את הפרטים נציג SmartCar יחזור אליכם עם הצעה.` : `To prepare a leasing offer, please share ${[!hasTerm && 'your preferred term', !hasMileage && 'estimated annual mileage', !hasVehicle && 'a vehicle preference'].filter(Boolean).join(' and ')}. If you have no preference yet, just say so; a SmartCar representative can then follow up with an offer.`), escalate: false };
    }
    if (/הבדל|difference|compare/i.test(input) && /פרטי|עסקי|\b(?:private|business)\b/i.test(input)) return { reply: he ? 'ליסינג פרטי מיועד לשימוש אישי, ועסקי לצורכי העסק. ההתחייבויות, השירותים והמחיר נקבעים רק בהצעה ובחוזה של המסלול המתאים. תרצה לבדוק מסלול פרטי או עסקי?' : 'Private leasing serves personal use; business leasing serves a company. Commitments, services and price are set in the specific offer and contract. Which route would you like us to check?', escalate: false };
    if (/לא יודע איזה סוג רכב|לא יודעת איזה סוג רכב|אין לי העדפה|אין העדפה|לא משנה|not sure (?:which|what) (?:car|vehicle)|no (?:vehicle )?preference/i.test(input)) return { reply: he ? 'אין צורך לבחור דגם עכשיו. אם תספר לי אם השימוש בעיקר עירוני, משפחתי או לנסיעות ארוכות, אוכל להציע קבוצה להתחיל ממנה. מה הכי חשוב לכם ברכב?' : 'You do not need to pick a model now. Tell me whether the driving is mainly urban, family trips or longer journeys and I can suggest a starting group. What matters most to you in the car?', escalate: false };
    if (/מה (?:אתה ממליץ|את ממליצה|היית ממליץ|תציע)|what.{0,50}(?:recommend|suggest)|which.{0,40}(?:recommend|suggest)/i.test(input)) {
      const cityUse = /עיר|חניה|city|urban|parking/i.test(context);
      const soloOrCouple = /לבד|זוג|alone|solo|partner|two of us/i.test(context);
      return { reply: cityUse && soloOrCouple
        ? (he ? 'לנסיעות בעיר לבד או בזוג, הייתי מתחיל בהשוואת רכב קומפקטי בגלל הגודל והחניה. אם חשוב לכם יותר מקום לנוסעים או לציוד, נשווה גם משפחתית; ההתאמה תלויה בדגם המסוים. כמה ציוד אתם נושאים בדרך כלל?' : 'For city driving alone or as a couple, I would start by comparing a compact because of its size and parking. If passenger or luggage space matters more, we can compare a family car; suitability depends on the specific model. How much luggage do you usually carry?')
        : (he ? 'אפשר להשוות קומפקטית לשימוש עירוני מול משפחתית אם חשוב יותר מקום. כדי למקד את ההמלצה, כמה אנשים וציוד נוסעים בדרך כלל?' : 'We can compare a compact for urban driving with a family car if more space matters. To narrow down the recommendation, how many people and bags usually travel?'), escalate: false };
    }
    if (/מה כלול|מה כולל|מה מקבלים|what(?:'s| is) included|what does it include/i.test(input)) {
      const alreadyAnswered = state.history.some(item => item.from === 'bot' && /מה שכלול בליסינג|what is included depends/i.test(item.text));
      return { reply: alreadyAnswered
        ? (he ? 'בהצעה האישית נפרט את התשלום, הביטוח, השירותים ומגבלת הקילומטרים. מה כלול בפועל נקבע לפי המסלול והרכב שייבחרו.' : 'The personal proposal will set out payment, cover, services and mileage. What is included depends on the chosen plan and car.')
        : (he ? 'מה שכלול בליסינג תלוי במסלול ובהצעה האישית, למשל שירותים, ביטוח ומגבלת קילומטרים. נציג SmartCar יפרט את התנאים בהצעה לפני החלטה. תרצה שנכין הצעה לפי הפרטים שכבר מסרת?' : 'What is included depends on the plan and personal offer, including services, insurance and mileage. A SmartCar representative will set out the terms before you decide. Would you like an offer using the details you gave?'), escalate: false };
    }
    if (/תשלום ראשוני|מקדמה|דמי פתיחה|initial payment|down payment|deposit/i.test(input)) return { reply: he ? 'תשלום ראשוני, אם נדרש, יופיע בהצעה של המסלול והרכב שתבחרו. נשמח לצרף את השאלה להצעה האישית כדי שתקבלו פירוט ברור.' : 'Any initial payment will be stated in the offer for your chosen plan and car. We can include this question so the proposal clearly sets out the terms.', escalate: false };
    if (/מחיר|חודשי|תשלום|כמה|price|monthly|cost/i.test(input)) return { reply: he ? 'התשלום החודשי תלוי במסלול, בסוג הרכב, בתקופה ובקילומטראז׳. נשמח להכין לכם הצעה אישית לפי הפרטים שכבר מסרתם.' : 'The monthly payment depends on the plan, vehicle, term and mileage. We will be happy to prepare a personal offer using the details you have given.', escalate: false };
    if (asksNextStep) {
      if (!hasKnownTerm) return { reply: he ? 'כדי להתקדם להצעת ליסינג, נתחיל במשך התקופה הרצוי. לכמה זמן תצטרכו את הרכב?' : 'To prepare a leasing proposal, let us start with the term. How long do you need the car?', escalate: false };
      if (!hasKnownMileage) return { reply: he ? 'משך התקופה כבר רשום. כדי להכין הצעה מדויקת נצטרך גם הערכת קילומטראז׳ לשנה והעדפת רכב; אם עדיין אין הערכה אפשר לציין זאת לנציג.' : 'I have the term. A proposal also needs an annual mileage estimate and vehicle preference; if you are unsure, we can note that for a representative.', escalate: false };
      if (!knownVehiclePreference) return { reply: he ? 'כדי להתקדם להצעה יש לי כבר את התקופה והקילומטראז׳. השלב הבא הוא לבחור איזה סוג רכב תרצו בהצעה; אם עדיין אין העדפה אוכל להעביר את הפרטים לנציג שיעזור לבחור.' : 'I have your term and mileage. The next step is to choose a vehicle type for the proposal; if you have no preference, I can pass the details to a representative to help you choose.', escalate: false };
      return { reply: he ? 'יש לי את משך התקופה, הקילומטראז׳ וסוג הרכב שציינת. תרצה שאעביר אותם לנציג להכנת הצעה מפורטת?' : 'I have your term, mileage and vehicle type. Would you like me to pass them to a representative for a detailed offer?', escalate: false };
    }
    if (acceptsTeamCheck || asksTeamReview) return { reply: he ? `תודה, קיבלנו את הפרטים להצעת ליסינג אישית. נציג SmartCar יחזור אליכם להמשך; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Thank you. We have your details for a personal leasing offer. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`, escalate: true };
    if (!hasKnownTerm) return { reply: he ? 'ב־SmartCar אפשר לבדוק ליסינג פרטי או עסקי. לכמה זמן תרצה את הרכב?' : 'SmartCar can check private or business leasing. What term do you have in mind?', escalate: false };
    if (!hasKnownMileage) return { reply: he ? 'רשמתי את משך הליסינג. כמה קילומטרים בערך תיסעו בשנה?' : 'I have the term. Roughly how many kilometres would you drive each year?', escalate: false };
    if (!knownVehiclePreference) return { reply: he ? 'רשמתי את התקופה ואת הקילומטראז׳ שציינת. איזה סוג רכב תרצו בהצעה האישית?' : 'I have the term and mileage you mentioned. What vehicle type would you like in your personal offer?', escalate: false };
    return { reply: he ? 'יש לנו את התקופה, הקילומטראז׳ וסוג הרכב שביקשתם. תרצו שנציג SmartCar יחזור אליכם עם הצעת ליסינג?' : 'We have the term, mileage and vehicle type you requested. Would you like a SmartCar representative to follow up with a leasing offer?', escalate: false };
  }
  const hasType = hasKnownVehicle;
  const hasBudget = state.commercial?.budget !== undefined;
  if (/היסטורי|עבר תאונתי|בדיקה עצמאית|לבדוק את הרכב עצמאית|service history|accident (?:history|records?)|independent inspection/i.test(input)) return { reply: he
    ? 'לפני החלטה על רכב מסוים אפשר לבקש את היסטוריית הטיפולים והתאונות ולברר אפשרות לבדיקה עצמאית. צריך לבדוק אילו מסמכים קיימים ומה תנאי הבדיקה עבור אותו רכב; אין כאן אישור למצב הרכב או לתיאום בדיקה.'
    : 'Before deciding on a specific car, you can ask for its service and accident history and discuss an independent inspection. Available records and inspection arrangements need checking for that car; this is not a vehicle condition report or a confirmed appointment.', escalate: false };
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
  if (/אפשר(?:ות)? לראות (?:אותו|את הרכב|רכב)|אפשר לבוא לראות|(?:can|could|may) I (?:see|view) (?:it|(?:the|a|an) car)|can I come (?:see|view)|I would like to (?:see|view) (?:the|a|an) car/i.test(input)) return { reply: he ? 'בשמחה. כשנמצא רכב מסוים שמתאים לך, אפשר לתאם צפייה ונסיעת מבחן בכפוף לזמינות. תרצה שנציג יחזור אליך עם אפשרויות?' : 'Of course. Once we find a specific car that suits you, we can arrange a viewing and test drive subject to availability. Would you like a representative to follow up with options?', escalate: false };
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
  if (!hasType) return { reply: hasBudget
    ? (he ? 'רשמתי את התקציב שציינת. עדיין לא בחרנו סוג רכב, וזה בסדר; נציג SmartCar יוכל לבדוק אפשרויות לפי השימוש שלכם ולחזור עם פרטים ומחירים. תרצה שאעביר את הפנייה?' : 'I have your budget. You have not chosen a vehicle type yet, and that is fine; a SmartCar representative can check options for your needs and follow up with details and prices. Would you like me to pass on the enquiry?')
    : (he ? 'איזה סוג רכב תרצה לקנות?' : 'What kind of car would you like to buy?'), escalate: false };
  if (!hasBudget) return { reply: he ? 'איזה תקציב תרצה שנבדוק?' : 'What budget should we check?', escalate: false };
  return { reply: he ? lowMileage ? 'רשמתי את סוג הרכב, התקציב וההעדפה לקילומטראז׳ נמוך. תרצה שנציג SmartCar יחזור עם אפשרויות מתאימות?' : 'רשמתי את סוג הרכב והתקציב שציינתם. יש שנתון או קילומטראז׳ שחשובים לכם, או שתרצו שנציג SmartCar יחזור אליכם עם אפשרויות?' : lowMileage ? 'I have your vehicle type, budget and low-mileage preference. Would you like a SmartCar representative to follow up with matching options?' : 'I have the vehicle type and budget you mentioned. Do you have a preferred year or mileage, or would you like a SmartCar representative to follow up with options?', escalate: false };
}

export function isRebuiltSafetyMessage(input: string): boolean { return safety(input) !== null; }

function hasVehicleContext(draft: BookingDraft, input: string): boolean {
  return Boolean(draft.vehicleNeed || draft.passengers || draft.luggage || draft.childSeats || explicitVehicleNeed(input, 'he')
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
  if (/אפשר להוסיף כיסא בטיחות|can (?:i|we) (?:add|request|include) (?:a )?child seat/i.test(input)) return he
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
    ? `מעולה, רשמתי את התאריכים. ${state.booking.pickupLocation ? question('returnLocation', 'he') : question('pickupLocation', 'he')}`
    : `Great, I have the dates. ${state.booking.pickupLocation ? question('returnLocation', 'en') : question('pickupLocation', 'en')}`;
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
  const lead = he ? ({ compact: 'רכב קומפקטי של SmartCar יכול להתאים לנסיעה שלכם', family: 'רכב משפחתי של SmartCar יכול להתאים לנסיעה שלכם', suv: 'רכב פנאי של SmartCar יכול להתאים לנסיעה שלכם', seven_seat: 'רכב שבעה מקומות של SmartCar יכול להתאים לנסיעה שלכם', none: 'נשמח לעזור לכם לבחור רכב מתאים ב־SmartCar' } as const)[group]
    : ({ compact: 'I would start with a SmartCar compact', family: 'I would start with a SmartCar family car', suv: 'A SmartCar SUV is a direction to check', seven_seat: 'I would check a SmartCar seven-seater', none: 'We can choose a SmartCar car around your trip' } as const)[group];
  const benefit = he ? topic === 'child' ? 'נוכל לבחור יחד דגם עם מקום לנוסעים ולציוד, ולוודא שכיסא הבטיחות מתאים לו.' : topic === 'city' ? 'רכב שיעמוד לרשותכם בין היעדים נותן גמישות לאורך היום.' : ''
    : topic === 'child' ? 'It is a good starting point for passenger and luggage space; the child seat must be checked against the actual car.' : topic === 'city' ? 'Having the car at your disposal gives flexibility between stops during the day.' : '';
  const next = !state.booking.pickupDate ? (datesUndecided ? waitForDates : he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?')
    : !state.booking.returnDate ? question('returnDate', state.locale)
    : !state.booking.pickupLocation ? question('pickupLocation', state.locale)
    : !state.booking.returnLocation ? question('returnLocation', state.locale)
    : (he ? 'תרצו שנתחיל בקשה לבדיקה עם הפרטים שכבר מסרתם?' : 'Would you like to start a request for review with the details you already gave?');
  const price = PRICE_OR_AVAILABILITY.test(input) ? `${priceAnswer(state.locale)} ` : '';
  // No car direction to talk about: say back what we understood instead of a generic sales line.
  if (group === 'none' && topic === 'trip') {
    const dm = (iso?: string) => iso ? `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}` : '';
    const parts = [
      state.booking.pickupDate && state.booking.returnDate ? (he ? `${dm(state.booking.pickupDate)}–${dm(state.booking.returnDate)}` : `${dm(state.booking.pickupDate)}–${dm(state.booking.returnDate)}`) : state.booking.pickupDate ? (he ? `מ־${dm(state.booking.pickupDate)}` : `from ${dm(state.booking.pickupDate)}`) : '',
      state.booking.pickupLocation ? (he ? `איסוף ב${state.booking.pickupLocation.replace(/^(?=[א-ת])/u, '')}` : `pickup in ${state.booking.pickupLocation}`) : '',
      state.booking.passengers ? (he ? `ל־${state.booking.passengers} נוסעים` : `for ${state.booking.passengers}`) : '',
    ].filter(Boolean);
    if (parts.length) {
      const vehicleQuestion = he ? 'איזה רכב מתאים לכם — קטן, משפחתי או משהו גדול יותר?' : 'What kind of car suits you — small, family or something bigger?';
      return `${he ? 'מעולה' : 'Great'}, ${parts.join(', ')}. ${price}${state.booking.vehicleNeed ? next : vehicleQuestion}`.replace(/\s+/g, ' ').trim();
    }
  }
  return `${lead}. ${benefit} ${price}${next}`.replace(/\s+/g, ' ').trim();
}

function takeSameReturnAfterTwoAsks(input: string, state: RebuildState): void {
  // Asked twice whether to return it to the same place and the customer moved on both times: a representative takes
  // the same place (it is in the summary to correct) instead of asking a third time.
  const botTurns = state.history.filter(entry => entry.from === 'bot').slice(-2).map(entry => entry.text);
  const pickupPattern = state.booking.pickupLocation ? state.booking.pickupLocation.replace(/^(?:מסירה עד הבית|Home delivery) \((.+)\)$/u, '$1').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const sameReturnAsked = (text: string) => Boolean(pickupPattern) && /[?؟]/u.test(text) && new RegExp(`(?:להחזיר|החזרה|return)[^?؟]{0,45}${pickupPattern}`, 'iu').test(text) || /להחזיר גם ב|להחזיר (?:אותו )?גם ב|לאסוף את הרכב גם מהבית|להחזיר את הרכב[^?؟]{0,30}(?:אותו|באותו)|Return it to .{2,30} as well\?|collect the car from the same place|return (?:it|the car) (?:to|at) the same/iu.test(text);
  if (!state.booking.returnLocation && state.booking.pickupLocation && botTurns.length === 2 && botTurns.every(sameReturnAsked)
    && !/להחזיר|החזרה|נחזיר|אחזיר|return|drop.?off|במקום אחר|elsewhere|different place|[?؟]/iu.test(input)) state.booking.returnLocation = sameReturnLabel(state);
}

function applyFields(input: string, state: RebuildState, reading: BotReading | null): void {
  if (!reading) return;
  const fields = reading.fields;
  const ageOnly = /^\s*(?:24\s*\+|21\s*[-–]\s*23)\s*$/u.test(input);
  const pending = nextMissing(state.booking);
  const plainDate = singleDateAnswer(input);
  const plainLocation = plainLocationAnswer(input, state.locale);
  for (const [source, target] of [['pickupDate', 'pickupDate'], ['returnDate', 'returnDate'], ['pickupLocation', 'pickupLocation'], ['returnLocation', 'returnLocation'], ['vehicleNeed', 'vehicleNeed']] as const) {
    const field = fields[source];
    if (!field || !input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase())) continue;
    if (source === 'pickupDate' || source === 'returnDate') {
      if (ageOnly) continue;
      if (plainDate) {
        const expected = source === 'returnDate' ? singleDateAnswer(input, state.booking.pickupDate) : plainDate;
        if (source !== pending || field.value !== expected) continue;
      }
      // The model reads loose timing ("לסופ״ש הזה", "this weekend", "for a week") from the calendar it is given;
      // its evidence is verbatim, so only a hypothetical phrase is refused.
      if (!/\d{1,2}|היום|מחר|מחרתיים|(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|today|tomorrow|(?:mon|tues|wed|thurs|fri|sat|sun)|מוצ.?ש|מוצאי|סופ.?ש|סוף ה?שבוע|weekend|(?:תחילת|ראשית|אמצע|סוף|בתחילת|מתחילת|באמצע|בסוף)\s+(?:חודש\s+)?(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)|(?:beginning|start|early|mid|middle|end)(?:\s+of)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i.test(field.evidence) && !(source === 'returnDate' && state.booking.pickupDate && /שבוע|ימים|יומיים|חודש|week|days?|month/i.test(field.evidence)) || isHypotheticalFactEvidence(input, field.evidence)) continue;
      // A length or a month alone ("for 5 days in March") is not a start date.
      if ((source === 'pickupDate' || source === 'returnDate' && !state.booking.pickupDate) && !/\d{1,2}(?!\d|\s*(?:days?|nights?|weeks?|months?|ימים|לילות|שבועות|חודשים|יום))|היום|מחר|מחרתיים|(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|today|tomorrow|(?:mon|tues|wed|thurs|fri|sat|sun)|מוצ.?ש|מוצאי|סופ.?ש|סוף ה?שבוע|weekend|(?:תחילת|ראשית|אמצע|סוף|בתחילת|מתחילת|באמצע|בסוף)\s+(?:חודש\s+)?(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)|(?:beginning|start|early|mid|middle|end)(?:\s+of)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i.test(field.evidence)) continue;
      const latest = new Date(`${israelDate()}T00:00:00Z`);
      latest.setUTCFullYear(latest.getUTCFullYear() + 2);
      if (!validDate(field.value) || field.value < israelDate() || field.value > latest.toISOString().slice(0, 10)) continue;
    }
    if (source === 'pickupLocation' || source === 'returnLocation') {
      if (temporalLocation(field.value)) continue;
      const samePlace = Boolean(plainLocation && sameLocationAnswer(plainLocation));
      const fromLocation = input.toLocaleLowerCase().includes(`from ${field.value.toLocaleLowerCase()}`)
        || input.toLocaleLowerCase().includes(`from the ${field.value.toLocaleLowerCase()}`)
        || /^[\p{Script=Hebrew}]/u.test(field.value) && input.includes(`מ${field.value}`);
      const explicitRole = source === 'pickupLocation' ? /איסוף|לאסוף|pick(?:\s+(?:it|the car))?[\s-]*up/i.test(input) || fromLocation
        : /להחזיר|נחזיר|אחזיר|מחזיר|החזרה|return|drop.?off/i.test(input) || samePlace && Boolean(state.booking.pickupLocation);
      const promptedRole = state.phase === 'booking' && state.step === 'rental_locations' && pending === source && plainLocation && !samePlace;
      // Trust the model's reading of the pickup when it points at a SmartCar branch or the airport with verbatim
      // evidence ("landing at TLV", "אני בתל אביב") — unless the phrase is where the trip is going.
      const value = field.value.trim();
      const flight = /land(?:ing|s)?|flight|arriv|נוחת|נוחתים|נחיתה|טיסה/iu.test(input);
      const branchKey = /^(?:ben gurion(?: airport)?|(?:the )?airport|נתב.?ג|שדה ה?תעופה)$/iu.test(value) || /^tlv$/iu.test(value) && flight ? 'airport'
        : /^(?:הרצליה|herzliya)$/iu.test(value) ? 'herzliya' : /^(?:תל אביב|tel aviv|tlv)$/iu.test(value) ? 'telaviv' : /^(?:ירושלים|jerusalem)$/iu.test(value) ? 'jerusalem' : undefined;
      const evidence = field.evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const destination = new RegExp(`\\b(?:to|towards|around|visit(?:ing)?|trip to|drive to)\\s+(?:the\\s+)?${evidence}|(?<![\\p{L}])ל${evidence}`, 'iu').test(input);
      // Delivery to the customer's home, hotel or office in a city ("my hotel in herzliya", "הבית שלי בנתניה"):
      // keep the city only, as a home-delivery pickup — never the street address.
      const deliveryCity = source === 'pickupLocation' && !state.booking.pickupLocation && /deliver|bring|hotel|home|house|office|work|apartment|מסירה|להביא|יביא|תביא|הביתה|לבית|בית|מלון|משרד|עבודה|דירה/iu.test(`${field.value} ${input}`)
        // City from the customer's own words (the evidence), not the model's value, which can be garbled.
        ? (field.evidence.match(/(?:\bin|(?<![\p{L}])ב)\s*([\p{L}]{3,15}(?:[ -](?!(?:tomorrow|today|tonight|morning|evening|next|this|on|for|from|at|by|and|please)\b)[\p{L}]{3,15})?)\s*$/iu)?.[1]) : undefined;
      if (deliveryCity && !/\d/.test(field.evidence) && !temporalLocation(deliveryCity) && !isHypotheticalFactEvidence(input, field.evidence)) {
        const city = state.locale === 'en' ? deliveryCity.replace(/\b\p{L}/gu, letter => letter.toUpperCase()) : deliveryCity;
        state.booking.pickupLocation = state.locale === 'he' ? `מסירה עד הבית (${city})` : `Home delivery (${city})`;
        continue;
      }
      const modelRole = source === 'pickupLocation' && Boolean(branchKey) && !state.booking.pickupLocation && !destination && !isHypotheticalFactEvidence(input, field.evidence);
      if (!explicitRole && !promptedRole && !modelRole) continue;
      if (modelRole && !explicitRole && !promptedRole) {
        state.booking.pickupLocation = (state.locale === 'he'
          ? { herzliya: 'הרצליה', telaviv: 'תל אביב', jerusalem: 'ירושלים', airport: 'נתב״ג' }
          : { herzliya: 'Herzliya', telaviv: 'Tel Aviv', jerusalem: 'Jerusalem', airport: 'Ben Gurion Airport' })[branchKey!];
        continue;
      }
    }
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
  // "להחזיר גם בהרצליה?" answered with a plain yes means the same place.
  const previousBotForReturn = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
  const askedSameReturn = /להחזיר גם ב|לאסוף את הרכב גם מהבית|Return it to .{2,30} as well\?|collect the car from the same place/u.test(previousBotForReturn)
    || Boolean(state.booking.pickupLocation) && /[?؟]\s*$/u.test(previousBotForReturn.trim()) && new RegExp(`(?:להחזיר|החזרה|return)[^?؟]{0,40}${state.booking.pickupLocation!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(previousBotForReturn);
  if (!state.booking.returnLocation && state.booking.pickupLocation && askedSameReturn && /^\s*(?:כן|בטח|ברור|נכון|בדיוק|אותו דבר|yes|yep|yeah|sure|correct|right)(?![\p{L}])/iu.test(input) && !/להחזיר|החזרה|לאסוף|תאספו|איסוף|return|collect|pick/iu.test(input)) state.booking.returnLocation = sameReturnLabel(state);
  if (!state.booking.returnLocation && state.booking.pickupLocation && (/אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input) || explicitSameReturn(input))) state.booking.returnLocation = sameReturnLabel(state);
  // "can I pick up the car on saturday?" — the model sometimes leaves a plain weekday out; it means the coming one.
  if (!state.booking.pickupDate && state.phase !== 'service' && !/\d/u.test(input.replace(/\b\d{1,2}(?::\d\d)?\s*(?:am|pm)\b|(?<!\d)\d{1,2}:\d\d(?!\d)|(?:ב|בשעה\s*)[-־]?\d{1,2}(?:\s*(?:בבוקר|בערב|בצהריים))?(?!\d)/giu, '')) && /איסוף|לאסוף|לקחת|לקבל|צריך רכב|pick(?:\s+(?:it|the car))?[\s-]*up|collect|need (?:a|the) car|rent/iu.test(input) && !/(?:^|\s)(?:what if|if i|אם)\s|every|כל יום/iu.test(input)) {
    const days = [['sunday', 'יום ראשון'], ['monday', 'יום שני'], ['tuesday', 'יום שלישי'], ['wednesday', 'יום רביעי'], ['thursday', 'יום חמישי'], ['friday', 'יום שישי'], ['saturday', 'שבת']] as const;
    const hits = days.map(([en, heDay], index) => ({ index, hit: new RegExp(`\\b${en}\\b`, 'iu').test(input) || (index === 6 ? /(?<![\p{L}])(?:ב)?שבת(?![\p{L}])/u.test(input) : new RegExp(`(?<![\\p{L}])ב?${heDay}(?![\\p{L}])`, 'u').test(input)) })).filter(day => day.hit);
    if (hits.length === 1 && !/today|tomorrow|היום|מחר/iu.test(input)) {
      const date = new Date(`${israelDate()}T12:00:00Z`);
      const ahead = (hits[0].index - date.getUTCDay() + 7) % 7 || 7;
      date.setUTCDate(date.getUTCDate() + ahead);
      state.booking.pickupDate = date.toISOString().slice(0, 10);
    }
  }
  if (state.booking.pickupDate && state.booking.returnDate && state.booking.returnDate < state.booking.pickupDate) delete state.booking.returnDate;
}

function applySelectedFacts(input: string, state: RebuildState, reading: BotReading | null, wantsBooking: boolean): void {
  // Revalidate the provider-boundary proposals against the actual current
  // message. No patch can carry identity, actions or a historical fact.
  const raw = reading?.factPatches?.map(patch => {
    if (patch.operation !== 'set') return patch;
    const value = patch.field === 'commercialBudget' ? { number: patch.value.amount, currency: patch.value.currency }
      : typeof patch.value === 'number' ? { number: patch.value }
        : patch.field === 'rentalPickupBranch' || patch.field === 'rentalReturnBranch' ? { branch: patch.value }
          : { category: patch.value };
    return { ...patch, value };
  });
  const categories = state.locale === 'he'
    ? { compact: 'רכב קומפקטי', family: 'רכב משפחתי', suv: 'רכב פנאי', seven_seat: 'רכב שבעה מקומות' }
    : { compact: 'compact car', family: 'family car', suv: 'SUV', seven_seat: 'seven-seat car' };
  const branches = state.locale === 'he'
    ? { herzliya: 'הרצליה', telaviv: 'תל אביב', jerusalem: 'ירושלים', airport: 'נתב״ג' }
    : { herzliya: 'Herzliya', telaviv: 'Tel Aviv', jerusalem: 'Jerusalem', airport: 'Ben Gurion Airport' };
  for (const patch of validateFactPatches(raw, input)) {
    if (patch.field.startsWith('rental')) {
      if (state.interest || state.phase === 'service' && !wantsBooking || state.completedRequestId && !wantsBooking) continue;
      switch (patch.field) {
        case 'rentalPickupBranch':
          if (patch.operation === 'set') state.booking.pickupLocation = branches[patch.value];
          else delete state.booking.pickupLocation;
          break;
        case 'rentalReturnBranch':
          if (patch.operation === 'set') state.booking.returnLocation = branches[patch.value];
          else delete state.booking.returnLocation;
          break;
        case 'rentalVehicleCategory':
          if (patch.operation === 'set') state.booking.vehicleNeed = categories[patch.value];
          else if (patch.operation === 'undecided') state.booking.vehicleNeed = state.locale === 'he' ? 'סוג רכב פתוח להתאמה' : 'vehicle group to be matched';
          else delete state.booking.vehicleNeed;
          break;
        case 'rentalPassengers':
          if (patch.operation === 'set') state.booking.passengers = patch.value;
          else delete state.booking.passengers;
          break;
        case 'rentalLuggage':
          if (patch.operation === 'set') state.booking.luggage = patch.value;
          else delete state.booking.luggage;
          break;
        case 'rentalChildSeats':
          if (patch.operation === 'set') state.booking.childSeats = patch.value;
          else if (patch.operation === 'remove') state.booking.childSeats = 0;
          else delete state.booking.childSeats;
          break;
      }
    } else if (state.interest) {
      const memory = state.commercial ??= {};
      switch (patch.field) {
        case 'commercialBudget':
          if (patch.operation === 'set') memory.budget = patch.value;
          else delete memory.budget;
          break;
        case 'commercialTermMonths':
          if (patch.operation === 'set') memory.termMonths = patch.value;
          else if (patch.operation === 'undecided') memory.termMonths = null;
          else delete memory.termMonths;
          break;
        case 'commercialAnnualMileageKm':
          if (patch.operation === 'set') memory.annualMileageKm = patch.value;
          else if (patch.operation === 'undecided') memory.annualMileageKm = null;
          else delete memory.annualMileageKm;
          break;
        case 'commercialVehiclePreference':
          if (patch.operation === 'set') memory.vehiclePreference = patch.value;
          else if (patch.operation === 'undecided') memory.vehiclePreference = null;
          else delete memory.vehiclePreference;
          break;
      }
    }
  }
}

function privateDetail(input: string, state: RebuildState, explicitStart = false): boolean {
  const labelledName = input.match(/(?:קוראים לי|שמי|השם שלי|השם הוא|my name is)\s+([\p{L}' -]{3,60})/iu)?.[1]
    ?? input.match(/(?:ת?רשו?[םמ](?:ו)?|תרשמו|לרשום|תשים|תכתוב|תכתבו)\s+(?:את (?:זה|הבקשה)\s+)?על\s+(?:שם\s+)?([\p{L}'-]{2,20}\s+[\p{L}'-]{2,20})(?=\s*(?:[,.!]|$|\s+(?:בן|בת)\b))/u)?.[1]
    ?? input.match(/\b(?:put it|book it|register it)\s+under\s+(?:the name\s+)?([\p{L}'-]{2,20}\s+[\p{L}'-]{2,20})(?=\s*(?:[,.!]|$))/iu)?.[1]
    ?? input.match(/(?:על\s+שם|\bunder (?:the name )?)\s*([\p{L}'-]{2,20}\s+[\p{L}'-]{2,20})(?=\s*(?:[,.!]|$|\s+(?:בן|בת|אני|aged?|I['’]?m)\b))/iu)?.[1];
  // A voluntary labelled name during an established rental enquiry is useful
  // before formal intake. Capture it locally, without treating it as consent.
  const voluntaryRentalName = state.phase === 'explore' && !state.interest && !state.completedRequestId && labelledName
    && Boolean(state.booking.pickupDate || state.booking.pickupLocation || state.booking.vehicleNeed || state.booking.passengers);
  // "אבי בדיקה 41" sent while a rental draft already has dates is the customer giving name and age.
  const draftNameAge = state.phase === 'explore' && !state.interest && !state.completedRequestId && Boolean(state.booking.pickupDate || state.booking.pickupLocation)
    && /^\s*(?:(?:great|ok(?:ay)?|perfect|sounds good|cool|thanks|yes|sure|יאללה|סבבה|אחלה|מעולה|טוב|בסדר|כן|תודה)[,.!\s]+)*(?:i['’]?m |i am |my name is |אני |שמי )?[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}\s*,?\s*(?:בן|בת|גיל|age|aged)?\s*\d{2}(?!\d)\s*[.!]?\s*$/u.test(input);
  const draftTrailingNameAge = state.phase === 'explore' && !state.interest && !state.completedRequestId && Boolean(state.booking.pickupDate || state.booking.pickupLocation)
    && /[,.!]\s*[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}\s*,?\s*(?:בן|בת|age|aged)?\s*\d{2}\s*[.!]?\s*$/u.test(input);
  // "בן 30, יוסי" / "Daniel, 21" / "יוסי בן 30": an age with one or two name words on their own.
  const shortNameAge = (state.phase === 'explore' || state.phase === 'booking') && !state.interest && !state.completedRequestId && Boolean(state.booking.pickupDate || state.booking.pickupLocation)
    ? (input.match(/^\s*(?:בן|בת|aged?)?\s*\d{2}\s*[,،]\s*([\p{L}'-]{2,20}(?:\s+[\p{L}'-]{2,20})?)\s*[.!]?\s*$/u)?.[1]
      ?? input.match(/^\s*([\p{L}'-]{2,20})\s*,?\s*(?:בן|בת|age|aged)?\s*\d{2}(?!\d)\s*[.!]?\s*$/u)?.[1])
    : undefined;
  if (state.phase !== 'booking' && !explicitStart && !voluntaryRentalName && !draftNameAge && !draftTrailingNameAge && !shortNameAge) return false;
  let captured = false;
  if (explicitStart || state.step === 'rental_name' || state.step === 'rental_email' || state.step === 'rental_confirm' || /המייל שלי|המייל הוא|my email|email\s*:/i.test(input)) {
    const email = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (email && EMAIL.test(email) && email.length <= 160) { state.booking.customerEmail = email; captured = true; }
  }
  const lastBot = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
  const askedForName = /שמך|השם שלך|את השם|על איזה שם|שם מלא|your (?:full )?name|what name/iu.test(lastBot);
  const introducedName = state.phase === 'booking' || explicitStart
    ? input.match(/(?:^|[.!,;]\s*)(?:I am|I['’]?m|im)\s+([\p{L}'-]{2,20}(?:\s+[\p{L}'-]{2,20})?)(?=\s*(?:,|$|\s+\d{2}\b|\s+and\b|[.!]))/iu)?.[1]
      ?? hebrewIntroducedName(input)
    : undefined;
  // After an explicit start, a two-word clause on its own between commas or at the
  // end ("יאללה בואו נתקדם, דנה בדיקה, נהג ראשי בעלי בן 38") is the name.
  const trailingName = (explicitStart || state.phase === 'booking' && state.step === 'rental_name') && !introducedName
    ? input.split(/[,.!;\n]/u).slice(1).map(part => part.trim().replace(/\s+(?:תסגור|תסגרו|סגור|תפתח|תפתחו|יאללה|please|thanks)\s*$/iu, '').replace(/\s+(?:בן|בת|aged?)\s*\d{2}$/iu, '')).find(part => /^[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}$/u.test(part)
      // Route clauses ("מחזיר בירושלים", "returning to Haifa") and places are never a name.
      && !/(?:^|\s)(?:מחזיר\S*|מחזירה|מחזירים|נחזיר|אחזיר|אוסף|אוספת|אוספים|נאסוף|אאסוף|איסוף|החזרה|returning|return|pickup|collecting|from|to)(?:\s|$)|(?:^|\s)[בלמה]?(?:ירושלים|תל|אביב|הרצליה|נתב\S*|חיפה|אילת|פתח|תקווה|Jerusalem|Herzliya|Tel|Aviv|Haifa|Eilat|airport)(?:\s|$)/iu.test(part)
      && (!/^(?:תודה|בבקשה|יאללה|סבבה|אחלה|מעולה|בסדר|קדימה|רק|גם|עם|בלי|thank|thanks|please|ok|okay|great|cool|sounds|with|without|also|just|asap|soon|today|tomorrow|מחר|היום)(?=\s|$)|(?:^|\s)(?:רכב|car|יום|ימים|days?|בקשה|request|הצעה|quote|מחיר|price|רבה|גדול|קטן|משפחתי|big|small)(?=\s|$)/iu.test(part))
      && !/(?:^|\s)(?:אני|אנחנו|הוא|היא|זה|זאת|הנהג|הנהגת|נהג|נהגת|ראשי|ראשית|בעלי|אשתי|I|we|he|she|it|this|the|להחזיר|לאסוף|בואו|נתקדם|יאללה|קדימה|בבקשה|תודה|גם|רק|עם|בלי|מחר|היום|main|driver|return|pick|please|thanks|let['’]?s|go|ahead|also|only|with|without|tomorrow|today)(?=\s|$)/iu.test(part))
    : undefined;
  // "יוסי בדיקה, בן 35" during intake is a name with an age, whatever question was pending.
  const nameAgeClause = shortNameAge && !introducedName ? shortNameAge : (state.phase === 'booking' || draftNameAge || draftTrailingNameAge || explicitStart) && !introducedName
    ? input.replace(/^\s*(?:(?:great|ok(?:ay)?|perfect|sounds good|cool|thanks|yes|sure|יאללה|סבבה|אחלה|מעולה|טוב|בסדר|כן|תודה)[,.!\s]+)*(?:i['’]?m|i am|my name is|this is|אני|שמי|קוראים לי)?\s*/iu, '').match(/^\s*([\p{L}'-]{2,20}\s+[\p{L}'-]{2,20})\s*,?\s*(?:בן|בת|גיל|age|aged)?\s*\d{2}(?!\d)/u)?.[1]
      // or as the last clause: "טוב סגור, רותם בדיקה 33"
      ?? input.match(/[,.!]\s*([\p{L}'-]{2,20}\s+[\p{L}'-]{2,20})\s*,?\s*(?:בן|בת|age|aged)?\s*\d{2}\s*[.!]?\s*$/u)?.[1] : undefined;
  const validNameAge = nameAgeClause && !/\s(?:בן|בת)$/u.test(nameAgeClause) && !/(?:^|\s)(?:אני|אנחנו|הוא|היא|זה|כן|לא|תודה|רכב|נהג|נהגת|להחזיר|לאסוף|מחר|היום|עד|עם|בלי|I|we|yes|no|car|driver|return|pick|from|to|the|a|an)(?:\s|$)/iu.test(nameAgeClause) && !/\d/.test(nameAgeClause) ? nameAgeClause : undefined;
  const validTrailingName = trailingName && !/^(?:תודה|בבקשה|יאללה|סבבה|אחלה|מעולה|בסדר|קדימה|רק|גם|עם|בלי|thank|thanks|please|ok|okay|great|cool|sounds|with|without|also|just|asap|soon|today|tomorrow|מחר|היום)(?=\s|$)|(?:^|\s)(?:רכב|car|יום|ימים|days?|בקשה|request|הצעה|quote|מחיר|price|רבה|גדול|קטן|משפחתי|big|small)(?=\s|$)/iu.test(trailingName) ? trailingName : undefined;
  const validIntroducedName = introducedName && !/^(?:not|unsure|still|looking|just|here|visiting|only|sorry|trying|waiting|renting|booking|confused|from|in|at|ok|okay|fine|good|sure|ready|interested|a|an|the|so|also|very|really|going|coming|staying|flying|landing|travel+ing|married|single)\b/i.test(introducedName) ? introducedName : undefined;
  if (explicitStart || state.step === 'rental_name' || state.step === 'rental_confirm' || labelledName || validIntroducedName || validNameAge || state.phase === 'booking' && askedForName) {
    const unlabelledName = !explicitStart && (state.step === 'rental_name' || state.step === 'rental_confirm')
      ? input.match(/I am\s+([\p{L}' -]{3,60})/iu)?.[1] : undefined;
    const explicitName = labelledName ?? (unlabelledName && !/^(?:not|unsure|still|looking|just|here|visiting|only|sorry|trying|waiting|renting|booking|confused)\b/i.test(unlabelledName) ? unlabelledName : undefined);
    const explicit = explicitName?.split(/\s+(?:ואני|ואין|אין לי|and I|and my|but I)\s+/i)[0].trim();
    // A customer answering the name prompt may append a separate correction
    // or decline optional email. Only the leading name clause is private data.
    // Drop a leading acknowledgement and self-introduction ("great, im mike test, 30" → "mike test").
    const introCandidate = input.replace(/^\s*(?:(?:great|ok(?:ay)?|perfect|sounds good|cool|thanks|yes|sure|יאללה|סבבה|אחלה|מעולה|טוב|בסדר|כן|תודה)[,.!\s]+)*(?:i['’]?m|i am|my name is|this is|name is|it['’]?s|אני|שמי|קוראים לי|השם)\s+/iu, '');
    const introStripped = /^(?:not|unsure|still|looking|just|here|visiting|only|sorry|trying|waiting|renting|booking|confused|going|thinking|interested|לא|עדיין|רק|מחפש|מחפשת|חושב|חושבת|מעוניין|מעוניינת|צריך|צריכה|רוצה)\b/iu.test(introCandidate) ? input : introCandidate;
    const leading = introStripped.split(/[,!.;\n]/u, 1)[0].trim().replace(/\s*(?:בן|בת|age|aged)?\s*\d{2}$/u, '').trim();
    const promptedName = !explicitStart && state.step === 'rental_name'
      && /^[\p{L}' -]{3,60}$/u.test(leading)
      && !/^(?:I|we|please|actually|no|yes|thanks?|before|after|not|do|don['’]?t|what|how|when|where|why|can|could|should|would|is|are|אני|אנחנו|לא|כן|תודה|בעצם|לפני|אחרי|אפשר|מה|איך|למה|מתי|כמה)(?:\s|$)/iu.test(leading)
      ? leading : '';
    const contactAttached = /(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}|[^\s@]+@[^\s@]+\.[^\s@]+/u.test(input);
    const answeredNamePrompt = !promptedName && state.phase === 'booking' && askedForName && (contactAttached || /^[\p{L}' -]{3,60}[,،]/u.test(input))
      && /^[\p{L}' -]{3,60}$/u.test(leading) && leading.split(/\s+/).length <= 4
      && !/^(?:I|we|please|actually|no|yes|thanks?|before|after|not|do|don['’]?t|what|how|when|where|why|can|could|should|would|is|are|ok|okay|sure|אני|אנחנו|לא|כן|תודה|בעצם|לפני|אחרי|אפשר|מה|איך|למה|מתי|כמה|בסדר|סבבה|יאללה|רגע)(?:\s|$)/iu.test(leading)
      ? leading : '';
    const candidate = explicit ?? (promptedName || answeredNamePrompt || validIntroducedName || validTrailingName || validNameAge);
    if (candidate && candidate.split(/\s+/).length <= 4) { state.booking.customerName = candidate; captured = true; }
  }
  return captured;
}

function summary(state: RebuildState): string {
  const b = state.booking;
  const consent = termsConsent(state.locale);
  const date = (value?: string) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '';
  const needs = state.locale === 'en'
    ? `${b.passengers ? `Passengers: ${b.passengers}\n` : ''}${b.luggage ? `Bags: ${b.luggage}${b.luggageSize === 'large' ? ' (large)' : ''}\n` : ''}${b.childSeats ? `Requested child seats: ${b.childSeats} (subject to availability, terms and fit for the specific car)\n` : ''}`
    : `${b.passengers ? `נוסעים: ${b.passengers}\n` : ''}${b.luggage ? `מזוודות: ${b.luggage}${b.luggageSize === 'large' ? ' (גדולות)' : ''}\n` : ''}${b.childSeats ? `בקשת כיסאות בטיחות: ${b.childSeats} (בכפוף לזמינות, לתנאים ולהתאמה לרכב המסוים)\n` : ''}`;
  // The same notices the website booking form shows: Shabbat and Ben Gurion (no amounts — owner rule).
  const shabbat = isShabbat(b.pickupDate) || isShabbat(b.returnDate);
  const airport = /נתב.?ג|Ben Gurion|airport/iu.test(`${b.pickupLocation ?? ''} ${b.returnLocation ?? ''}`);
  const notes = state.locale === 'en'
    ? `${shabbat ? '\nNote: a Saturday pickup or return is arranged in advance and may carry an extra charge.' : ''}${airport ? '\nNote: pickup or return at Ben Gurion Airport carries a surcharge.' : ''}`
    : `${shabbat ? '\nשימו לב: איסוף או החזרה בשבת מתואמים מראש ועשויים להיות כרוכים בתוספת תשלום.' : ''}${airport ? '\nשימו לב: על איסוף או החזרה בנתב״ג יש תוספת.' : ''}`;
  if (state.locale === 'en') return `Here are your request details:\nVehicle: ${b.vehicleNeed}\n${needs}Dates: ${date(b.pickupDate)}–${date(b.returnDate)}\nPickup: ${b.pickupLocation}\nReturn: ${b.returnLocation}\nDriver age: ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}\nName: ${b.customerName}${b.customerEmail ? `\nEmail: ${b.customerEmail}` : ''}${notes}\n\nThis request is subject to SmartCar's review and confirmation. Before sending it, please confirm the following statement:\n“${consent.text}”\nTerms: https://www.smartcar.co.il/en/terms\nPrivacy: https://www.smartcar.co.il/en/privacy\nIf everything is correct and you agree, reply “I confirm” to send the request.`;
  return `אלה פרטי הבקשה שלכם:\nרכב: ${b.vehicleNeed}\n${needs}תאריכים: ${date(b.pickupDate)}–${date(b.returnDate)}\nאיסוף: ${b.pickupLocation}\nהחזרה: ${b.returnLocation}\nגיל הנהג: ${b.driverAgeRange === '24-plus' ? '24+' : '21–23'}\nשם: ${b.customerName}${b.customerEmail ? `\nמייל: ${b.customerEmail}` : ''}${notes}\n\nהבקשה תועבר לאישור SmartCar. לפני השליחה, אנא אשרו את ההצהרה:\n״${consent.text}״\nתנאי השימוש: https://www.smartcar.co.il/he/terms\nמדיניות הפרטיות: https://www.smartcar.co.il/he/privacy\nאם הכול נכון ואתם מסכימים, שלחו ״אני מאשר/ת״ כדי לשלוח את הבקשה.`;
}

const RECEIPT_NEED_FIELDS = /child seats?|car seats?|passengers?|bags?|luggage|נוסעים|מזוודות?|כיסא(?:ות)? בטיחות/iu;
const RECEIPT_SEAT_FIELD = /child seats?|car seats?|כיסא(?:ות)? בטיחות/iu;

function recallsCompletedRentalNeeds(input: string): boolean {
  return RECEIPT_NEED_FIELDS.test(input)
    && /remind|keep|kept|save|saved|record|recorded|how many|תזכיר|שמר|רשמ|נקלט|כמה/iu.test(input);
}

function recallsRentalDetails(input: string): boolean {
  return /תזכיר|הזכר|סכם|סיכום|remind|recap|summari[sz]|go over|run through/iu.test(input)
    && /פרט|בקשה|הזמנה|השכרה|detail|request|booking|rental/iu.test(input)
    || /(?:באיזה|איזה).{0,12}(?:יום|מקום)|מתי|איפה|\b(?:where|when|what day|which day)\b/iu.test(input)
      && /מחזיר|להחזיר|החזרה|לאסוף|איסוף|\breturn|drop.?off|pick.?up|collect/iu.test(input);
}

function pushHistory(state: RebuildState, input: string, reply: string, privateTurn: boolean): void {
  state.history.push({ from: 'customer', text: input.slice(0, 450), private: privateTurn }, { from: 'bot', text: reply.slice(0, 650), private: privateTurn });
  state.history = state.history.slice(-20);
}

export async function getRebuiltBotReply(phone: string, raw: string, store: RebuildStore): Promise<RebuildResult> {
  draftNotes = [];
  const input = raw.trim().slice(0, 1000);
  const stored = await store.loadState(phone);
  const turnStartPickup = stored?.booking?.pickupDate;
  const turnStartName = stored?.booking?.customerName;
  const turnStartReturn = stored?.booking?.returnDate;
  const state = stored?.version === 2 ? structuredClone(stored) : fresh(language(input, 'he'));
  // One-time legacy interpretation; ordinary future discussion cannot turn
  // a keyword in history into a selected request on every subsequent turn.
  state.serviceChangeRequested ??= state.phase === 'service'
    && state.history.some(entry => entry.from === 'customer' && rentalChangeRequest(entry.text));
  if (state.handedOff && (!state.handoffAt || !Number.isFinite(Date.parse(state.handoffAt)) || Date.now() - Date.parse(state.handoffAt) >= 24 * 60 * 60 * 1000)) {
    state.handedOff = false;
    state.handoffAt = undefined;
    state.handoffKind = undefined;
    state.safetyKind = undefined;
    state.phase = 'explore';
    state.step = 'menu';
  }
  state.locale = language(input, state.locale);
  if (state.interest) {
    if (!state.commercial) {
      state.commercial = {};
      for (const entry of state.history) if (entry.from === 'customer') state.commercial = updateCommercialMemory(state.commercial, entry.text);
    }
    state.commercial = updateCommercialMemory(state.commercial, input);
    applyPromptedMileage(input, state);
  }
  const he = state.locale === 'he';
  let reply = '';
  // Set when the reply is an approved policy answer that model wording must not replace.
  let policyLocked = false;
  let source: RebuildResult['source'] = 'local';
  let modelRoute: string | undefined;
  let modelNeedsRepresentative = false;
  let model: string | undefined;
  let escalate = false;
  let privateTurn = false;
  // A payment enquiry being queued is not a human reply. Keep answering its
  // informational questions while the existing alert remains intact. The webhook's
  // actual staff-takeover silence check still runs before/after generation.
  const serviceQuestion = /[?؟]|רק (?:שואל|שואלת|מברר)|only (?:asking|want to understand)/i.test(input);
  const depositEnquiry = [input, ...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text)]
    .some(text => /מקדמה|advance payment|pay.{0,30}deposit/i.test(text));
  const unselectedChangeHandoff = state.handedOff && state.handoffKind === 'booking_change'
    && !state.serviceChangeRequested && !state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text));
  const continuedServiceAdvice = Boolean(unselectedChangeHandoff || state.handedOff && serviceQuestion && depositEnquiry
    && (state.handoffKind === 'human' || state.handoffKind === 'service_issue'));
  const lastBotReply = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
  // An explicit correction to existing-rental service must be able to escape
  // an accidentally started intake. It does not approve a service action or
  // discard any pending rental draft.
  if (state.phase === 'booking' && !explicitBooking(input)
    && /\b(?:existing|current) (?:booking|rental)\b|\b(?:I|we) already have (?:the |your |a )?car\b|הזמנה קיימת|ההזמנה הקיימת|הרכב כבר אצל[ינ]|אני כבר עם הרכב/iu.test(input)
    && !/not (?:about|an? ).{0,12}(?:existing|current)|לא (?:לגבי|על).{0,10}הזמנה קיימת/iu.test(input)) {
    state.phase = 'service';
    state.step = 'menu';
  }
  if ((!state.booking.pickupDate || !state.booking.returnDate)
    && (hasUndecidedRentalDates(input) || uncertainDateAnswer(input) && asksRentalDates(lastBotReply))) state.booking.datePreference = 'dates undecided';
  const labelledReference = explicitServiceReference(input);
  if (labelledReference) state.serviceReference = labelledReference;
  else if (!state.serviceReference) {
    state.serviceReference = state.history.filter(entry => entry.from === 'customer').reverse()
      .map(entry => explicitServiceReference(entry.text)).find(Boolean);
    if (!state.serviceReference && state.phase === 'service' && /מספר ההזמנה|booking reference/i.test(lastBotReply)
      && /^[A-Z0-9-]*\d[A-Z0-9-]{2,39}$/i.test(input)) state.serviceReference = input;
  }
  const confirmsDuration = affirms(input) || /^(?:כן|נכון|yes|correct)[,\s]+(?:אלה|אלו|זה|those|these|the dates)(?:\s|$)/i.test(input);
  if (state.durationClarification && !confirmsDuration && !/^(?:לא|no|not quite|לא נכון)/i.test(input) && !explicitDateRange(input)) {
    // A side answer can continue the conversation; the final request summary
    // still shows the exact dates and requires explicit confirmation.
    state.durationClarification = false;
  }

  // Owner decision 2026-11-09: a dashboard warning light goes straight to a
  // representative. The bot gives no technical or driving advice about it.
  const warningLight = !/מה (?:קורה|עושים) אם|what if|\bif (?:a|the) (?:warning )?light\b/iu.test(input)
    && (!/בלמ|ברקס|\bbrak|הגה|steering|עשן|smoke|ריח|burning|smell/iu.test(input) && /(?<![\p{L}])(?:מצפצף|מצפצפת|מזמזם|מזמזמת)(?![\p{L}])|צפצופ(?:ים)?\s+(?:מוזר|כל הזמן|בלוח|ברכב)|רעש(?:ים)?\s+(?:מוזר|מוזרים|חזק|חזקים)\s+(?:מה|ב|מתחת|כש)|\b(?:keeps?|started|is|it['’]?s) (?:beeping|chiming)\b|\b(?:weird|strange|loud|grinding) (?:noise|sound)\b/iu.test(input) || /נור(?:ה|ת)(?:\s+(?:אזהרה|התראה|צהובה|אדומה|כתומה|מנוע|שמן|לחץ\s+אוויר|בלמים|מצבר|ABS))?\s+(?:נדלקה|דלוקה|נדלק|מהבהבת|מאירה)|נדלק(?:ה)?\s+(?:לי\s+)?(?:נורה|נורת|אור|סימן)|(?:נורה|סימן|אור)\s+(?:צהוב|אדום|כתום)\s+(?:בלוח|על הלוח|נדלק)|\b(?:warning|check engine|engine|oil|battery|brake|abs|tyre pressure|tire pressure|dashboard)\s+(?:light|lamp|warning)\b.{0,40}\b(?:came on|is on|turned on|lit up|flashing|appeared|just)\b|\b(?:a|the|some)\s+(?:yellow|red|orange)\s+light\b.{0,30}\b(?:came on|is on|turned on|lit up|flashing|dashboard)\b/iu.test(input));
  // Lost keys or being locked out also need a representative, not advice.
  const keyProblem = !/מה (?:קורה|עושים) אם|what if|\bif I (?:lose|lost)\b/iu.test(input)
    && /(?:איבדתי|איבדנו|אבד(?:ה|ו)?|נעלם|נעלמו|אין לי את)\s+(?:את\s+)?(?:אחד\s+)?(?:ה)?מפתח(?:ות)?|המפתח(?:ות)?\s+(?:אבד|נעלם|נשבר|ננעל)|ננעל(?:תי|נו)?\s+(?:מחוץ|בחוץ)|המפתח(?:ות)?\s+(?:נשאר|נשארו|בפנים)|\b(?:lost|can['’]?t find|misplaced|broke)\s+(?:one of\s+)?(?:the|my|our)\s+(?:car\s+)?keys?\b|\blocked (?:myself |ourselves )?out\b|\bkeys? (?:are |is )?(?:locked )?inside\b/iu.test(input);
  if (keyProblem && state.handoffKind !== 'safety') {
    const recent = state.handedOff && state.handoffKind === 'service_issue' && state.history.slice(-6).some(entry => entry.from === 'bot' && /מפתח|key/i.test(entry.text));
    state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue';
    escalate = !recent;
    const reply = he
      ? `העברתי את הפנייה על המפתח לנציג SmartCar, שיחזור אליכם לגבי ההמשך. לעזרה מיידית התקשרו ל־${OFFICE_PHONE}.`
      : `I have passed your key issue to a SmartCar representative, who will contact you about next steps. For immediate help call ${OFFICE_PHONE}.`;
    pushHistory(state, input, reply, false);
    if (escalate && !store.isSimulation) await store.beforeEscalationSave?.(phone);
    await store.saveState(phone, state);
    return { reply, state, escalate, source: 'local' };
  }
  if (warningLight && state.handoffKind !== 'safety') {
    const recentWarning = state.handedOff && state.handoffKind === 'service_issue' && state.history.slice(-6).some(entry => entry.from === 'bot' && /נורת אזהרה|warning light|צפצוף או רעש|beep or unusual noise/i.test(entry.text));
    state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue';
    escalate = !recentWarning;
    const lightMentioned = /נור(?:ה|ת)|light|lamp/iu.test(input);
    const reply = !lightMentioned
      ? (he ? `צפצוף או רעש חריג ברכב צריכים בדיקה של נציג SmartCar, והעברתי אליו את הפנייה. אם יש חשש בטיחותי — עשן, ריח, או שהרכב לא מתנהג כרגיל — עצרו במקום בטוח. לעזרה מיידית התקשרו ל־${OFFICE_PHONE}.`
        : `A beep or unusual noise in the car needs a SmartCar representative to check it, and I have passed your message on. If there is any safety concern — smoke, a smell or the car not behaving normally — stop somewhere safe. For immediate help call ${OFFICE_PHONE}.`)
      : he
      ? `נורת אזהרה צריכה בדיקה של נציג SmartCar, והעברתי אליו את הפנייה. אם יש חשש בטיחותי — עשן, רעש חריג או שהרכב לא מתנהג כרגיל — עצרו במקום בטוח. לעזרה מיידית התקשרו ל־${OFFICE_PHONE}.`
      : `A warning light needs a SmartCar representative to check it, and I have passed your message on. If there is any safety concern — smoke, unusual noise or the car not behaving normally — stop somewhere safe. For immediate help call ${OFFICE_PHONE}.`;
    pushHistory(state, input, reply, false);
    if (escalate && !store.isSimulation) await store.beforeEscalationSave?.(phone);
    await store.saveState(phone, state);
    return { reply, state, escalate, source: 'local' };
  }
  // "I'm stuck in traffic, I'll be an hour late" is a heads-up, not an extension request. A representative
  // thanks the customer, passes it to the branch and is honest that the agreed time still applies.
  const runningLate = /(?<![\p{L}])(?:אאחר|נאחר|מאחר(?:ת|ים)?|אתעכב|מתעכב(?:ת|ים)?|תקוע(?:ה|ים)?\s+בפקק\S*|לא (?:אספיק|נספיק) (?:להחזיר|להגיע))(?![\p{L}])|\b(?:running late|(?:will|gonna|going to|i['’]?ll|we['’]?ll) be (?:\S+ ){0,3}late|stuck in traffic|won['’]?t make it (?:back )?(?:on time|by|in time))\b/iu.test(input)
    && !/מה (?:קורה|עושים) אם|what if|\bif i\b|(?:^|\s)אם\s/iu.test(input) && !safety(input);
  if (runningLate && state.handoffKind !== 'safety' && !state.interest) {
    const forPickup = /לאסוף|לקחת את הרכב|איסוף|pick.?up|collect/iu.test(input) && !/להחזיר|החזרה|return|drop.?off/iu.test(input);
    const already = state.handedOff && state.history.slice(-4).some(entry => entry.from === 'bot' && /תודה שעדכנתם|Thanks for letting us know/u.test(entry.text));
    // Owner decision 2026-11-13: up to an hour late on a return is fine; more than that, the customer calls the office.
    // Only a late pickup is passed to a representative (the handover has to be rearranged).
    if (forPickup) { state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue'; escalate = !already; }
    const reply = forPickup
      ? (he ? `תודה שעדכנתם, העברתי את זה לנציג SmartCar כדי שיתאם את המסירה. סעו בזהירות; אם יש שינוי נוסף או משהו דחוף, התקשרו ל־${OFFICE_PHONE}.`
        : `Thanks for letting us know — I have passed it to a SmartCar representative so the handover can be rearranged. Drive safely; for any further change or anything urgent, call ${OFFICE_PHONE}.`)
      : (he ? `תודה שעדכנתם, סעו בזהירות ואל תמהרו. איחור של עד שעה בהחזרה זה בסדר. אם זה יהיה יותר משעה, התקשרו לעדכן אותנו ב־${OFFICE_PHONE}.`
        : `Thanks for letting us know — drive safely and don't rush. Returning up to an hour late is fine. If it will be more than an hour, please call us on ${OFFICE_PHONE} to update.`);
    pushHistory(state, input, reply, false);
    if (escalate && !store.isSimulation) await store.beforeEscalationSave?.(phone);
    await store.saveState(phone, state);
    return { reply, state, escalate, source: 'local' };
  }
  // "What happens if I get a flat tire?" asks about the procedure; it is not a report and must not alert anyone.
  const whatIfOnly = /(?:^|[.!?]\s*)(?:(?:what (?:happens|do i do|should i do|do we do|is the procedure)|and)\s+)?(?:if (?:i|we) (?:get|have|had)|what if)\b|מה (?:קורה|עושים|יקרה|עושים במקרה ש)\s*(?:אם|כש|במקרה)|מה הנוהל (?:אם|במקרה)/iu.test(input)
    && !/(?:right now|just now|now|already|i have a|i got a|i(?:'m| am) (?:stuck|on|at)|עכשיו|כרגע|קרה לי|יש לי (?:פנצ|תקלה)|נתקעתי|עשיתי תאונה)/iu.test(input);
  const incident = whatIfOnly ? null : safety(input);
  if (incident) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt ??= new Date().toISOString(); state.handoffKind = 'safety';
    state.safetyKind = incident;
    const recentAlert = state.safetyAlertAt && Date.now() - Date.parse(state.safetyAlertAt) < 24 * 60 * 60 * 1000;
    const noOneHurt = /(?:אף אחד|איש|כולם|כולנו)\s+(?:לא נפגע|בסדר)|no one (?:is |was )?hurt|nobody (?:is |was )?hurt|everyone(?:'s| is) (?:ok|okay|fine)|we(?:'re| are) (?:all )?(?:ok|okay|fine)/iu.test(input);
    const minorCollision = /תאונה|התנגשות|נכנס(?:ו)? ב(?:י|נו)|פגע(?:ו)? ב(?:י|נו)|accident|collision|hit (?:me|us)|rear-?ended|bumped into/iu.test(input) && !/עשן|smoke|fire|אש|דליפ|leak|נפגע(?!\s*\S*\s*לא)|injur|ambulance|אמבולנס|בית חולים|hospital/iu.test(input.replace(/(?:אף אחד|איש)\s+לא נפגע/gu, ''));
    reply = reportedRentalDamage(input) || minorCollision && noOneHurt
      ? (he ? `מצטער לשמוע. ${/(?:אף אחד|איש|כולם|כולנו)\s+(?:לא נפגע|בסדר)|no one (?:is |was )?hurt|everyone(?:'s| is) (?:ok|fine)/iu.test(input) ? 'טוב שאיש לא נפגע. ' : 'אם מישהו נפגע, פנו קודם לגורמי החירום. '}צלמו את הנזק ואת מקום האירוע אם בטוח לעשות זאת, והתקשרו ל־SmartCar בתוך שעה לדיווח ולהנחיות: ${OFFICE_PHONE}. את מספר ההזמנה אפשר למסור גם בהמשך.` : `I am sorry this happened. ${noOneHurt ? 'I am glad no one was hurt. ' : 'If anyone is hurt, call emergency services first. '}If it is safe, photograph the damage and the scene, then call SmartCar within one hour to report it and get guidance: ${OFFICE_PHONE}. You can provide the booking reference later.`)
      : /(?:won['’]?t|doesn['’]?t|will not|does not|can['’]?t get (?:it|the car) to) start|just clicks|dead battery|battery (?:is )?dead|לא (?:מניע|מתניע|נדלק)|הרכב לא מתניע|המצבר (?:מת|נגמר)|רק (?:מקליק|עושה קליק)|flat (?:tyre|tire)|פנצ['׳]?ר/iu.test(input) && !/תאונה|accident|collision|smoke|עשן|fire|אש/iu.test(input)
      ? (he ? `מצטער לשמוע. אם אתם במקום בטוח, הישארו שם ואל תנסו לתקן בעצמכם. התקשרו עכשיו ל־SmartCar כדי לתאם עזרה: ${OFFICE_PHONE}. הפנייה שלכם כבר אצל נציג.` : `Sorry to hear that. If you are somewhere safe, stay there and do not try to fix it yourself. Call SmartCar now to arrange help: ${OFFICE_PHONE}. Your message is already with a representative.`)
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
  } else if (cancellationRequest(input) && state.handoffKind !== 'safety') {
    state.phase = 'service';
    const knownBooking = await store.activeBooking(phone);
    const hasReference = Boolean(state.serviceReference) || [input, ...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text)]
      .some(text => /(?:מספר\s+ה?הזמנה|booking\s+(?:number|reference))\s*(?:(?:שלי|הוא|is)\s*)*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{2,}/i.test(text));
    if (knownBooking || hasReference) {
      const alreadyEscalatedCancellation = state.handedOff && state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text));
      state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'booking_change'; escalate = !alreadyEscalatedCancellation;
      reply = /יוחזר|החזר|בחזרה|(?:ה)?כסף (?:חוזר|יחזור)|מהכסף|refund|money back|get (?:my |the )?money back/i.test(input)
        ? (he ? 'בקשת הביטול נרשמה לבדיקה. הביטול והחזר כספי אינם מתבצעים אוטומטית בשיחה; הנציג יבדוק את תנאי ההזמנה ומועד הביטול ויאשר אם מגיע החזר ובאיזה סכום.' : 'Your cancellation request is recorded for review. Cancellation and any refund are not processed automatically in this chat; a representative will check your booking terms and cancellation timing and confirm whether a refund applies and its amount.')
        : /(?:האם|זה|ההזמנה|כבר)\s*(?:כבר\s*)?(?:מאושר|מבוטל(?:ת)?|בוטל(?:ה)?)|\b(?:is|has) (?:it|the booking|my booking) (?:been )?(?:cancell?ed|approved)|\beffective\b/i.test(input)
          ? (he ? 'רשמתי בקשת ביטול, ולא שינוי תאריכים. הביטול עדיין לא אושר במסגרת השיחה הזו; נציג SmartCar יבדוק את הבקשה ואת תנאי ההזמנה ויאשר את התוצאה.' : 'I have recorded a cancellation request, not a date change. Cancellation has not been confirmed in this chat; a SmartCar representative will review the request and booking terms and confirm the outcome.')
          : (he ? `קיבלנו את בקשת הביטול. נציג SmartCar יבדוק אותה ויחזור אליכם; הביטול תקף רק לאחר אישור. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have your cancellation request. A SmartCar representative will review it and follow up; cancellation takes effect only after confirmation. For immediate help call ${OFFICE_PHONE}.`);
    } else {
      const refundAsked = /החזר|כסף|זיכוי|יחזירו|refund|money back|get (?:my|our) money/iu.test(input);
      const terms = refundAsked ? getSmartCarApprovedFacts(state.locale).find(fact => fact.id === 'cancellation')?.text : undefined;
      const tiers = terms ? `${terms.split(/(?<=[.!])\s+/u).slice(0, 1).join(' ')} ` : '';
      reply = he ? `${tiers}בשמחה אעזור עם בקשת הביטול. מה מספר ההזמנה?` : `${tiers}I can help with the cancellation request. What is your booking reference?`;
    }
  } else if (state.handedOff && state.handoffKind === 'commercial' && declinesHumanHandoff(input)) {
    // Resume optional commercial advice without pretending the earlier alert
    // was recalled. Keep its timestamp, kind and history for audit.
    state.handedOff = false;
    state.phase = 'explore'; state.step = 'menu'; state.humanHandoffDeferred = true;
    const notice = he
      ? 'הפנייה הקודמת עשויה כבר להיות אצל הצוות; לא יזמתי פנייה חדשה לנציג. אפשר להמשיך להתלבט כאן.'
      : 'The earlier enquiry may already be with the team; I have not initiated a new callback. We can keep discussing options here.';
    reply = /[?؟]|מה כלול|מה ההבדל|what.*included|compare|difference/i.test(input)
      ? `${notice} ${commercialReply(input, state).reply}` : notice;
  } else if (state.handedOff && !continuedServiceAdvice) {
    if (state.handoffKind === 'service_issue' && state.serviceChangeRequested) state.handoffKind = 'booking_change';
    const handoffKind = state.handoffKind ?? (state.safetyAlertAt && (!state.handoffAt || Date.parse(state.safetyAlertAt) >= Date.parse(state.handoffAt)) ? 'safety' : state.interest ? 'commercial' : 'booking_change');
    const cancellationPending = handoffKind === 'booking_change' && state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text));
    const newReference = explicitServiceReference(input);
    if (newReference && !state.serviceReference) state.serviceReference = newReference;
    const hasBookingReference = Boolean(state.serviceReference);
    const replacementAsk = /להחליף (?:לי |לנו )?(?:את )?(?:ה)?רכב|החלפ(?:ה|ת) (?:ה)?רכב|רכב (?:חלופי|אחר|חדש)|\b(?:replace(?:ment)?|swap|switch|change) (?:the |my |this )?car\b|\b(?:another|different|replacement) car\b/iu.test(input);
    const billingIssue = handoffKind === 'service_issue' && state.history.some(entry => entry.from === 'customer' && /חויבתי פעמיים|חיוב כפול|שילמתי פעמיים|charged twice|double charg/i.test(entry.text));
    const cleanlinessIssue = handoffKind === 'service_issue' && state.history.some(entry => entry.from === 'customer' && /הרכב.{0,25}מלוכלך|רכב מלוכלך|dirty car|car was dirty/i.test(entry.text));
    const safetyKind = state.safetyKind ?? (state.history.some(entry => entry.from === 'customer' && /תאונה|התנגשות|accident|collision|crash/i.test(entry.text)) ? 'accident' : 'breakdown');
    const rentalDamage = state.history.some(entry => entry.from === 'customer' && reportedRentalDamage(entry.text));
    const asksDriving = /(?:אפשר|מותר|האם|צריך|בטוח).{0,40}(?:לנסוע|נסיע)|(?:can|may|should|safe|okay|ok).{0,40}(?:drive|driving)|(?:continue|keep|carry on).{0,15}driving|roadworthy|drivable/i.test(input);
    const asksDamageDocumentation = /אין לי.{0,30}מספר|לא.{0,20}מספר הזמנה|לצלם|צילום|תמונה|photo|picture|don'?t have.{0,30}(?:reference|booking number)/i.test(input);
    const commercialUpdate = (handoffKind === 'commercial' || state.interest) && /תקציב|budget|בעצם|שנים|years|לא החלטתי|not chosen|not decided/i.test(input);
    reply = handoffKind === 'safety' && asksDriving
      ? (he ? `אם הדלת או חלק אחר ברכב לא פועלים כרגיל, או שיש חשש בטיחותי, אל תמשיכו לנסוע. גם כשהנזק נראה קוסמטי, דווחו ל־SmartCar בתוך שעה במספר ${OFFICE_PHONE} וקבלו הנחיה לגבי המשך הנסיעה.` : `If the door or any part of the car is not working normally, or you have a safety concern, do not continue driving. Even if the damage looks cosmetic, report it to SmartCar within one hour on ${OFFICE_PHONE} and get guidance before continuing.`)
        + (rentalDamage && asksDamageDocumentation ? (he ? ' צלמו את הנזק ואת סביבת האירוע, כולל הרכב השני אם אפשר ובטוח לעשות זאת. דווחו גם בלי מספר ההזמנה כרגע; אפשר למסור אותו בהמשך.' : ' Photograph the damage and scene, including the other vehicle if possible and safe. Report it even without the booking reference for now; you can provide it later.') : '')
      : state.interest && /מה.{0,35}(?:זוכר|שמורים|רשמת|שמרת)|(?:what|which).{0,45}(?:remember|recorded|saved|details do you have)/i.test(input)
      ? commercialReply(input, state).reply
      : handoffKind === 'booking_change' && !cancellationPending && /תשלום|חיוב|עולה|עלות|מחיר|תוספת|charge|cost|fee|pay|price/iu.test(input)
        && state.history.some(entry => entry.from === 'bot' && /48 שעות לפני האיסוף|48 hours before pickup/u.test(entry.text))
      ? (he ? 'לפי תנאי ההשכרה, שינוי תאריכים בלי חיוב נוסף אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות. נציג SmartCar יאשר את השינוי ויעדכן אם יש הבדל במחיר.' : 'Under the rental terms, date changes are free up to 48 hours before pickup, subject to availability. A SmartCar representative will confirm the change and tell you if the price differs.')
      : handoffKind === 'booking_change' && !cancellationPending
      && /אושר|אישור|להניח|המחיר|מחיר|עלות|תשלום|תוספת|קוצר|הוארך|שונה|יוחזר|החזר|הפרש|זיכוי|approv|confirm|assume|price|cost|charge|rate|shortened|extended|refund|difference|credit/i.test(input)
      ? (he ? 'השינוי המבוקש עדיין לא אושר. עד לאישור מפורש של SmartCar, מועד ההחזרה הקיים נשאר בתוקף. גם המחיר המעודכן אינו מובטח; הזמינות והמחיר ייבדקו לפני אישור השינוי.' : 'The requested change is not approved yet. Until SmartCar explicitly confirms it, the existing agreed return deadline remains in effect. The previous rate is not guaranteed; availability and the revised price will be checked before confirming the change.')
        + (/יוחזר|החזר|הפרש|זיכוי|refund|difference|credit/i.test(input) ? (he ? ' החזר או זיכוי אינם מתבצעים אוטומטית; הם תלויים בתנאי ההזמנה ויאושרו רק לאחר בדיקת SmartCar.' : ' A refund or credit is not automatic; it depends on the booking terms and is confirmed only after SmartCar reviews the change.') : '')
      : commercialUpdate
      ? (he ? 'העדכון האחרון שמסרתם נשמר בשיחה לבדיקת הנציג. זו פנייה לבדיקה בלבד, ללא התחייבות לעסקה. אין צורך לשלוח מספר כרטיס מלא או קוד אבטחה.' : 'Your latest update is saved in the conversation for the representative to review. This is an enquiry only, with no commitment to a deal. Do not send a full card number or security code.')
      : /לא התחייבתי|לא סגרתם|רק פנייה|רק העברתם|עסקה מאושרת|signed deal|just an enquiry|not a signed|already.*refund|refund.*(?:done|processed)|זיכוי כבר|הזיכוי.*בוצע/i.test(input)
        ? (he ? 'זו פנייה לבדיקה בלבד. לא אושרו כאן עסקה, שינוי או זיכוי; נציג SmartCar יבדוק ויאשר איתכם את ההמשך.' : 'This is an enquiry for review only. No deal, change or refund has been approved here; a SmartCar representative will review and confirm the next steps with you.')
      : PRIVATE_PAYMENT_DETAIL.test(input) && !/החזר|ביטול|אושר|אישור|refund|cancel|approv/i.test(input)
        ? (he ? 'אין צורך לשלוח מספר כרטיס מלא או קוד אבטחה. שמרו אסמכתאות לחיובים, עם פרטי הכרטיס מוסתרים, לבדיקת הנציג.' : 'Do not send a full card number or security code. Keep charge records with card details hidden for the representative to review.')
      : handoffKind === 'commercial' && state.interest && /מה כלול|מה כולל|תשלום ראשוני|מקדמה|מחיר|כמה עולה|נסיעת מבחן|what.*included|initial payment|down payment|price|test drive/i.test(input)
      ? commercialReply(input, state).reply
      : handoffKind === 'commercial' && state.interest && /רכב (?:משפחתי|קטן|פנאי|קומפקטי)|\b(?:family car|small car|SUV|compact car)\b|\d[\d, .]*\s*(?:קמ|ק״מ|km)/i.test(input)
        ? (he ? 'תודה, הוספתי את ההעדפה שציינת לפנייה. נציג SmartCar יוכל להתייחס אליה בהצעה.' : 'Thanks, I have added that preference to your enquiry so the SmartCar representative can include it in the offer.')
      : handoffKind === 'commercial' && /אפשר לראות|יש אפשרות לראות|לראות את הרכב|view (?:the )?car|see (?:the )?car/i.test(input)
        ? (he ? 'כן, אפשר לבדוק עם נציג SmartCar אפשרות לראות רכב מתאים לאחר שיוצעו דגמים זמינים. הוא יחזור אליכם עם הפרטים ויתאם את הצעד הבא.' : 'Yes, a SmartCar representative can check how to view a suitable car once available options are identified. They will follow up with the details and next step.')
      : handoffKind === 'commercial' && /תעביר|נציג|pass.*representative|send.*team/i.test(input)
        ? (he ? 'הפנייה כבר הועברה להמשך טיפול. נציג SmartCar יחזור אליכם.' : 'Your enquiry has already been passed on. A SmartCar representative will follow up.')
      : handoffKind === 'safety' && /גרר|רכב חלופי|\btow\b|replacement (?:car|vehicle)/i.test(input)
        && /כבר|אושר|הוזמן|הזמנתם|תיאמתם|מתואם|already|have you|has .{0,35}been|arranged|booked|confirmed|dispatched/i.test(input)
        ? (he ? `לא ניתן כאן אישור לתיאום גרר או לרכב חלופי. הישארו במקום בטוח והתקשרו ל־SmartCar במספר ${OFFICE_PHONE} לתיאום; הגרר והזמינות של רכב חלופי דורשים אישור מפורש של SmartCar.` : `This chat has not confirmed a tow or replacement car. Stay somewhere safe and call SmartCar on ${OFFICE_PHONE} to arrange assistance; towing arrangements and replacement-car availability require explicit confirmation from SmartCar.`)
      : handoffKind === 'safety' && rentalDamage && asksDamageDocumentation
        ? (/פרטים.{0,20}(?:מהנהג|של הנהג)|הנהג השני|other driver|driver['’]?s details/i.test(input) ? (he ? 'אם בטוח לעשות זאת, רשמו את פרטי הנהג השני והרכב שלו ואת פרטי הביטוח שלו. ' : 'If it is safe, note the other driver’s details, vehicle and insurance details. ') : '')
          + (he ? `כן, צלמו את הנזק ואת סביבת הרכב אם בטוח לעשות זאת. התקשרו ל־SmartCar בתוך שעה במספר ${OFFICE_PHONE} ודווחו גם בלי מספר הזמנה כרגע; תוכלו למסור אותו בהמשך. נציג ינחה אתכם לגבי דוח האירוע והמשך הטיפול.` : `Yes, photograph the damage and surroundings if it is safe. Call SmartCar within one hour on ${OFFICE_PHONE} even if you do not have the booking reference yet; you can provide it later. A representative will guide you on the incident report and next steps.`)
      : handoffKind === 'safety' && rentalDamage && /אשלם|נשלם|משלם|משלמת|משלמים|תשלום.{0,20}נזק|אצטרך.{0,20}לשלם|נצטרך.{0,20}לשלם|מי.{0,15}ישלם|השתתפות ה?עצמית|אחריות.{0,20}נזק|חייב.{0,15}תיקון|pay for|liable|responsib(?:le|ility) for|excess/i.test(input)
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
        ? (he ? 'הביטול עדיין לא אושר במסגרת השיחה הזו. נציג SmartCar יבדוק את הבקשה ואת תנאי ההזמנה ויחזור אליכם עם תשובה.' : 'Cancellation has not been confirmed in this chat. A SmartCar representative will review the request and booking terms and follow up.')
      : cancellationPending && /יוחזר|החזר|בחזרה|(?:ה)?כסף (?:חוזר|יחזור)|מהכסף|refund|money back|get (?:my |the )?money back|דמי ביטול|קנס|עלות|מחיר|\b(?:cost|fee|penalty)\b/i.test(input)
        ? (he ? 'לפי תנאי ההשכרה, ביטול יותר מ־72 שעות לפני האיסוף מזכה בהחזר מלא; 72–48 שעות — 25% מדמי השכירות הבסיסיים; 48–24 שעות — 50%; פחות מ־24 שעות — 100%. ההחזר אינו מתבצע אוטומטית בשיחה; הנציג יבדוק את ההזמנה ואת מועד הביטול בפועל ויאשר את הסכום.' : 'Under the rental terms, cancelling more than 72 hours before pickup gives a full refund; 72–48 hours — 25% of the base rental fee; 48–24 hours — 50%; under 24 hours — 100%. The refund is not processed automatically in this chat; a representative will check the booking and the actual cancellation time and confirm the amount.')
      : cancellationPending && /חיוב|תשלום|charge|payment/i.test(input)
        ? (he ? 'צירפנו גם את שאלת החיוב לפנייה על הביטול כדי שנציג SmartCar יבדוק את שניהם יחד. אם יש פרטי חיוב או אסמכתא, כדאי לשמור אותם לבדיקה.' : 'We have added the charge question to the cancellation enquiry so a SmartCar representative can review both. Keep any charge details or records for review.')
      : cancellationPending && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|next step|what next/i.test(input)
        ? state.history.some(entry => entry.from === 'bot' && /בקשת הביטול הועברה לנציג|cancellation request has been passed/i.test(entry.text))
          ? (he ? 'כרגע לא נדרשת מכם פעולה נוספת בשיחה. השיחה אינה אישור ביטול; נציג SmartCar יבדוק את הבקשה ואת תנאי ההזמנה ויאשר את התוצאה.' : 'There is nothing else you need to do in this chat now. This chat is not cancellation confirmation; a SmartCar representative will review the request and booking terms and confirm the outcome.')
          : (he ? `בקשת הביטול הועברה לנציג SmartCar. הוא יבדוק אותה ויחזור אליכם; הביטול ייכנס לתוקף רק לאחר אישור.` : `Your cancellation request has been passed to a SmartCar representative. They will review it and follow up; cancellation takes effect only after confirmation.`)
      : cancellationPending && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}להכין|what.*(?:prepare|have ready)/i.test(input)
        ? (he ? 'מספר ההזמנה שכבר מסרתם שמור בפנייה. אם הפנייה כוללת חיוב, כדאי להכין גם את פרטי החיוב כדי שנציג SmartCar יוכל לבדוק הכול יחד.' : 'The booking reference you gave is included in the enquiry. If it also concerns a charge, have the charge details ready so the SmartCar representative can review both together.')
      : handoffKind === 'booking_change' && !cancellationPending && /מחיר|עלות|תשלום|תוספת|\b(?:price|cost|charge|rate)\b/i.test(input)
        ? (he ? 'המחיר לתקופה הנוספת עשוי להשתנות לפי הזמינות ותנאי ההשכרה. נציג SmartCar יבדוק את העלות ויציג לכם אותה לפני אישור ההארכה; אין כאן התחייבות למחיר הקודם.' : 'The extra period may have a different price depending on availability and your rental terms. A SmartCar representative will check the cost and present it before confirming the extension; the previous rate is not guaranteed.')
      : handoffKind === 'booking_change' && /מה (?:כדאי|צריך) להכין|כדאי להכין|יש (?:משהו|פרטים).{0,15}(?:להכין|שכדאי להכין)|what.*(?:prepare|have ready)/i.test(input)
        ? (he ? `${hasBookingReference ? 'מספר ההזמנה כבר צורף לפנייה.' : 'כדאי לשלוח את מספר ההזמנה.'} כדאי לציין גם את תאריך ההחזרה הרצוי כדי שנציג SmartCar יוכל לבדוק את השינוי.` : `${hasBookingReference ? 'Your booking reference is already included.' : 'Please send your booking reference.'} It also helps to state the return date you want so a SmartCar representative can check the change.`)
      : handoffKind === 'booking_change' && /(?:זה|השינוי|הדחייה).{0,12}(?:כבר )?מאושר|כבר אישרתם|is (?:it|the change) (?:already )?approved|has (?:it|the change) been approved/i.test(input)
        ? (he ? 'השינוי עדיין לא אושר. נציג SmartCar יבדוק את הזמינות ויחזור אליכם; רק לאחר אישורו תאריך ההחזרה יתעדכן.' : 'The change is not approved yet. A SmartCar representative will check availability and follow up; the return date changes only after confirmation.')
      : handoffKind === 'booking_change' && /מה הצעד הבא|מה עושים עכשיו|איך ממשיכים|what(?: is)? next|next step/i.test(input)
        ? (he ? 'נציג SmartCar יבדוק אם אפשר לדחות את ההחזרה ויחזור אליכם עם תשובה. עד לאישור, תאריך ההחזרה הקיים נשאר בתוקף.' : 'A SmartCar representative will check whether the return can be moved and follow up. Until confirmed, the current return date remains in effect.')
      : handoffKind === 'safety' && cancellationRequest(input)
      ? (() => {
        const terms = /החזר|כסף|זיכוי|refund|money back/iu.test(input) ? `${getSmartCarApprovedFacts(state.locale).find(fact => fact.id === 'cancellation')?.text.split(/(?<=[.!])\s+/u)[0] ?? ''} ` : '';
        return he ? `${terms}הוספתי לפנייה גם את בקשת הביטול. הביטול תקף רק לאחר אישור של נציג SmartCar. ${state.serviceReference ? '' : 'מה מספר ההזמנה שאתם רוצים לבטל?'}`.trim()
          : `${terms}I have added the cancellation request to your message. It takes effect only after a SmartCar representative confirms it. ${state.serviceReference ? '' : 'Which booking reference would you like to cancel?'}`.trim();
      })()
      : handoffKind === 'safety' && /will (?:someone|anyone|you) come|send (?:someone|a tech|a technician|help)|is (?:someone|anyone|help) coming|(?:מישהו|טכנאי|עזרה) (?:יגיע|יבוא|מגיע)|תשלחו (?:מישהו|טכנאי|עזרה)|שולחים (?:מישהו|טכנאי)/iu.test(input)
      ? (he ? `מכאן אי אפשר לשלוח עזרה או לאשר הגעה. התקשרו עכשיו ל־SmartCar במספר ${OFFICE_PHONE}, והם יתאמו מולכם את העזרה; הפנייה שלכם כבר אצלם.` : `I cannot send help or confirm a visit from this chat. Call SmartCar now on ${OFFICE_PHONE} and they will arrange help with you; your message is already with them.`)
      : handoffKind === 'safety' && explicitServiceReference(input)
      ? (() => { const ref = explicitServiceReference(input)!; state.serviceReference ??= ref; return he ? `קיבלתי את מספר ההזמנה ${ref}, והוא צורף לפנייה. לעזרה מיידית התקשרו ל־${OFFICE_PHONE}.` : `Got booking ${ref}; it has been added to your message. For immediate help call ${OFFICE_PHONE}.`; })()
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
        ? (he ? 'כן, נציג SmartCar יחזור אליכם לגבי בקשת הביטול. השיחה אינה אישור ביטול; הנציג יבדוק את תנאי ההזמנה ויאשר את התוצאה.' : 'Yes, a SmartCar representative will follow up about the cancellation request. This chat is not cancellation confirmation; the representative will check the booking terms and confirm the outcome.')
      : /^(?:תודה(?: רבה)?|thanks|thank you)[.!\s]*$/i.test(input)
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
      // A policy question after a handoff gets the approved answer, not the receipt line again.
      : handoffKind !== 'safety' && /[?؟]/u.test(input) && getSmartCarServiceAnswer(input, state.locale) && !/(?:^|\s)(?:מתי|כמה זמן)\s|\bwhen\b|\bhow long\b/iu.test(input)
        ? `${getSmartCarServiceAnswer(input, state.locale)!.reply} ${he ? 'הפנייה שלכם כבר אצל נציג SmartCar.' : 'Your request is already with a SmartCar representative.'}`
      : (handoffKind === 'service_issue' || handoffKind === 'human') && replacementAsk
        ? (he ? `בקשה להחלפת רכב בודק נציג SmartCar, שכבר קיבל את הפנייה; כאן אי אפשר להבטיח החלפה. לעזרה מיידית התקשרו ל־${OFFICE_PHONE}.` : `A replacement car is checked by the SmartCar representative who already has your enquiry; I cannot promise a swap here. For immediate help call ${OFFICE_PHONE}.`)
      : (handoffKind === 'service_issue' || handoffKind === 'human') && newReference
        ? (he ? `קיבלתי את מספר ההזמנה ${newReference}, והוא יצורף לפנייה אצל נציג SmartCar. לעזרה מיידית התקשרו ל־${OFFICE_PHONE}.` : `Got booking ${newReference}; it will be added to your enquiry with the SmartCar representative. For immediate help call ${OFFICE_PHONE}.`)
      : handoffKind === 'safety'
        ? (he ? `תודה על העדכון. אל תמשיכו לנסוע אם יש חשש בטיחותי; לתיאום עזרה התקשרו עכשיו ל־${OFFICE_PHONE}.` : `Thanks for the update. Do not keep driving if the car may be unsafe; call ${OFFICE_PHONE} now to arrange help.`)
        : handoffKind === 'commercial' && state.interest
          ? (he ? `קיבלנו את הפרטים על ${state.interest === 'sale' ? 'רכישת רכב' : 'ליסינג'}. נציג SmartCar יחזור אליכם להמשך; אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your ${state.interest === 'sale' ? 'car purchase' : 'leasing'} details. A SmartCar representative will follow up; you can also call ${OFFICE_PHONE}.`)
        : handoffKind === 'service_issue' || handoffKind === 'human'
          ? (he ? `תודה על העדכון. נציג SmartCar יטפל בפנייה שלכם; לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thanks for the update. A SmartCar representative will handle your enquiry; for immediate help call ${OFFICE_PHONE}.`)
        : cancellationPending && /יחזירו|יוחזר|החזר|בחזרה|הכסף|זיכוי|refund|money back/iu.test(input)
          ? `${getSmartCarApprovedFacts(state.locale).find(fact => fact.id === 'cancellation')?.text.split(/(?<=[.!])\s+/u)[0] ?? ''} ${he ? 'ההחזר לא מתבצע אוטומטית בשיחה; נציג SmartCar יבדוק את מועד הביטול ויאשר אם מגיע החזר ובאיזה סכום.' : 'Refunds are not processed automatically in this chat; a SmartCar representative will check the cancellation time and confirm whether a refund is due and how much.'}`.trim()
        : cancellationPending
          ? (he ? `קיבלנו את בקשת הביטול. נציג SmartCar יחזור אליכם; הביטול תקף רק לאחר אישור. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your cancellation request. A SmartCar representative will follow up; cancellation takes effect only after confirmation. You can also call ${OFFICE_PHONE}.`)
          : (he ? `קיבלנו את בקשת השינוי. נציג SmartCar יחזור אליכם; השינוי תקף רק לאחר אישור. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `We have your change request. A SmartCar representative will follow up; the change takes effect only after confirmation. You can also call ${OFFICE_PHONE}.`);
    // After a non-safety handoff the chat should still feel like a person, not a receipt on repeat:
    // a thank-you gets a short closing, and a new question is answered by the model from approved facts.
    const safetyReceipt = handoffKind === 'safety' && /^(?:תודה על העדכון\. אל תמשיכו לנסוע|Thanks for the update\. Do not keep driving)/u.test(reply) && input.trim().length >= 4;
    if ((safetyReceipt || handoffKind !== 'safety' && /^(?:תודה על העדכון\. נציג SmartCar יטפל|Thanks for the update\. A SmartCar representative will handle|קיבלנו את בקשת השינוי\. נציג|We have received your change request)/u.test(reply))
      && (safetyReceipt || /[?؟]/u.test(input) || input.trim().length >= 4 || state.history.some(entry => entry.from === 'bot' && entry.text === reply))) {
      if (/^\s*(?:תודה(?: רבה)?|תודה אחי|תודה לך|מעולה|סבבה|אוקיי?|אחלה|בסדר(?: גמור)?|thanks?(?: a lot| so much)?|thank you|ok(?:ay)?|great|cool|perfect|cheers)[\s!.🙏👍😊]*(?:אחי|גבר|bro|mate)?[\s!.🙏👍😊]*$/iu.test(input)) {
        reply = he ? 'בשמחה. אם צריך עוד משהו, אנחנו כאן.' : 'You’re welcome. We’re here if you need anything else.';
      } else {
        const followUp = await (store.readTurn ?? readBotTurn)(redactServiceReference(input, state.serviceReference), {
          locale: state.locale, phase: state.phase, today: israelDate(),
          recent: state.history.filter(item => !item.private).slice(-8).map(({ from, text }) => ({ from, text: redactServiceReference(text, state.serviceReference) })),
          known: conversationalKnown(state), approvedFacts: getSmartCarApprovedFacts(state.locale),
          conversation: { interest: state.interest, handoffDeferred: false, hasServiceReference: Boolean(state.serviceReference), step: state.step, completedRequest: Boolean(state.completedRequestId) },
        });
        const drafted = groundedModelReply(followUp, input, state);
        // After a safety report the model may answer a question (who pays, what happens next) but may never
        // clear the car for driving; the safety line and the office number stay.
        const clearsDriving = /(?:אפשר|מותר|בטוח|ניתן|תוכלו|אתם יכולים)\s+(?:להמשיך|לנסוע|לנהוג)|(?:safe|ok|okay|fine|alright)\s+to\s+(?:drive|continue|keep)|you\s+(?:can|may)\s+(?:drive|continue|keep (?:driving|going))/iu.test(drafted ?? '');
        if (drafted && drafted.trim().length >= 25 && !(safetyReceipt && clearsDriving) && !state.history.some(entry => entry.from === 'bot' && entry.text === drafted)) {
          if (followUp) model = followUp.model;
          reply = safetyReceipt && drafted.includes(OFFICE_PHONE)
            ? `${drafted.trim()} ${he ? 'אל תמשיכו לנסוע אם יש חשש בטיחותי.' : 'Do not keep driving if the car may be unsafe.'}`
            : safetyReceipt
            ? `${drafted.trim()} ${he ? `אל תמשיכו לנסוע אם יש חשש בטיחותי; לתיאום עזרה התקשרו ל־${OFFICE_PHONE}.` : `Do not keep driving if the car may be unsafe; to arrange help call ${OFFICE_PHONE}.`}`
            : /נציג|representative/iu.test(drafted) ? drafted.trim()
            : `${drafted.trim()} ${he ? 'הפנייה שלכם כבר אצל נציג SmartCar.' : 'Your request is already with a SmartCar representative.'}`;
        }
      }
    }
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
  } else if (state.completedRequestId && state.phase === 'explore' && FINAL_CONSENT.test(input.trim())) {
    reply = store.isSimulation ? (he ? 'בסימולציה הבקשה נקלטה לצורכי בדיקה בלבד; לא נוצרה הזמנה אמיתית.' : 'The request was recorded in this simulation only; no real booking was created.') : (he ? `בקשת ההשכרה נשלחה לבדיקה, מספר ${state.completedRequestId}. היא עדיין אינה הזמנה מאושרת.` : `Your rental request was sent for review, reference ${state.completedRequestId}. It is not a confirmed booking yet.`);
  } else if (state.completedRequestId && state.phase === 'explore' && !explicitBooking(input) && !state.handedOff
    && /(?:\b(?:add|change|switch|remove|update|make it)\b|להוסיף|תוסיפו|לשנות|תשנו|להוריד|תורידו|לעדכן|תעדכנו)/iu.test(input)
    && /child seat|car seat|date|day|car|vehicle|pick.?up|return|passenger|כיסא|תאריך|יום|רכב|איסוף|החזרה|נוסע/iu.test(input)
    && !/what if|\bif\b|מה אם|(?:^|\s)אם\s/iu.test(input)) {
    // The sent request is immutable here. Pass the addition to the team honestly.
    state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'booking_change'; escalate = true;
    reply = he
      ? `הבקשה כבר נשלחה לבדיקה, ולכן אי אפשר לשנות אותה כאן. העברתי לצוות את הבקשה הנוספת כדי שיתייחסו אליה בתשובה; היא כפופה לזמינות ולאישור. לעזרה מיידית: ${OFFICE_PHONE}.`
      : `Your request has already been sent for review, so I can't change it here. I've passed this addition to the team so they can include it in their reply; it is subject to availability and confirmation. For immediate help: ${OFFICE_PHONE}.`;
  } else if (state.completedRequestId && state.phase === 'explore' && !explicitBooking(input)
    && (/מאושר|מאושרת|אישרתם|אושר|סגור|סגורה|מובטח|שמור(?:ה)? (?:לנו|לי)|יחזרו|תחזרו|מתי (?:נשמע|תעדכנו)|\breserved\b|\breservation\b|\bon hold\b|hear back|get back to|call (?:me|us) back|רק בקשה|עדיין בקשה|בקשה לבדיקה|\bconfirmed\b|\bconfirmation\b|\bguaranteed\b|still.{0,25}(?:request|review)|request for review|(?:which|what).{0,40}(?:date|city|location|details).{0,30}(?:keep|kept|save|record)|(?:מה|איזה|אילו|לאיזה).{0,30}(?:תאריך|עיר|מיקום|פרט).{0,30}(?:שמר|רשמ|נקלט)/i.test(input) || recallsRentalDetails(input) || recallsCompletedRentalNeeds(input))) {
    reply = store.isSimulation
      ? (he ? 'בסימולציה נקלטה בקשה לבדיקה בלבד. לא נוצרה הזמנה אמיתית ולא אושר רכב. בעבודה מול SmartCar, הבקשה והפרטים טעונים בדיקה ואישור של נציג.' : 'This simulation recorded a request for review only. No real booking was created and no car was confirmed. With SmartCar, the request and details still require review and confirmation by a representative.')
      : (he ? `בקשת ההשכרה מספר ${state.completedRequestId} נשלחה לבדיקה. שליחת הבקשה אינה אישור להזמנה או לרכב; נציג SmartCar יבדוק את הזמינות והתנאים ויאשר אותם איתכם.` : `Rental request ${state.completedRequestId} was sent for review. Sending a request is not confirmation of a booking or car; a SmartCar representative will check availability and terms and confirm them with you.`);
    if (/price|quote|cost|how much|מחיר|הצעה|עלות|כמה (?:זה )?(?:עולה|יעלה)/iu.test(input)) reply += he ? ' המחיר והזמינות יימסרו בתשובת SmartCar לבקשה; לא יבוצע חיוב לפני שתאשרו את ההצעה.' : ' The price and availability come with SmartCar’s reply to the request; nothing is charged before you accept the offer.';
    if (state.completedRental && (/date|city|location|details|תאריך|עיר|מיקום|פרט/i.test(input) || recallsRentalDetails(input) || RECEIPT_NEED_FIELDS.test(input))) {
      const b = state.completedRental;
      const format = (value?: string) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '';
      reply += he
        ? `\n\nהפרטים שנרשמו בבקשה: ${b.vehicleNeed ?? ''}; איסוף ${b.pickupLocation ?? ''} ב־${format(b.pickupDate)}; החזרה ${b.returnLocation ?? ''} ב־${format(b.returnDate)}.`
        : `\n\nRecorded request details: ${b.vehicleNeed ?? ''}; pickup ${b.pickupLocation ?? ''} on ${format(b.pickupDate)}; return ${b.returnLocation ?? ''} on ${format(b.returnDate)}.`;
      if (b.passengers !== undefined) reply += he ? `\nנוסעים: ${b.passengers}.` : `\nPassengers: ${b.passengers}.`;
      if (b.luggage !== undefined) reply += he ? `\nמזוודות: ${b.luggage}.` : `\nBags: ${b.luggage}.`;
      if (b.childSeats !== undefined) {
        reply += b.childSeats === 0
          ? (he ? '\nלא נכללה בקשה לכיסא בטיחות בבקשה שנקלטה.' : '\nNo child seat is requested in the recorded request.')
          : (he ? `\nבקשת כיסאות בטיחות: ${b.childSeats} (בכפוף לזמינות, לתנאים ולהתאמה לרכב המסוים).` : `\nRequested child seats: ${b.childSeats} (subject to availability, terms and fit for the specific car).`);
      } else if (RECEIPT_SEAT_FIELD.test(input)) {
        reply += he ? '\nלא נרשם פרט לגבי בקשת כיסא בטיחות.' : '\nNo child-seat request detail was recorded.';
      }
    }
  } else if (state.phase === 'booking' && state.step === 'rental_confirm' && /לא מאשר|לא מאשרת|not confirm|not yet/i.test(input)) {
    reply = he ? 'לא שלחתי בקשה. הפרטים נשמרו בשיחה; אפשר לתקן אותם או לאשר רק כשתרצו.' : 'I have not sent a request. The details remain in this conversation; you can correct them or confirm when ready.';
  } else if (state.phase === 'booking' && state.step === 'rental_confirm' && FINAL_CONSENT.test(input.trim())) {
    const missing = nextMissing(state.booking);
    if (missing) {
      state.step = bookingStep(missing);
      reply = question(missing, state.locale);
    } else {
    const id = await store.createRentalRequest(phone, state);
    if (id) {
      const { pickupDate, returnDate, pickupLocation, returnLocation, vehicleNeed, passengers, luggage, childSeats } = state.booking;
      state.completedRental = { pickupDate, returnDate, pickupLocation, returnLocation, vehicleNeed, passengers, luggage, childSeats };
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
  } else if (state.phase === 'booking' && state.step === 'rental_age' && /אני לא מבין|לא הבנתי|מה זאת אומרת|i don'?t understand|what do you mean/i.test(input) && /מגיל 21|aged 21 or older/i.test(lastBotReply)) {
    reply = he ? 'אם הנהג הראשי בן 20, אי אפשר להשכיר על שמו. אם אדם אחר בן 21 ומעלה יהיה הנהג הראשי, אפשר להמשיך עם קבוצת הגיל שלו בכפוף לתנאי הרכב והביטוח.' : 'A 20-year-old cannot be the main renter. If someone aged 21 or older will be the main driver, we can continue with that person’s age group, subject to the vehicle and insurance terms.';
  } else if (state.phase === 'booking' && state.step === 'rental_dates' && affirms(input) && /כשתדעו את התאריכים המדויקים|when you know the exact dates/i.test(lastBotReply)) {
    reply = he ? 'בסדר. כשתדעו את התאריכים, כתבו אותם כאן ונמשיך מהפרטים שכבר מסרתם.' : 'Of course. Send the dates when you know them and we will continue with the details already shared.';
  } else if (state.phase === 'explore' && /באיזו שעה|באיזה שעה|what time/i.test(lastBotReply)
    && (/^\d{1,2}(?::\d{2})?$/.test(input) || /אמרתי לך כבר|שאלת כבר|כבר אמרתי|already told you|asked me already/i.test(input))) {
    const consented = state.history.some((entry, index) => entry.from === 'customer' && affirms(entry.text) && index > 0 && offersRentalRequest(state.history[index - 1].text));
    if (consented) {
      state.phase = 'booking'; state.requestKey ??= randomUUID();
      const missing = nextMissing(state.booking);
      state.step = bookingStep(missing);
      reply = `${he ? 'סליחה על החזרה. אין צורך בשעת איסוף בשלב הזה. ' : 'Sorry for repeating myself. I do not need a pickup time now. '}${missing ? question(missing, state.locale) : summary(state)}`;
    } else reply = he ? 'סליחה, חזרתי על שאלה. לא צריך לציין שעה כרגע. איך תרצה שאעזור מכאן?' : 'Sorry, I repeated a question. I do not need a time now. How would you like me to help?';
  } else {
    const lastBot = lastBotReply;
    const pendingFieldAtTurnStart = nextMissing(state.booking);
    const wasBooking = state.phase === 'booking';
    const previousVehicleNeed = state.booking.vehicleNeed;
    applyExplicitNeeds(input, state.booking);
    // "Each of us with a suitcase" means one bag per known traveller, not one bag.
    if (state.booking.passengers && /(?:כל אחד|כל אחת|כל אחד מאיתנו)\s+(?:עם|לוקח(?:ת)?|מביא(?:ה)?|יהיה עם)\s+(?:מזוודה|תיק)|\b(?:each (?:of us )?(?:with|has|brings|bringing|will have)|one each)\s+(?:a |one )?(?:(?:small|medium|large|big) )?(?:suitcase|bag)\b|\b(?:a )?(?:suitcase|bag) each\b/iu.test(input)
      && !/אם|what if|\bif\b/iu.test(input)) {
      state.booking.luggage = state.booking.passengers;
    }
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
    // "Okay" in a service discussion accepts neither a new rental nor a
    // change request. Explicit new-rental intent is handled separately below.
    const confirmedOffer = state.phase !== 'service' && !state.interest && acceptsRentalInvitation(input, lastBot);
    // The assistant asked for the customer's name to prepare the request and the
    // customer supplied it with contact details. That continues the request
    // draft; final consent to send remains a separate step.
    const answersContactPrompt = state.phase === 'explore' && !state.interest && !state.completedRequestId
      && /שמך|השם שלך|your (?:full )?name/iu.test(lastBot)
      && /(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}|[^\s@]+@[^\s@]+\.[^\s@]+/u.test(input)
      && Boolean(state.booking.pickupDate || state.booking.pickupLocation || state.booking.vehicleNeed || state.booking.passengers);
    if (answersContactPrompt) {
      state.phase = 'booking';
      state.requestKey ??= randomUUID();
    }
    // A customer who gives a name (and maybe an age) in the middle of an established rental draft is moving
    // forward, the way "תרשום על שם…" would be at a desk. Continue the request intake; sending still needs consent.
    const lastClauseNameAge = /(?:^|[,.!]\s*)[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}\s*,?\s*(?:בן|בת|age|aged)?\s*\d{2}\s*[.!]?\s*$/u.test(input)
      && !/(?:^|\s)(?:אני|אנחנו|לא|בעוד|עוד|בערך|יש|we|not|in|for|about)\s+[\p{L}'-]{2,20}\s*,?\s*\d{2}\s*[.!]?\s*$/iu.test(input);
    const namesInDraft = state.phase === 'explore' && !state.interest && !state.completedRequestId && !state.handedOff
      && [state.booking.pickupDate || state.booking.returnDate, state.booking.pickupLocation, state.booking.vehicleNeed, state.booking.passengers].filter(Boolean).length >= 2
      && (lastClauseNameAge || /(?:ת?רשו?[םמ]|תרשמו|לרשום)\s+(?:את (?:זה|הבקשה)\s+)?על\s+(?:שם\s+)?[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}|\b(?:put|book|register) it under\b/u.test(input) || /^\s*(?:(?:great|ok(?:ay)?|perfect|sounds good|thanks|cool|yes|sure|יאללה|סבבה|אחלה|מעולה|טוב|בסדר|כן)[,.!\s]+)*(?:i['’]?m|i am|my name is|this is|אני|שמי|קוראים לי)?\s*[\p{L}'-]{2,20}\s+[\p{L}'-]{2,20}\s*,?\s*(?:בן|בת|גיל|age|aged)?\s*\d{2}(?!\d)\s*[.!]?\s*$/iu.test(input));
    if (namesInDraft) {
      state.phase = 'booking';
      state.requestKey ??= randomUUID();
    }
    if (confirmedOffer) {
      state.phase = 'booking';
      state.requestKey ??= randomUUID();
    }
    const switchesToRental = Boolean(state.interest && explicitBooking(input) && /לשכור|להשכיר|השכרה|rental|rent/i.test(input));
    privateTurn = state.phase === 'booking' && (state.step === 'rental_name' || state.step === 'rental_email');
    const gotPrivate = privateDetail(input, state, (!state.interest || switchesToRental) && explicitBooking(input));
    privateTurn ||= gotPrivate;
    if (state.phase !== 'service' && !state.interest) takeSameReturnAfterTwoAsks(input, state);
    let reading: BotReading | null = null;
    let modelContext: GeminiBotContext | undefined;
    if (!gotPrivate && !resumedIntake && !(state.phase === 'booking' && affirms(input)) && !(state.phase === 'booking' && state.step === 'rental_age' && driverAgeRange(input, state)) && !EMAIL.test(input) && !/(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}/.test(input)) {
      // Give Gemini the current turn's explicit facts and intended intake
      // state, rather than the stale pre-message state. This preview performs
      // no persistence, consent, handoff or request-creation action.
      const modelState = structuredClone(state);
      if (switchesToRental) {
        carryCommercialRentalNeeds(modelState);
        modelState.interest = undefined;
        delete modelState.commercial;
        modelState.phase = 'booking';
      }
      const modelRange = explicitDateRange(input);
      if (modelRange) Object.assign(modelState.booking, modelRange);
      applyExplicitLocations(input, modelState.booking);
      const modelAge = driverAgeRange(input, state);
      if (modelAge) modelState.booking.driverAgeRange = modelAge;
      const modelVehicle = customerVehicleChoice(input, state);
      if (modelVehicle) modelState.booking.vehicleNeed = modelVehicle;
      if (!state.interest && explicitBooking(input)) modelState.phase = 'booking';
      if (modelState.phase === 'booking') modelState.step = bookingStep(nextMissing(modelState.booking));
      modelContext = {
        locale: state.locale, phase: modelState.phase, today: israelDate(),
        recent: state.history.filter(item => !item.private).slice(-8).map(({ from, text }) => ({ from, text: redactServiceReference(text, state.serviceReference) })),
        known: conversationalKnown(modelState),
        approvedFacts: getSmartCarApprovedFacts(state.locale),
        conversation: {
          interest: modelState.interest, handoffDeferred: Boolean(modelState.humanHandoffDeferred) || declinesHumanHandoff(input),
          hasServiceReference: Boolean(state.serviceReference),
          nextMissingField: modelState.phase === 'booking' ? nextMissing(modelState.booking) ?? undefined : undefined,
          step: modelState.step, completedRequest: Boolean(state.completedRequestId),
        },
      };
      reading = await (store.readTurn ?? readBotTurn)(redactServiceReference(input, state.serviceReference), modelContext);
      if (reading) { modelNeedsRepresentative = reading.needsRepresentative === true; modelRoute = reading.route; model = reading.model; if (store.isSimulation) draftNotes.push(`read ${reading.route}/${reading.direction} patches=${JSON.stringify(reading.factPatches ?? []).slice(0, 400)} fields=${JSON.stringify(reading.fields ?? {}).slice(0, 200)}`); applyFields(input, state, reading); }
      // A length said earlier ("לחודש", "for 5 days") gives the return as soon as the start is known, before the reply asks for it.
      if (state.booking.pickupDate && !state.booking.returnDate && !state.interest && state.phase !== 'service') {
        const days = [...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text), input].map(text => statedDurationDays(text.replace(/\b(?:in|ב)\s*(?:january|february|march|april|may|june|july|august|september|october|november|december|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\b/giu, ''))).filter((value): value is number => Boolean(value)).at(-1);
        if (days && days <= 60) { const end = new Date(`${state.booking.pickupDate}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + days); state.booking.returnDate = end.toISOString().slice(0, 10); }
      }
    }
    const statedRange = explicitDateRange(input);
    if (statedRange) Object.assign(state.booking, statedRange);
    const statedDays = statedRange ? Math.round((Date.parse(statedRange.returnDate) - Date.parse(statedRange.pickupDate)) / 86_400_000) : 0;
    const mentionedOneWeek = state.history.some(entry => entry.from === 'customer' && /(?:לשבוע|למשך שבוע|לשבוע אחד|for (?:one |a )week|for one week)/i.test(entry.text));
    // "יש לכם השכרה לחודש? צריך לחודשיים" names monthly rental as a product and two months as the need.
    const mentionedOneMonth = state.history.some(entry => entry.from === 'customer' && /(?:לשכור|השכרה|רכב).{0,20}לחודש(?![\p{L}])|למשך חודש(?![\p{L}])|for (?:one |a )month\b/iu.test(entry.text)
      && !/חודשיים|שלושה חודשים|כמה חודשים|\d\s*חודשים|(?:two|three|\d) months|couple of months/iu.test(entry.text));
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
    if (state.booking.pickupDate && !state.booking.returnDate && !state.interest) {
      const days = statedDurationDays(input);
      if (days && days >= 1 && days <= 60) {
        const returned = new Date(`${state.booking.pickupDate}T00:00:00Z`);
        returned.setUTCDate(returned.getUTCDate() + days);
        state.booking.returnDate = returned.toISOString().slice(0, 10);
      }
    }
    // Home delivery/collection: keep the customer's city (never a street address).
    const customerTexts = [input, ...state.history.filter(entry => entry.from === 'customer' && !entry.private).map(entry => entry.text)];
    const deliveryAsked = customerTexts.some(text => /(?:יביא|יביאו|תביא|תביאו|להביא|לשלוח|תשלחו|למסור|deliver|bring|drop (?:it|the car) (?:off )?at)[^.!?\n]{0,30}(?:בית|הביתה|מלון|משרד|עבודה|דירה|home|house|hotel|office|work|apartment)/iu.test(text) || /עד הבית|לבית שלי|לכתובת|הביתה|מסירה (?:לבית|לכתובת|עד הבית)|(?:תביאו|תביא|להביא|תשלחו)\s+(?:לי\s+|לנו\s+)?(?:את\s+)?(?:ה)?רכב\s+(?:הביתה|לבית|ל[\p{L}])|deliver(?:y)? (?:to )?(?:my )?(?:home|house|address)|bring (?:the )?car to (?:my )?(?:home|house)|deliver (?:it|the car) to\b/iu.test(text));
    const homeCity = customerTexts.map(text => text.match(/(?:^|[\s,])(?:אני|אנחנו|גר(?:ה|ים)?)\s+ב(?!בית)([\p{L}]{2,12}(?:\s+[\p{L}]{2,12})?)(?=[\s,.!?]|$)/u)?.[1]
      ?? text.match(/(?:הביתה|לבית(?:\s+שלי)?|עד הבית)\s+ב?ל?(?!בית)([\p{L}]{2,12}(?:\s+[\p{L}]{2,12})?)(?=[\s,.!?]|$)/u)?.[1]
      ?? text.match(/(?:בית|הביתה|מלון|משרד|עבודה|דירה)(?:\s+(?:שלי|שלנו))?\s+ב(?!בית|סוף|הסוף|בוקר|ערב|צהריים|שבוע|יום|חודש|זמן|דרך|תיאום)([\p{L}]{3,12}(?:\s+[\p{L}]{3,12})?)(?=[\s,.!?]|$)/u)?.[1]
      ?? text.match(/\b(?:home|house|hotel|office|apartment|work)\s+in\s+([\p{L}]{3,15}(?:\s+(?!(?:tomorrow|today|tonight|morning|evening|next|this|on|for|from|at|by|and|please)\b)[\p{L}]{3,15})?)(?=[\s,.!?]|$)/iu)?.[1]?.replace(/\b\p{L}/gu, letter => letter.toUpperCase())
      ?? text.match(/\b(?:deliver|bring)\b[^.!?]{0,30}\bto (?:my )?(?:home|house)? ?in ([A-Z][\p{L}]{2,15}(?:\s+[A-Z][\p{L}]{2,15})?)/u)?.[1]
      ?? text.match(/\b(?:I(?:'m| am)|we(?:'re| are)|I live|we live)\s+in\s+([A-Z][\p{L}]{2,15}(?:\s+[A-Z][\p{L}]{2,15})?)/u)?.[1]).find(Boolean);
    if (deliveryAsked && homeCity && !temporalLocation(homeCity)) {
      state.booking.pickupLocation ??= he ? `מסירה עד הבית (${homeCity})` : `Home delivery (${homeCity})`;
      if (customerTexts.some(text => /(?:יאספו|תאספו|לאסוף|איסוף)\s+(?:אותו|אתו|את הרכב)?\s*מהבית|collect (?:it )?from (?:my )?(?:home|house)|pick (?:it )?up from (?:my )?(?:home|house)/iu.test(text))) {
        state.booking.returnLocation ??= he ? `איסוף מהבית (${homeCity})` : `Collection from home (${homeCity})`;
      }
    }
    // A short answer naming a known branch right after we asked where the car
    // goes back ("back in jerusalem", "גם שם" is handled elsewhere) is that answer.
    const askedReturnPlace = /Where will you return it\?|Where would you like to return|איפה תרצו להחזיר אותו\?|איפה תחזירו|לאן להחזיר/iu.test(lastBotReply);
    const askedPickupPlace = /Where would you like to pick it up\?|מאיפה תרצו לאסוף את הרכב\?/iu.test(lastBotReply);
    const namedBranch = input.match(/(?:^|[\s,.])(?:back\s+)?(?:in|at|to|from|[במל])?\s*(the airport|airport|ben gurion(?: airport)?|tlv|natbag|herzliya|tel aviv|jerusalem|נתב["״׳']?ג|שדה התעופה|הרצליה|תל אביב|ירושלים)(?![\p{L}])/iu)?.[1];
    const backTo = input.match(/\b(?:back|return(?:ing)? it|drop(?:ping)? it off|drop(?:ping)? off)\s+(?:to|in|at)\s+(the airport|airport|ben gurion(?: airport)?|tlv|herzliya|tel aviv|jerusalem)\b|(?:וחזרה|חזרה|ולהחזיר|להחזיר|ונחזיר)\s+(?:ל|ב)(נתב["״׳']?ג|הרצליה|תל אביב|ירושלים)(?![\p{L}])/iu);
    if (backTo && !state.booking.returnLocation && !/\bwhat if\b|\bif\b|מה אם|(?:^|\s)אם\s/iu.test(input)) {
      const named = backTo[1] ?? backTo[2];
      const key = /air|ben gurion|tlv|נתב/iu.test(named) ? 'airport' : /herz|הרצ/iu.test(named) ? 'herzliya' : /tel aviv|תל אביב/iu.test(named) ? 'telaviv' : 'jerusalem';
      state.booking.returnLocation = he ? { airport: 'נתב״ג', herzliya: 'הרצליה', telaviv: 'תל אביב', jerusalem: 'ירושלים' }[key] : { airport: 'Ben Gurion Airport', herzliya: 'Herzliya', telaviv: 'Tel Aviv', jerusalem: 'Jerusalem' }[key];
    }
    if (namedBranch && input.length <= 120 && !/\bwhat if\b|\bif\b|\bmaybe\b|מה אם|(?:^|\s)אם\s|אולי/iu.test(input)) {
      const he = state.locale === 'he';
      const key = /air|ben gurion|tlv|natbag|נתב|שדה/iu.test(namedBranch) ? 'airport' : /herz|הרצ/iu.test(namedBranch) ? 'herzliya' : /tel aviv|תל אביב/iu.test(namedBranch) ? 'telaviv' : 'jerusalem';
      const label = he ? { airport: 'נתב״ג', herzliya: 'הרצליה', telaviv: 'תל אביב', jerusalem: 'ירושלים' }[key] : { airport: 'Ben Gurion Airport', herzliya: 'Herzliya', telaviv: 'Tel Aviv', jerusalem: 'Jerusalem' }[key];
      if (askedReturnPlace && !state.booking.returnLocation) state.booking.returnLocation = label;
      else if (askedPickupPlace && !state.booking.pickupLocation) state.booking.pickupLocation = label;
    }
    // Normalise lower-case known branch names typed by customers.
    for (const field of ['pickupLocation', 'returnLocation'] as const) {
      const value = state.booking[field];
      if (value && /^(?:jerusalem|herzliya|tel aviv)$/u.test(value)) state.booking[field] = value.replace(/\b\p{Ll}/gu, letter => letter.toUpperCase());
    }
    if (state.booking.pickupDate && state.booking.returnDate) delete state.booking.datePreference;
    applyPromptedLocation(input, state, lastBot, pendingFieldAtTurnStart);
    if (/אותו מקום|שם גם|same place|same location|return there|drop.?off there/i.test(input) || explicitSameReturn(input)) state.booking.returnLocation = sameReturnLabel(state);
    if (!state.booking.returnLocation && state.booking.pickupLocation && /להחזיר גם ב|לאסוף את הרכב גם מהבית|Return it to .{2,30} as well\?|collect the car from the same place/u.test(lastBot) && /^\s*(?:כן|בטח|ברור|נכון|בדיוק|אותו דבר|yes|yep|yeah|sure|correct|right)(?![\p{L}])/iu.test(input) && !/להחזיר|החזרה|לאסוף|תאספו|איסוף|return|collect|pick/iu.test(input)) state.booking.returnLocation = sameReturnLabel(state);
    const statedAgeRange = driverAgeRange(input, state);
    if (statedAgeRange) state.booking.driverAgeRange = statedAgeRange;
    const declines = /לא רוצה להזמין|לא מבקש להזמין|אל תזמין|לא עכשיו|רק מתעניין|עדיין בודק|don't book|cancel this request|not ready to book|just looking/i.test(input);
    const modelSupportedProceed = reading?.route === 'book' && /^(?:כן|יאללה|בוא|בואי|yes|okay|ok|go ahead|let's proceed)/i.test(input)
      && /להתחיל.{0,25}(?:בקשה|הזמנה)|start.{0,25}(?:request|booking)/i.test(lastBot);
    // The current model interpretation can correct an implicit invitation
    // match. A saved intake phase must not overrule existing-service meaning.
    const serviceInterpretation = reading?.route === 'service' && reading.groundedContext === true;
    const acceptsRentalOffer = confirmedOffer && !serviceInterpretation;
    const declinesHuman = declinesHumanHandoff(input);
    const asksHuman = !declinesHuman && !/(?:^|\s)ו?אם\s+(?:לא\s+)?(?:ש?מישהו\s+)?(?:יחזרו|תחזרו|יחזור|יתקשרו|תתקשרו|יתקשר)|\bif (?:no one|nobody|you don['’]?t|you do not)\b/iu.test(input) && /(?:^|[\s,.!])(?:ש|ש?מישהו\s+|שנציג\s+)?(?:יחזרו|תחזרו|יחזור|יתקשרו|תתקשרו|יתקשר)\s+(?:אליי|אלי|אליי?נו|לי)(?![\p{L}])|\b(?:have|get) (?:someone|somebody|a (?:rep|representative|person)) (?:to )?call me\b|\b(?:can|could|would|will) (?:someone|somebody|a (?:rep|representative|person)|you(?: guys)?) (?:please )?(?:call|phone|ring) me\b|\bcall me back\b|\bplease call me\b|(?:אפשר ש|יכול |שמישהו |מישהו (?:יכול )?)(?:להתקשר|יתקשר|לחזור|יחזור)\s+(?:אליי|אלי)(?![\p{L}])|(?:רוצה|אפשר|צריך|צריכה).{0,22}(?:לדבר|נציג|בן אדם)|(?:לדבר|נציג|בן אדם).{0,22}(?:בבקשה|אפשר|רוצה)|\b(?:speak|talk|connect)\b.{0,28}\b(?:human|representative|person)\b|\bpass (?:it|this|me|them) (?:on )?to (?:someone|somebody|a (?:rep|representative|person|human))\b|(?:תעביר|תעבירו|העבירו)\s+(?:את זה\s+|אותי\s+)?(?:ל)?(?:מישהו|נציג|בן אדם)|\b(?:human|representative|real person)\b.{0,20}\b(?:please|help)\b/iu.test(input);
    // A model's human-route classification is not consent. Require an actual
    // callback request or acceptance of a preceding representative invitation.
    const modelHumanConsent = !declinesHuman
      && (reading?.route === 'human' && /call (?:me|us) back|תחזרו אלי|שיחזרו אלי/i.test(input)
        || affirms(input) && offersHumanHandoff(lastBot));
    const clearlyRental = /לשכור|להשכיר|השכרה|rental|rent/i.test(input);
    const leaveVehicleOpen = /(?:leave|keep).{0,30}(?:vehicle|car).{0,30}(?:open|undecided)|(?:not|don'?t).{0,30}(?:choose|decide).{0,30}(?:vehicle|car)|לא (?:בחרתי|בחרנו|החלטתי|החלטנו).{0,20}(?:סוג|קבוצת).{0,8}רכב/iu.test(input);
    const wantsToContinueRental = !state.interest && (/^(?:אני רוצה להתקדם|רוצה להתקדם|בוא(?:ו)? נתקדם|I want to proceed|let'?s continue)[.!\s]*$/i.test(input)
      || /\b(?:let'?s|let us) continue\b|(?:^|[.!?]\s*|\s)(?:תתקדם|תתקדמו|תמשיכו)\s+עם (?:מה שיש|הפרטים|זה)/i.test(input))
      && Boolean(state.booking.pickupDate || state.booking.vehicleNeed || state.booking.passengers || offersRentalRequest(lastBot));
    const wantsBooking = !declines && !asksHuman && !modelHumanConsent && ((explicitBooking(input) && (!state.interest || clearlyRental)) || modelSupportedProceed || !serviceInterpretation && (acceptsRentalOffer || wantsToContinueRental || state.phase === 'booking'));
    const rentalPivot = /מעדיף (?:את ה)?השכרה|מעדיף לשכור|עדיף לי לשכור|אעדיף לשכור|חוזר להשכרה|רוצה לשכור במקום|prefer (?:a )?rental|prefer to rent|back to renting/i.test(input);
    const specificProblem = /חויבתי|חיוב כפול|חיוב שגוי|שילמתי פעמיים|תקלה בהזמנה|(?:רכב|הרכב).{0,35}מלוכלך|לא קיבלתי|(?:מזגן|מיזוג).{0,25}(?:לא עובד|מקולקל)|(?:air conditioning|car ac).{0,25}(?:not working|broken)|double charg|charged twice|wrong charge|billing issue|dirty car|booking problem/i.test(input)
      // "What happens if the car is dirty?" is a question about policy, not a reported problem.
      && !/מה (?:קורה|עושים|יקרה) אם|what (?:happens|do i do|if)|(?:^|\s)אם\s|\bif\b/iu.test(input);
    const statedVehicle = customerVehicleChoice(input, state);
    if (acceptsRentalOffer && !state.booking.vehicleNeed) {
      const offeredVehicle = explicitVehicleNeed(lastBot, state.locale);
      if (offeredVehicle) state.booking.vehicleNeed = offeredVehicle;
    }
    const commercialVehicle = reading?.route === 'sale' || reading?.route === 'leasing' || /ליסינג|לקנות|למכירה|לרכישה|מוכרים רכבים|יד (?:2|שנייה|שתיים)|משומש|buy|purchase|leasing|used car/iu.test(input);
    if (statedVehicle && (wantsBooking || state.phase === 'booking' || !commercialVehicle && !state.interest)
      && (!state.booking.vehicleNeed || /^רכב (?:לנוסע אחד|ל־\d+ נוסעים)|^car for \d+ passengers?/i.test(state.booking.vehicleNeed)
        || /בעצם|מעדיף|במקום|החלטתי על|החלטנו על|בוחר|בוחרת|actually|instead|prefer/i.test(input))) state.booking.vehicleNeed = statedVehicle;
    // "רגע, אפשר במקום זה רכב משפחתי?" switches the chosen category; the model's reading names the new one.
    if (state.booking.vehicleNeed && !statedVehicle && reading?.direction && reading.direction !== 'none' && !state.interest && state.phase !== 'service' && !commercialVehicle
      && /במקום|בעצם|נחליף|להחליף|תחליף|instead|switch|change (?:it |that )?to|rather|actually/iu.test(input) && !/מה (?:ההבדל|יותר)|difference|compare|which is better/iu.test(input)) {
      const current = /שבעה מקומות|seven.?seat/i.test(state.booking.vehicleNeed) ? 'seven_seat' : /רכב פנאי|\bSUV\b/i.test(state.booking.vehicleNeed) ? 'suv' : /משפחתי|family/i.test(state.booking.vehicleNeed) ? 'family' : /קומפקטי|compact/i.test(state.booking.vehicleNeed) ? 'compact' : 'other';
      if (current !== reading.direction) state.booking.vehicleNeed = (he ? { compact: 'רכב קומפקטי', family: 'רכב משפחתי', suv: 'רכב פנאי', seven_seat: 'רכב שבעה מקומות' } : { compact: 'compact car', family: 'family car', suv: 'SUV', seven_seat: 'seven-seat car' })[reading.direction];
    }
    // "משהו חסכוני, אני נוסע הרבה" answering the car question: the model's category reading is the choice.
    if (!state.booking.vehicleNeed && !statedVehicle && reading?.direction && reading.direction !== 'none' && !state.interest && state.phase !== 'service' && !commercialVehicle
      && !/[?؟]/u.test(input) && (reading.direction === 'compact' && /חסכוני|חיסכון בדלק|economical|fuel.?efficient|good on fuel/iu.test(input) || /קבוצת רכב|איזה רכב|איזה סוג רכב|סוג רכב|קומפקטי|משפחתי|vehicle (?:category|group)|car (?:category|group)|which car|what (?:kind of |type of )?car/iu.test(lastBot))) {
      const names = he ? { compact: 'רכב קומפקטי', family: 'רכב משפחתי', suv: 'רכב פנאי', seven_seat: 'רכב שבעה מקומות' } : { compact: 'compact car', family: 'family car', suv: 'SUV', seven_seat: 'seven-seat car' };
      state.booking.vehicleNeed = names[reading.direction];
    }
    if (rentalPivot || switchesToRental) { carryCommercialRentalNeeds(state); state.interest = undefined; delete state.commercial; }
    // A purchase customer asking about financing stays a purchase enquiry unless they name leasing.
    else if (/ליסינג|leasing/i.test(input) || reading?.route === 'leasing' && state.interest !== 'sale') state.interest = 'leasing';
    else if (reading?.route === 'sale' || state.phase !== 'booking' && /נסיעת מבחן|test drive/i.test(input) || /לקנייה|למכירה|רכב לקנות|רוצה לקנות|לקנות (?:את ה)?רכב|(?:מוכרים|מוכרות|מוכר) (?:גם )?רכבים|רכב יד (?:2|שתיים|שנייה)|יד (?:2|שתיים|שנייה)(?![\p{L}\d])|רכב משומש|buy(?:ing)? (?:a |the )?(?:used |new )?(?:family |compact |small |suv )?(?:car|vehicle)|purchas(?:e|ing) (?:a |the )?car|car for sale|used car/iu.test(input)) state.interest = 'sale';
    if (state.interest) {
      if (!state.commercial) {
        state.commercial = {};
        for (const entry of state.history) if (entry.from === 'customer') state.commercial = updateCommercialMemory(state.commercial, entry.text);
      }
      state.commercial = updateCommercialMemory(state.commercial, input);
      applyPromptedMileage(input, state);
    }
    applySelectedFacts(input, state, reading, wantsBooking);
    if (leaveVehicleOpen && !state.interest && state.phase !== 'service') state.booking.vehicleNeed = he ? 'סוג רכב פתוח להתאמה' : 'vehicle group to be matched';
    const completedRouteInCurrentTurn = Boolean(statedRange && state.booking.pickupLocation && state.booking.returnLocation);
    // Approximate/unknown timing is a fallback for a short date answer, not a
    // pre-model route. A service/refund/correction message must reach Gemini
    // even when an old draft happens to contain an undecided-date marker.
    const dateFallback = !gotPrivate && !state.interest && state.phase !== 'service' && !serviceInterpretation && reading?.route !== 'policy'
      && input.length <= 90 && input.split(/\s+/).length <= 12 && !/[?؟]/u.test(input)
      && !getSmartCarServiceAnswer(input, state.locale);
    if (durationMismatch) {
      reply = mentionedOneMonth
        ? (he ? 'ציינת השכרה לחודש, אבל התאריכים ששלחת הם לתקופה אחרת. אלה התאריכים הרצויים?' : 'You mentioned a month-long rental, but the dates you sent cover a different period. Are those the dates you want?')
        : (he ? 'ציינת נסיעה של כשבוע, אבל התאריכים ששלחת הם לתקופה ארוכה יותר. אלה התאריכים הרצויים?' : 'You mentioned a trip of about a week, but the dates you sent cover a longer period. Are those the dates you want?');
    } else if (dateFallback && uncertainDateAnswer(input)
      && (hasUndecidedRentalDates(input) || wasBooking && state.step === 'rental_dates' || asksRentalDates(lastBot))) {
      reply = he ? 'אין בעיה. כשתדעו את התאריכים המדויקים, כתבו אותם כאן ונוכל להמשיך מהפרטים שכבר מסרתם.' : 'No problem. When you know the exact dates, send them here and we can continue with the details you already shared.';
    } else if (dateFallback && vagueDateAnswer(input) && (!state.booking.pickupDate || !state.booking.returnDate)) {
      const timing = input.match(VAGUE_DATE_PHRASE)?.[0];
      state.booking.datePreference = [state.booking.datePreference, timing].filter(Boolean).join(' עד ').slice(0, 120);
      const clarifiedAlready = state.history.some(entry => entry.from === 'bot' && /באילו תאריכים מדויקים|מאיזה יום ועד איזה יום|כשתדעו את התאריכים המדויקים|which exact pickup and return dates|which day would you like to pick it up|when you know the exact dates/i.test(entry.text));
      reply = clarifiedAlready
        ? (he ? 'הבנתי את הטווח המשוער. כשתדעו את התאריכים המדויקים, כתבו אותם כאן ונמשיך.' : 'I understand the approximate timing. Send the exact dates here when you know them and we can continue.')
        : (he ? 'בשמחה. מאיזה יום ועד איזה יום תצטרכו את הרכב?' : 'Sure. Which day would you like to pick it up, and when will you bring it back?');
    } else if (completedRouteInCurrentTurn && state.phase === 'explore' && !state.interest && !explicitBooking(input)
      && (!/[?؟]/u.test(input) || !reading?.groundedContext)) {
      const stroller = /עגלה|stroller|pushchair/i.test(input)
        || state.history.some(entry => entry.from === 'customer' && /עגלה|stroller|pushchair/i.test(entry.text));
      const childSeatNote = state.booking.childSeats
        ? (he ? ` בקשת כיסא הבטיחות נשמרה ונבדוק את זמינותו והתאמתו לדגם${stroller ? ', יחד עם מקום לעגלה' : ''}.` : ` Your child-seat request is noted; we will check availability and fit for the specific car${stroller ? ', including space for the stroller' : ''}.`)
        : '';
      const luggageNote = state.booking.luggage
        ? (he ? ` ל־${state.booking.passengers ?? ''} נוסעים ו־${state.booking.luggage} מזוודות${stroller ? ' ועגלה' : ''}, נוודא מקום בדגם המסוים.` : ` For ${state.booking.passengers ?? 'your group'} travellers and ${state.booking.luggage} suitcases${stroller ? ' and a stroller' : ''}, we will verify space in the specific model.`)
        : '';
      const sideAnswer = /[?؟]/u.test(input) ? getSmartCarServiceAnswer(input, state.locale)?.reply : undefined;
      reply = he
        ? `הבנתי את תאריכי האיסוף וההחזרה, מאיסוף ב${state.booking.pickupLocation} להחזרה ב${state.booking.returnLocation}.${childSeatNote}${luggageNote} זמינות והצעה מדויקת נבדוק לפני אישור. תרצו שנתחיל בקשה?`
        : `I have the pickup and return dates, from ${state.booking.pickupLocation} to ${state.booking.returnLocation}.${childSeatNote}${luggageNote} We will check availability and an exact quote before confirmation. Would you like to start a request?`;
      if (sideAnswer) reply = `${sideAnswer} ${reply}`;
    } else if (declines) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'בסדר, לא שלחתי בקשה. הפרטים יישארו כאן אם תרצה להמשיך להתלבט.' : 'Okay, I have not sent a request. The details stay here if you want to think it over.';
    } else if (rentalPivot && !switchesToRental) {
      state.phase = 'explore'; state.step = 'menu';
      if (uncertainDateAnswer(input) || state.booking.datePreference) {
        state.booking.datePreference = he ? 'התאריכים עדיין פתוחים' : 'dates still open';
        reply = he ? 'הבנתי, נבדוק השכרה במקום ליסינג. התאריכים נשארים פתוחים ולא נשלחה בקשה; אפשר להמשיך לברר כאן עד שתהיו מוכנים.' : 'Understood, we will check rental instead of leasing. The dates remain open and no request was sent; we can keep discussing it here until you are ready.';
      } else reply = he ? 'הבנתי, נחזור לבדוק השכרה. לתקופה שתבחר חשוב להתאים רכב וקילומטראז׳ למסלול; באילו תאריכים תרצה לאסוף ולהחזיר?' : 'Understood, let us check a rental. The vehicle and mileage terms should fit the period you choose. What pickup and return dates do you need?';
    } else if (specificProblem) {
      state.phase = 'service'; state.step = 'menu'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue'; escalate = true;
      reply = he ? `מצטערים לשמוע. העברתי את זה עכשיו לנציג SmartCar והוא יחזור אליכם. אם זה דחוף, התקשרו ל־${OFFICE_PHONE}.` : `Sorry to hear that. I have passed this to a SmartCar representative now and they will get back to you. If it is urgent, call ${OFFICE_PHONE}.`;
    } else if (declinesHuman && state.interest && !clearlyRental) {
      state.humanHandoffDeferred = true;
      const undecidedVehicle = /לא בחרתי|לא החלטתי|אין לי העדפה|not chosen|not decided|(?:keep|leave).{0,35}open/i.test(input);
      if (undecidedVehicle) delete state.booking.vehicleNeed;
      const asksCommercialQuestion = /[?؟]|הבדל|מול|מה כלול|what.*included/i.test(input);
      reply = asksCommercialQuestion ? commercialReply(input, state).reply : he
        ? `בסדר, נמשיך להשוות כאן בקצב שלכם.${undecidedVehicle ? ' סוג הרכב נשאר פתוח עד שתחליטו.' : ''} אפשר לשאול כאן על ההבדלים בין האפשרויות.`
        : `Of course. We can keep comparing here at your pace.${undecidedVehicle ? ' The vehicle type stays open until you decide.' : ''} You can ask about the differences between the options here.`;
    } else if (/את[ה]? סוגר(?:ת)? לי רכב|סוגר(?:ת)? לי (?:את ה)?רכב|האם (?:זה|הרכב) (?:כבר )?סגור|are you booking (?:me |the )?(?:a )?car|is (?:the )?car booked/i.test(input)) {
      reply = he ? 'אפשר להכין בקשת השכרה עם הפרטים שלך. הרכב והמחיר יאושרו לפני שההזמנה תהיה סופית. תרצה שנתקדם לבקשה?' : 'We can prepare a rental request with your details. The car and price are confirmed before the booking becomes final. Would you like to proceed with the request?';
    } else if (wantsBooking) {
      if (state.phase !== 'booking') state.serviceChangeRequested = false;
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
      const asksModelGuarantee = /דגם מדויק|דגם מסוים|דגם ספציפי|הדגם (?:המדויק|המסוים|הספציפי)|רק (?:ה)?(?:קבוצה|קטגוריה)|exact model|specific model|particular model|car group|vehicle group|just (?:the |a )?(?:group|category)/i.test(input)
        && /מובטח|מבטיח|הבטחה|בוודאות|guarantee|guaranteed|only|just (?:the |a )?(?:group|category)|רק (?:ה)?(?:קבוצה|קטגוריה)/i.test(input);
      if (asksModelGuarantee) {
        reply = `${he ? 'סוג הרכב או הדגם המועדף נרשמים כבקשה. דגם מסוים אינו מובטח אלא אם SmartCar מאשרת אותו במפורש; את הרכב, הזמינות והתנאים נוודא לפני אישור ההשכרה.' : 'The vehicle group or preferred model is recorded as a request. An exact model is not guaranteed unless SmartCar explicitly confirms it; the car, availability and terms will be checked before rental confirmation.'} ${missing ? question(missing, state.locale) : summary(state)}`;
      } else if (openVehicleChoice) {
        state.booking.vehicleNeed = he ? `רכב לנוסע אחד; סוג הרכב ייקבע לפי התאמה` : 'car for one person; vehicle group to be matched';
        const next = nextMissing(state.booking);
        state.step = bookingStep(next);
        reply = he ? `אין בעיה, נשאיר את הבחירה פתוחה ונציין שהרכב מיועד לאדם אחד. ${next ? question(next, state.locale) : summary(state)}` : `No problem. We can leave the car group open and note that it is for one person. ${next ? question(next, state.locale) : summary(state)}`;
      } else if (asksVehicleAdvice && state.booking.passengers === 1) {
        state.step = 'rental_vehicle';
        reply = he ? 'לנסיעה לבד הייתי מתחיל ברכב קומפקטי: נוח לנסיעה ולחניה. אם חשוב לך יותר מקום, אפשר לבדוק גם משפחתית. תרצה שאציין רכב קומפקטי בבקשה, או להשאיר את הסוג פתוח?' : 'For one person I would start with a compact car, which is easier to drive and park. If you prefer more space, we can check a family car. Should I put a compact car on the request or leave the group open?';
      } else if (!missing && state.booking.childSeats === 0 && /כיסא(?:ות)? בטיחות|child seats?|car seats?/i.test(input)) {
        reply = `${he ? 'בקשת כיסא הבטיחות הוסרה מהטיוטה ומהסיכום. יתר הפרטים שמסרתם נשמרו; הבקשה טרם נשלחה.' : 'The child-seat request has been removed from the draft and summary. Your other details are retained; the request has not been sent.'}\n\n${summary(state)}`;
      } else if (!missing && /כיסא(?:ות)? בטיחות|child seats?|car seats?/i.test(input)) {
        reply = `${he ? 'כיסא הבטיחות הוא בקשה בלבד, לא הבטחה. נבדוק זמינות, תנאים והתאמה לרכב המסוים לפני אישור ההשכרה. הבקשה טרם נשלחה; הנה הסיכום המעודכן לאישורכם.' : 'The child seat is a request only, not a guarantee. Availability, terms and fit for the specific car must be checked before rental confirmation. Your request has not been sent yet; here is the updated summary for your approval.'}\n\n${summary(state)}`;
      } else if (!missing) {
        const policy = getSmartCarServiceAnswer(withoutCoverageQuestionHazards(input), state.locale);
        reply = policy?.topic === 'insurance' && /[?؟]/u.test(input)
          ? `${policy.reply}\n\n${summary(state)}` : summary(state);
      }
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
    } else if (modelHumanConsent || asksHuman) {
      state.humanHandoffDeferred = false;
      state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = state.interest ? 'commercial' : 'human'; escalate = true;
      reply = state.interest
        ? (he ? `בשמחה, נציג SmartCar יחזור אליכם לגבי ${state.interest === 'sale' ? 'רכישת הרכב' : 'הליסינג'}. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Of course. A SmartCar representative will follow up about your ${state.interest === 'sale' ? 'car purchase' : 'leasing'} enquiry. You can also call ${OFFICE_PHONE}.`)
        : (he ? `בשמחה, נציג SmartCar יחזור אליכם. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `Of course. A SmartCar representative will follow up. You can also call ${OFFICE_PHONE}.`);
    } else if (state.phase === 'service' || reading?.route === 'service' || state.phase !== 'booking' && Boolean(explicitServiceReference(input)) || /הזמנה קיימת|ההזמנה שלי|שכרתי|existing booking|my booking|I rented|יש לי (?:כבר )?הזמנה|הזמנתי (?:אצלכם|מכם|רכב)|\bI (?:have|made) a (?:booking|reservation)\b|\bI booked\b|\bmy (?:car |rental )?(?:booking|reservation)\b|אני עם (?:ה)?רכב (?:שלכם|שלקחתי)|הרכב שלכם (?:אצלי|איתי)|(?:לקחתי|אספתי) (?:מכם|אצלכם) רכב|\bI (?:have|got) (?:your|a) (?:car|rental) (?:from you|right now|now)\b|\bI(?:'m| am) (?:in|driving) your car\b/i.test(input)) {
      state.phase = 'service';
      const booking = await store.activeBooking(phone);
      const answer = getSmartCarServiceAnswer(input, state.locale);
      const cancellationPending = state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text));
      // The reference was parsed and retained once above, including natural
      // punctuation. Re-parsing here creates conflicting workflow decisions.
      const suppliedReference = Boolean(state.serviceReference);
      const insistsOnOffer = /^(?:yes|yeah|yep|כן|נכון)(?=[,!.\s])[,!.\s]+(?:that['’]?s (?:literally |exactly )?what I (?:just )?(?:asked|said|want(?:ed)?)|I (?:already|just) (?:asked|said)|זה (?:בדיוק )?מה ש(?:ביקשתי|אמרתי)|כבר ביקשתי)/iu.test(input);
      const leadingYes = /^(?:כן|yes|yeah|yep|ok(?:ay)?|אוקיי?|בטח|סבבה|יאללה|sure)(?=[\s,.!]|$)/iu.test(input.trim()) && !/(?:^|\s)(?:לא|אל)\s|\bnot\b|\bdon['’]?t\b|(?:^|\s)אם\s|\bif\b/iu.test(input);
      // The offer may be two turns back when a side question came in between ("ואם אני מחזיר בלי דלק?").
      const recentChangeOffer = offersServiceChangeReview(lastBot)
        || /תבדקו|תבדוק|תבדקי|בדקו לי|check (?:it|that|for me)|go ahead|please do/iu.test(input)
          && state.history.filter(entry => entry.from === 'bot').slice(-3).some(entry => offersServiceChangeReview(entry.text));
      const acceptsChangeReview = (affirms(input) || insistsOnOffer || leadingYes || /^(?:okay|ok)[.!?\s]*$/i.test(input) || /^(?:כן[,\s]*)?(?:תבדקו|תבדוק|בדקו)(?:\s+לי)?/iu.test(input.trim())) && recentChangeOffer && !advisoryRentalChange(input);
      // "כן תבדקו לי, הזמנה 771204" after an extension discussion asks for the check even without an explicit offer.
      const asksToCheckChange = /(?:^|[\s,])(?:תבדקו|תבדוק|תבדקי|בדקו)(?:\s+לי|\s+את זה)?(?![\p{L}])|\b(?:please )?check (?:it|that|for me)\b|\bgo ahead and check\b/iu.test(input)
        && !/(?:^|\s)(?:לא|אל)\s+תבדק|\bdon['’]?t check\b/iu.test(input)
        && state.history.some(entry => entry.from === 'customer' && mentionsRentalChange(entry.text));
      if (rentalChangeRequest(input) || acceptsChangeReview || asksToCheckChange) state.serviceChangeRequested = true;
      const changePending = state.serviceChangeRequested === true;
      const changeDiscussion = mentionsRentalChange(input) || state.history.some(entry => entry.from === 'customer' && mentionsRentalChange(entry.text));
      const directChangeVerb = /לקצר|קיצור|תקצרו|shorten|לשנות|לשינוי|להאריך|לדחות|לדחייה|להקדים|להזיז|יום ההחזרה|יום מאוחר|change|extend|postpone|move (?:the )?return|return date/i.test(input);
      // A known reference is a fact, not consent to a hypothetical change.
      // This narrow deferral boundary does not infer every service intent.
      const advisoryChange = advisoryRentalChange(input);
      const prePickupMove = /להזיז|לדחות|להקדים|להעביר (?:את )?(?:ה)?(?:תאריכים|מועד)|לשנות (?:את )?(?:ה)?(?:תאריכים|מועד(?:ים)?|תאריך)|\b(?:move|postpone|reschedule|bring forward|change the dates)\b/iu.test(input)
        && !/להאריך|הארכה|יום נוסף|עוד יום|לקצר|\bextend|extension|extra day|shorten/iu.test(input) && !state.history.some(entry => entry.from === 'customer' && /אני עם הרכב|כבר (?:לקחתי|אספתי)|I (?:have|picked up) the car/iu.test(entry.text));
      if (!cancellationPending && !changePending && changeDiscussion && prePickupMove) {
        policyLocked = true;
        reply = he ? `אפשר לבקש להזיז את מועדי ההזמנה. לפי תנאי ההשכרה, שינוי תאריכים בלי חיוב נוסף אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות ולאישור SmartCar. ${suppliedReference ? 'לאילו תאריכים תרצו להזיז?' : 'מה מספר ההזמנה, ולאילו תאריכים תרצו להזיז?'}`
          : `You can ask to move the booking dates. Under the rental terms, date changes are free up to 48 hours before pickup, subject to availability and SmartCar confirmation. ${suppliedReference ? 'Which dates would you like instead?' : 'What is the booking number, and which dates would you like instead?'}`;
      } else if (!cancellationPending && !changePending && changeDiscussion) {
        reply = answer?.reply ?? (he ? 'אפשר לבקש הארכה. היא כפופה לזמינות ולאישור SmartCar, ועד לאישור מפורש מועד ההחזרה המקורי מחייב והמחיר עשוי להשתנות. תרצו שנבדוק את ההארכה עבורכם?' : 'You can ask for an extension. It is subject to availability and SmartCar confirmation; until explicitly approved, the original return deadline remains binding and the price may change. Would you like us to check the extension for you?');
      } else if (!cancellationPending && changePending && advisoryChange) {
        reply = he ? 'אפשר לברר על הארכה בלי להגיש בקשת שינוי כרגע. הארכה כפופה לזמינות, לתנאים ולאישור SmartCar; עד לאישור, מועד ההחזרה הקיים נשאר בתוקף והמחיר עשוי להשתנות.' : 'We can discuss an extension without submitting a change request now. An extension depends on availability, terms and SmartCar confirmation; until confirmed, the current return deadline remains in effect and the price may change.';
      } else if (!cancellationPending && changePending && !directChangeVerb && !suppliedReference && !booking) {
        reply = he ? 'אפשר לבדוק בקשה להארכה; היא כפופה לזמינות ולאישור, וגם המחיר עשוי להשתנות. מה מספר ההזמנה?' : 'We can review an extension request; it is subject to availability and confirmation, and the price may change. What is your booking reference?';
      } else if (!cancellationPending && changePending) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'booking_change'; escalate = true;
        reply = /אושר|אישור|מחיר|עלות|תשלום|מחייב|חיוב|ההצעה|approv|confirm|price|cost|charge|rate|quote|offer/i.test(input)
          ? (he ? 'קיבלנו את בקשת השינוי לבדיקה. השינוי עדיין לא אושר, ועד לאישור מפורש מועד ההחזרה הקיים נשאר בתוקף. המחיר המעודכן ייבדק לפני אישור השינוי ואינו מובטח כמחיר המקורי.' : 'We have received your change request for review. It is not approved yet; until explicitly confirmed, the existing return deadline remains in effect. The updated rental price will be checked before the change is confirmed and is not guaranteed to match the original daily rate.')
          : he ? `קיבלנו את בקשת השינוי. היא תיכנס לתוקף לאחר בדיקת זמינות ואישור SmartCar. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have your change request. It takes effect after SmartCar checks availability and confirms it. For immediate help call ${OFFICE_PHONE}.`;
      } else if (specificProblem || suppliedReference && !depositEnquiry && (cancellationPending || !serviceQuestion && !advisoryChange)) {
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = cancellationPending ? 'booking_change' : 'service_issue'; escalate = true;
        reply = cancellationPending
          ? (he ? `קיבלנו את מספר ההזמנה לבקשת הביטול. נציג SmartCar יחזור אליכם; הביטול תקף רק לאחר אישור. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `We have the reference for your cancellation request. A SmartCar representative will follow up; cancellation takes effect only after confirmation. For immediate help call ${OFFICE_PHONE}.`)
          : (he ? `מצטערים לשמוע. העברתי את זה עכשיו לנציג SmartCar והוא יחזור אליכם. אם זה דחוף, התקשרו ל־${OFFICE_PHONE}.` : `Sorry to hear that. I have passed this to a SmartCar representative now and they will get back to you. If it is urgent, call ${OFFICE_PHONE}.`);
      } else if (/מקדמה|advance payment|pay.{0,30}deposit|payment.{0,25}(?:arrived|received)/i.test(input)) reply = he
        ? 'מקדמה היא תשלום מראש, והפיקדון באיסוף הוא חסימה זמנית בכרטיס אשראי לפי תנאי ההסכם. אי אפשר לבצע תשלום או לאשר קבלת כסף בשיחה הזאת. אין לשלוח מספר כרטיס מלא או קוד אבטחה; לביצוע או לבירור תשלום יש להשתמש בערוץ התשלום הרשמי של SmartCar.'
        : 'An advance payment and the temporary credit-card security hold at pickup are separate. Their terms are set in the agreement. This chat does not process payments or verify receipt of money. Do not send a full card number or security code; use SmartCar’s official payment channel to pay or check receipt.';
      else if (answer) reply = answer.reply;
      else if (suppliedReference) reply = /^(?:תודה(?: רבה)?|thanks?|thank you)[.!\s]*$/i.test(input)
        ? (he ? 'בשמחה. מספר ההזמנה שמסרת נשמר בפנייה.' : 'You are welcome. The booking reference you supplied is saved in the enquiry.')
        : (he ? 'מספר ההזמנה שמסרת נשמר בפנייה. הוא לא מאמת את מצב ההזמנה או התשלום; אפשר להמשיך לברר כאן, וביצוע שינוי מחייב אישור SmartCar.' : 'The booking reference you supplied is saved in the enquiry. It does not verify booking or payment status; we can keep discussing your question here, and any change requires SmartCar confirmation.');
      else if (booking) reply = he ? `מצאתי את ההזמנה שלכם. לבירור או לשינוי נשמח לעזור בטלפון ${OFFICE_PHONE}.` : `I found your booking. For details or changes, we will be happy to help at ${OFFICE_PHONE}.`;
      else if (!/[?؟]/u.test(input) && input.length >= 8 && /מספר ההזמנה|השם ש?על ההזמנה|booking (?:number|reference)|name on the booking/iu.test([...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '')) {
        // We asked for the booking number or the name and the customer answered with what they have.
        // A representative takes it from here instead of asking for the number again.
        state.handedOff = true; state.handoffAt = new Date().toISOString(); state.handoffKind = 'service_issue'; escalate = true;
        reply = he ? `תודה, העברתי את הפרטים לנציג SmartCar שיבדוק ויחזור אליכם. לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `Thank you — I have passed the details to a SmartCar representative, who will check and get back to you. For immediate help call ${OFFICE_PHONE}.`;
      }
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
    } else if (asksRentalAgeTerms(input) && /deposit|פיקדון/i.test(input)) {
      const ageTerms = getSmartCarApprovedFacts(state.locale).find(fact => fact.id === 'age_licence')!.text;
      reply = `${ageTerms} ${he ? 'בגיל נהג צעיר המחיר ותנאי הביטוח עשויים להשתנות לפי הרכב. באיסוף נדרש כרטיס אשראי תקף על שם השוכר; סכום הפיקדון הסופי נקבע בהסכם לפי הקבוצה והתנאים האישיים.' : 'Young-driver price and insurance terms can vary by vehicle. Pickup requires a valid credit card in the renter’s name; the final deposit is set in the agreement for the group and applicable terms.'}`;
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
          ? `רשמתי איסוף ב${state.booking.pickupLocation} והחזרה ב${state.booking.returnLocation}. אפשר לבקש מסלול כזה בתיאום מראש; שירות נתב״ג עשוי להיות כרוך בתוספת. ${state.booking.pickupDate && state.booking.returnDate ? 'נבדוק זמינות לתאריכים שמסרתם. תרצו שנתחיל בקשה?' : 'כשתדעו את התאריכים, נבדוק זמינות.'}`
          : `I have pickup at ${state.booking.pickupLocation} and return in ${state.booking.returnLocation}. We can check that route by prior arrangement; airport service may carry an additional charge. ${state.booking.pickupDate && state.booking.returnDate ? 'We will check availability for your dates. Would you like to start a request?' : 'Once you know the dates, we can check availability.'}`)
        : alreadyAnsweredInsurance
        ? (he
          ? 'הכיסוי הבסיסי כולל ביטוח חובה וכיסוי לנזקי תאונה, אש וגניבה, בכפוף להשתתפות עצמית. בהצעה יפורטו סכום ההשתתפות והאפשרויות להפחתתו. יש חלק מסוים בביטוח שתרצו שאסביר?'
          : 'Basic cover includes compulsory liability and accident, fire and theft cover, subject to an excess. The quote will show that excess and any reduction options. Is there a particular part you would like me to explain?')
        : fact!.topic === 'branches' && state.booking.pickupDate && !state.booking.pickupLocation
        ? `${fact!.reply} ${question('pickupLocation', state.locale)}` : fact!.reply;
      // During active intake, answering a policy side question must not drop
      // the one field the request still needs.
      const pendingField = state.phase === 'booking' && !state.completedRequestId ? nextMissing(state.booking) : null;
      if (pendingField) {
        const pendingQuestion = question(pendingField, state.locale);
        if (!reply.includes(pendingQuestion)) reply = `${reply} ${pendingQuestion}`;
        state.step = bookingStep(pendingField);
      }
    } else if (/^(?:תודה(?: רבה)?[.!\s]*|תודה[,!]?\s*אעדכן כש(?:אדע|יהיו לי) תאריכים[.!\s]*|thanks?(?: a lot)?[.!\s]*|thank you[.!\s]*)$/i.test(input)) {
      reply = he ? 'בשמחה. כשתרצו להמשיך, אני כאן.' : 'You are welcome. I am here when you are ready.';
    } else if (/איזה פרטים|מה (?:צריך|תצטרכו)|what details|what do you need/i.test(input)) {
      reply = he ? 'כדי לבדוק השכרה נצטרך תאריכי איסוף והחזרה, מיקומים, סוג רכב או מספר נוסעים וציוד, וקבוצת גיל נהג 21–23 או 24+. שם ומייל נבקש רק אם תרצו לשלוח בקשה.' : 'To check a rental we need pickup and return dates, locations, a vehicle type or passenger and luggage details, and the driver age group: 21–23 or 24+. We only ask for name and email if you choose to send a request.';
    } else if (state.phase === 'explore' && state.booking.passengers === 1 && /לא יודע|לא יודעת|לא בטוח|לא בטוחה|not sure|don'?t know/i.test(input) && /קומפקט|קטן|compact|small car/i.test(lastBot)) {
      reply = he ? 'זה בסדר, לא צריך לבחור דגם עכשיו. לנסיעה לבד רכב קומפקטי הוא כיוון טוב, ואפשר להשאיר את הבחירה פתוחה. הפרטים שמסרת שמורים כאן כשתרצה להמשיך.' : 'That is fine; you do not have to choose a model now. A compact is a good starting point for one person, and we can leave the choice open. Your details are here when you want to continue.';
    } else if (reading?.route === 'social') {
      const modelReply = groundedModelReply(reading, input, state);
      reply = modelReply ?? (he ? 'היי 🙂 במה אפשר לעזור לך עם רכב?' : 'Hi 🙂 How can I help with a car?');
      if (modelReply) source = 'gemini';
    } else {
      const modelReply = groundedModelReply(reading, input, state);
      reply = modelReply ?? advice(input, state, reading);
      if (modelReply) source = 'gemini';
    }
    // Actions, private details, safety and the final consent summary remain
    // application-owned. For ordinary discussion the grounded AI answer is the
    // default; deterministic paragraphs above are the outage/rejection backup.
    if (!escalate && !policyLocked && (!state.handedOff || continuedServiceAdvice) && !gotPrivate && !state.durationClarification
      && !state.completedRequestId) {
      const questionTurn = /[?؟]/u.test(input) || reading?.route === 'policy';
      const canUseDraft = state.phase !== 'booking' || questionTurn;
      let rejectionReason: string | undefined;
      let draft = groundedModelReply(reading, input, state, reason => { rejectionReason = reason; });
      // One wording-only correction: no new extraction, routing or action.
      // The rejected draft is never included in the correction request.
      if (!draft && rejectionReason && reading?.groundedContext && modelContext && canUseDraft) {
        const correction = await (store.readTurn ?? readBotTurn)(redactServiceReference(input, state.serviceReference), {
          ...modelContext, phase: state.phase, known: conversationalKnown(state), replyCorrection: rejectionReason,
          conversation: {
            ...modelContext.conversation, interest: state.interest, handoffDeferred: Boolean(state.humanHandoffDeferred),
            hasServiceReference: Boolean(state.serviceReference),
            nextMissingField: state.phase === 'booking' ? nextMissing(state.booking) ?? undefined : undefined,
            step: state.step, completedRequest: Boolean(state.completedRequestId),
          },
        });
        draft = groundedModelReply(correction, input, state);
        if (draft && correction) model = correction.model;
      }
      if (draft) {
        const waitingForFinalConsent = state.phase === 'booking' && state.step === 'rental_confirm';
        // A data-only intake turn must ask the one missing field chosen by the
        // application. The model answers side questions, not intake workflow.
        if (canUseDraft) {
          const firstMissing = state.phase === 'booking' && !wasBooking ? nextMissing(state.booking) : null;
          // On entering intake, keep the model's substantive answer and let
          // code ask the single concrete missing field, including private ones.
          const answer = firstMissing || waitingForFinalConsent ? draft.replace(/[^.!?؟]*[?؟]\s*$/u, '').trim() : draft;
          reply = waitingForFinalConsent ? `${answer ? `${answer}\n\n` : ''}${summary(state)}`
            : firstMissing ? `${answer ? `${answer}\n\n` : ''}${question(firstMissing, state.locale)}` : draft;
          source = 'gemini';
        }
      }
    }
  }

  if (state.phase === 'explore' && !state.interest && asksRentalDates(reply) && directVehicleRequest(input, state.locale)) {
    state.phase = 'booking';
    state.requestKey ??= randomUUID();
    state.booking.vehicleNeed ??= explicitVehicleNeed(input, state.locale) ?? undefined;
    const missing = nextMissing(state.booking);
    state.step = bookingStep(missing);
    if (source !== 'gemini') {
      reply = missing ? question(missing, state.locale) : summary(state);
      source = 'local';
    }
  }

  const asksReferenceRecall = /(?:מספר\s+ה?הזמנה|booking\s+(?:number|reference))/i.test(input)
    && /שוב|כבר יש|כבר מסרתי|צריך לשלוח|תזכיר|הזכר|(?:מה|איזה|אילו).{0,35}מספר.{0,25}(?:שמר|רשמ)|איזה.{0,30}(?:מסרתי|נתתי|שלחתי)|again|already have|already (?:gave|provided|sent)|need to (?:send|provide)|remind|(?:which|what).{0,45}(?:gave|provided|sent|keep|kept|save|saved|record|remember)/i.test(input);
  if (asksReferenceRecall && state.serviceReference) {
    const acknowledgement = he ? `מספר ההזמנה ${state.serviceReference} כבר שמור בפנייה; אין צורך לשלוח אותו שוב.` : `Your booking reference ${state.serviceReference} is already saved in the enquiry; you do not need to send it again.`;
    // The reference is an application-owned receipt, not a provider-authored
    // privacy restriction or evidence that a payment has been checked.
    reply = /תשלום|מקדמה|payment|deposit|received|arrived/i.test(input)
      ? `${he ? 'השיחה אינה מאמתת קבלת תשלום, ומספר הזמנה שמסרת אינו אישור שהכסף התקבל. לבירור קבלה יש להשתמש בערוץ התשלום הרשמי של SmartCar.' : 'This chat has not verified payment receipt. A reference you typed is not confirmation that money arrived; receipt checks use SmartCar’s official payment channel.'} ${acknowledgement}`
      : hasOtherReferenceQuestion(input) || /מחיר|אישור|אושר|זיכוי|גרר|רכב חלופי|price|approv|refund|\btow\b|replacement (?:car|vehicle)/i.test(input) ? `${reply} ${acknowledgement}` : acknowledgement;
  }
  const asksCommercialRecall = state.interest && state.commercial
    && (/שמר|רשמ|תזכיר|הזכר|remember|record|saved|remind|noted/i.test(input)
    && /תקציב|סוג רכב|העדפ|תקופ|קילומטראז|budget|car type|vehicle|preference|term|mileage/i.test(input)
    || /what (?:do|did) you (?:have|got) (?:on|about|for) me|what do you have so far|what have you (?:got|noted|saved)|מה (?:יש לך|רשמת|שמרת) (?:עליי|עלי|עד עכשיו)|מה רשמת(?:\s|\?|$)/iu.test(input));
  if (asksCommercialRecall) {
    const details = renderCommercialMemory(state.commercial, state.locale);
    const recall = he ? `הפרטים שנשמרו בפנייה: ${details}. הפנייה אינה אישור לשמירת רכב, לעסקה או לנסיעת מבחן; אלה דורשים תיאום ואישור נפרד של SmartCar.`
      : `Your recorded enquiry preferences: ${details}. This enquiry does not confirm a reserved car, purchase or test drive; those require separate arrangements and SmartCar confirmation.`;
    // Keep the callback acknowledgement when the same message asked for one.
    reply = escalate ? `${reply} ${recall}` : recall;
  }
  const asksDraftStatus = /מה\s+פרטי\s+(?:ההשכרה|הבקשה|ההזמנה)|מה\s+עם\s+ההשכרה\s+שלי|(?:ההזמנה|הבקשה).{0,55}(?:שעשיתי איתך|שעשינו|העברת|שלחת|נשלחה)|(?:העברת|שלחת|נשלחה).{0,45}(?:ההזמנה|הבקשה)|(?:what|which).{0,30}(?:rental|request|booking) details|did you.{0,30}(?:send|submit|pass).{0,35}(?:request|booking)/i.test(input)
    || !state.handedOff && /^(?:יחזרו אליי?\??|will (?:someone|a representative) call me back\??)$/i.test(input.trim());
  if (!state.completedRequestId && state.requestKey && asksDraftStatus && !escalate
    && state.handoffKind !== 'safety' && state.handoffKind !== 'booking_change') {
    const b = state.booking;
    const missing = nextMissing(b);
    const date = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
    const parts = [b.vehicleNeed,
      b.pickupDate && `${he ? 'איסוף בתאריך' : 'Pickup date'}: ${date(b.pickupDate)}`,
      b.returnDate && `${he ? 'החזרה בתאריך' : 'Return date'}: ${date(b.returnDate)}`,
      b.pickupLocation && `${he ? 'מקום איסוף' : 'Pickup'}: ${b.pickupLocation}`,
      b.returnLocation && `${he ? 'מקום החזרה' : 'Return'}: ${b.returnLocation}`,
      b.passengers !== undefined && `${he ? 'נוסעים' : 'Passengers'}: ${b.passengers}`,
      b.luggage !== undefined && `${he ? 'מזוודות' : 'Bags'}: ${b.luggage}`,
    ].filter(Boolean).join('; ');
    reply = missing
      ? `${he ? 'אלה הפרטים ששמורים בטיוטת ההשכרה; בקשת השכרה טרם נשלחה ואין הזמנה מאושרת.' : 'These are the saved rental draft details; a rental request has not been sent and no booking is confirmed.'}\n${parts}${state.handedOff ? '' : `\n${question(missing, state.locale)}`}`
      : `${he ? 'אין עדיין אישור לקליטת בקשת השכרה. הפרטים מוכנים לאישורך.' : 'There is no recorded rental-request receipt yet. The details are ready for your confirmation.'}\n${summary(state)}`;
    if (!missing) privateTurn = true;
    source = 'local';
  }
  if (state.phase === 'service' && PRIVATE_PAYMENT_DETAIL.test(input)
    && !/אין צורך לשלוח מספר כרטיס מלא או קוד אבטחה|Do not send a full card number or security code/i.test(reply)) {
    reply += he ? ' אין צורך לשלוח כאן מספר כרטיס או אשראי מלא, קוד אבטחה, CVV או CVC.' : ' Do not send a full credit card number, security code, CVV or CVC here.';
  }
  // While a change is pending, the contractual return time stands. Answer the
  // "if nobody replies, do I return it?" question directly.
  if ((state.handedOff && (state.handoffKind === 'booking_change' || state.handoffKind === 'service_issue' || state.handoffKind === 'human') || state.serviceChangeRequested) && !state.history.some(entry => entry.from === 'customer' && cancellationRequest(entry.text))
    && /(?:^|\s)ו?אם\s+(?:לא\s+)?(?:יענו|תענו|יחזרו|תחזרו|אקבל|נקבל|יאשרו|תאשרו)|מחזיר(?:ה)?\s+או\s+ממשיכ|להחזיר\s+או\s+להמשיך|\b(?:if|what if)\b.{0,30}\b(?:no one|nobody|you don['’]?t|I don['’]?t|no) (?:answers?|repl(?:y|ies)|hear|confirm|get back)|\breturn it or keep\b|\bkeep (?:driving|it) or return\b/iu.test(input)) {
    reply = he
      ? `עד שתקבלו אישור מפורש מ־SmartCar, מועד ההחזרה הקיים נשאר בתוקף — יש להחזיר את הרכב במועד המקורי. אם לא קיבלתם תשובה עד אז, התקשרו ל־${OFFICE_PHONE} לפני מועד ההחזרה.`
      : `Until SmartCar explicitly confirms the change, your existing return time stands — please return the car at the original time. If you have not heard back by then, call ${OFFICE_PHONE} before the return time.`;
    source = 'local';
  }
  // A pre-purchase inspection question gets a car-specific, non-promising answer.
  // Purchase: point to the published cars-for-sale page instead of describing stock.
  if (state.interest === 'sale' && !escalate && !state.handedOff && !/cars-for-sale/.test(reply)
    && !state.history.slice(-4).some(entry => entry.from === 'bot' && /cars-for-sale/.test(entry.text))
    && /יש לכם|מה יש|אילו רכבים|איזה רכבים|דגמים|אפשרויות|מלאי|לראות|לבוא|מוכרים|למכירה|what (?:do you have|cars|models)|available|options|stock|come (?:and )?see|view (?:it|them|the car)|do you sell|for sale|used cars?/iu.test(input)) {
    reply = `${reply.trim()}\n\n${he ? 'את הרכבים שמוצעים כרגע למכירה אפשר לראות כאן: https://www.smartcar.co.il/he/cars-for-sale' : 'You can see the cars currently offered for sale here: https://www.smartcar.co.il/en/cars-for-sale'}`;
  }
  if (state.interest === 'sale' && !escalate && /בדיקה במכון|מכון בדיקה|בדיקת מכון|לבדוק במוסך|pre[- ]?purchase inspection|mechanic(?:al)? (?:check|inspection)|inspection before/iu.test(input) && !/מכון|inspection/iu.test(reply)) {
    reply = `${reply.trim()} ${he ? 'בדיקה במכון לפני רכישה מתואמת עם נציג SmartCar לפי הרכב המסוים.' : 'A pre-purchase inspection is arranged with a SmartCar representative for the specific car.'}`;
  }
  // A rental draft that already has dates and pickup should not stall: if the
  // reply asks nothing, ask the one route detail still missing.
  if (!escalate && state.phase === 'explore' && !state.interest && !state.completedRequestId && !state.handedOff
    && state.booking.pickupDate && state.booking.returnDate && state.booking.pickupLocation && !state.booking.returnLocation
    && !/(?:^|\s)לא (?:רוצה|מעוניין|עכשיו)|not (?:now|ready)|just asking|רק שואל/iu.test(input)
    && !/החזר|להחזיר|\breturn|drop.?off/iu.test(reply)) {
    // A generic closing question ("anything else to add?") would stall; ask the missing return place instead.
    const body = /[?؟]\s*$/u.test(reply.trim()) ? reply.trim().replace(/(?:^|(?<=[.!:\n]))[^.!:?؟\n]*[?؟]\s*$/u, '').trim() : reply.trim();
    reply = `${body} ${question('returnLocation', state.locale)}`.trim();
  }
  // Company receipt/invoice questions get an honest, non-committal answer.
  if (!escalate && /(?:קבלה|חשבונית)(?:\s+מס)?\s+(?:על\s+שם|ל)(?:\s*ה)?(?:חברה|עסק)|\b(?:invoice|receipt)\b.{0,25}\b(?:company|business)\b/iu.test(input) && !/קבלה|חשבונית|invoice|receipt/iu.test(reply)) {
    reply = `${he ? 'קבלה או חשבונית על שם החברה מבקשים מנציג SmartCar כשהוא חוזר אליכם לגבי הבקשה.' : 'Please ask the SmartCar representative for a receipt or invoice in the company name when they contact you about the request.'}\n\n${reply.trim()}`;
  }
  // Leasing with term, mileage and vehicle known: offer the representative step instead of a generic question.
  if (!escalate && state.interest === 'leasing' && !state.handedOff && state.commercial?.termMonths != null && state.commercial?.annualMileageKm != null
    && (state.commercial?.vehiclePreference != null || state.commercial?.vehicleModel)
    && !/תרצ(?:ה|ו).{0,30}(?:שאעביר|שנציג|שנחזור אליכם|שיחזרו אליכם|שנעביר)|would you like.{0,35}(?:pass|representative)/iu.test(reply)
    && (/[?؟]\s*$/u.test(reply.trim()) && !/נציג|representative/iu.test(reply) || !/[?؟]/u.test(reply) && /נציג SmartCar\s+(?:יעזור|ישמח|יוכל|יעבור|יכין)|a SmartCar representative (?:can|will be happy to|will help)/iu.test(reply))) {
    const body = reply.trim().replace(/(?:^|(?<=[.!:\n]))[^.!:?؟\n]*[?؟]\s*$/u, '').trim();
    reply = `${body} ${he ? 'יש לי את התקופה, הקילומטראז׳ והרכב שביקשתם. תרצו שאעביר את הפרטים לנציג SmartCar להכנת הצעה מפורטת?' : 'I have your term, mileage and vehicle. Would you like me to pass them to a SmartCar representative for a detailed offer?'}`.trim();
  }
  // An airport surcharge question always gets the surcharge answer, even inside a price question.
  const airportFeeAsked = /(?:נתב.?ג|שדה (?:ה)?תעופה|airport|ben gurion).{0,40}(?:תוספת|עמלה|תשלום נוסף|חיוב נוסף|extra|surcharge|fee|charge)|(?:תוספת|עמלה|תשלום נוסף|extra|surcharge|fee|charge).{0,40}(?:נתב.?ג|שדה (?:ה)?תעופה|airport|ben gurion)/iu.test(input);
  if (!escalate && airportFeeAsked && !/כמה|מה הסכום|\bhow much\b/iu.test(input) && !/אתר|website/iu.test(input)) {
    // Fixed wording: the model kept inventing reasons ("depends on the booking", "it varies").
    const fee = getSmartCarApprovedFacts(state.locale).find(fact => fact.id === 'airport_fee')?.text;
    const next = !state.booking.pickupDate ? (he ? ' לאילו תאריכים תצטרכו את הרכב?' : ' What dates do you need the car for?') : '';
    if (fee) reply = `${fee}${next}`;
  }
  // Shabbat pickup/return: the published notice, in fixed wording (owner rule: no amount).
  const shabbatAsked = /(?<![\p{L}])(?:ב)?שבת(?![\p{L}])|\bsaturday\b|\bshabbat\b/iu.test(input) && /רכב|לקבל|לאסוף|איסוף|להחזיר|החזרה|מסירה|car|pick|collect|return|drop/iu.test(`${input} ${lastBotForFeeShabbat(state)}`)
    && !/סגורים בשבת.{0,40}$/u.test(input);
  const shabbatFeeFollowUp = /תוספת|עולה|יותר יקר|תשלום|extra|charge|fee|cost more/iu.test(input) && /(?:ב)?שבת|saturday|shabbat/iu.test(lastBotForFeeShabbat(state)) && !/נתב.?ג|airport/iu.test(input);
  if (!escalate && !state.handedOff && state.phase !== 'service' && !cancellationRequest(input) && !mentionsRentalChange(input)
    && (shabbatAsked && /[?؟]|אפשר|can i|could i|is it possible/iu.test(input) || shabbatFeeFollowUp) && !airportFeeAsked) {
    const fact = shabbatFeeFollowUp
      ? (he ? 'כן, על איסוף או החזרה בשבת עשויה להיות תוספת תשלום. את הסכום ואת המחיר הסופי סוגרים מול נציג SmartCar.' : 'Yes, a Saturday pickup or return may carry an extra charge. The amount and the final price are set with a SmartCar representative.')
      : getSmartCarApprovedFacts(state.locale).find(fact => fact.id === 'shabbat')?.text;
    const missing = !state.booking.pickupDate ? (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car for?')
      : !state.booking.returnDate ? question('returnDate', state.locale)
      : !state.booking.pickupLocation ? question('pickupLocation', state.locale)
      : !state.booking.returnLocation ? question('returnLocation', state.locale) : '';
    if (fact) reply = `${fact}${missing ? ` ${missing}` : ''}`;
  }
  // "How much is the airport surcharge?" — a fixed, human answer without the amount (owner decision).
  const lastBotForFee = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
  const asksFeeAmount = /כמה|מה הסכום|\bhow much\b|\bwhat(?:'s| is) the (?:amount|fee|surcharge)\b/iu.test(input)
    && (airportFeeAsked || /תוספת|surcharge|fee/iu.test(input) && /(?:תוספת|surcharge)/iu.test(lastBotForFee) && /נתב.?ג|airport|ben gurion/iu.test(lastBotForFee));
  if (!escalate && asksFeeAmount && !/אתר|website/iu.test(input)) {
    const next = !state.booking.pickupDate ? (he ? ' לאילו תאריכים תצטרכו את הרכב?' : ' What dates do you need the car for?') : '';
    reply = he ? `את סכום התוספת על נתב״ג מוסר נציג SmartCar, יחד עם המחיר המלא של ההשכרה.${next}` : `A SmartCar representative gives you the Ben Gurion surcharge together with the full rental price.${next}`;
  }
  // Airport surcharge and the website: mention the website estimate only when the customer asks about it.
  const lastBotText = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
  if (!escalate && /אתר|website|\bsite\b|online|באינטרנט/iu.test(input) && /כלול|included|include|incl/iu.test(input)
    && (airportFeeAsked || /(?:תוספת|surcharge)/iu.test(lastBotText) && /נתב.?ג|airport|ben gurion/iu.test(lastBotText))) {
    reply = `${he ? 'לא, התוספת על נתב״ג לא כלולה במחיר המשוער שמופיע באתר. את הסכום ואת המחיר הסופי סוגרים מול נציג SmartCar.' : 'No, the Ben Gurion surcharge is not included in the estimate shown on the website. The amount and the final price are set with a SmartCar representative.'}`;
  }
  if (!escalate && /אתר|website|\bsite\b|online|באינטרנט/iu.test(input) && /נתב.?ג|שדה (?:ה)?תעופה|airport|ben gurion/iu.test(`${input} ${reply}`)
    && /(?:תוספת|surcharge)/iu.test(reply) && !/אתר|website/iu.test(reply)) {
    reply = `${reply.trim()} ${he ? 'התוספת הזו לא כלולה במחיר המשוער שמופיע באתר.' : 'This surcharge is not included in the estimate shown on the website.'}`;
  }
  // A late flight at the airport: answer that part too, without promising the car will wait.
  if (!escalate && /\b(?:flight|plane)\b.{0,30}\b(?:late|delayed|delay)\b|\b(?:late|delayed) (?:flight|landing)|הטיסה.{0,20}(?:מתעכבת|תתעכב|מאחרת|תאחר|מתאחרת)|עיכוב (?:ב)?טיסה/iu.test(input)
    && !/delay|late|מתעכב|עיכוב|מאחר/iu.test(reply)) {
    reply = `${reply.trim()} ${he ? 'אם הטיסה מתעכבת, עדכנו את SmartCar בהקדם כדי לתאם מחדש את המסירה בנתב״ג.' : 'If your flight is delayed, let SmartCar know as soon as you can so the airport handover can be rearranged.'}`;
  }
  // Home collection added this turn: say it was noted, then ask what is still missing.
  if (!escalate && state.phase === 'explore' && /(?:יאספו|תאספו|לאסוף|איסוף)\s+(?:אותו|אתו|את הרכב)?\s*מהבית|collect (?:it )?from (?:my )?(?:home|house)|pick (?:it )?up from (?:my )?(?:home|house)/iu.test(input)
    && /^(?:איסוף מהבית|Collection from home)/u.test(state.booking.returnLocation ?? '') && !/מהבית|from (?:your |the )?home/iu.test(reply)) {
    const nextQ = !state.booking.vehicleNeed && !state.booking.passengers ? (he ? 'איזה רכב תרצו, או כמה נוסעים תהיו?' : 'Which car would you like, or how many passengers will there be?') : '';
    reply = `${he ? 'רשמתי גם איסוף של הרכב מהבית בסוף ההשכרה.' : 'Noted: collection of the car from your home at the end of the rental.'}${nextQ ? ` ${nextQ}` : ` ${reply.trim()}`}`.trim();
  }
  // Financing for a purchase is not published: fixed, honest wording.
  if (!escalate && state.interest === 'sale' && /financ|loan|payment plan|installments?|מימון|הלוואה|תשלומים|פריסה/iu.test(input)) {
    reply = he ? 'לגבי מימון או תשלומים אני לא יכול לאשר כאן מה אפשרי. נציג SmartCar יוכל לומר אילו אפשרויות קיימות לרכב מסוים. תרצו שנציג יחזור אליכם?'
      : 'I cannot confirm financing or payment plans here. A SmartCar representative can tell you what is available for a specific car. Would you like a representative to get back to you?';
  }
  // An additional-driver change request: say what the driver will need.
  if (escalate && state.handoffKind === 'booking_change' && /\badd (?:an? )?(?:another|second|additional|extra)? ?driver\b|להוסיף\s+(?:\S+\s+){0,2}(?:כ)?נהג/iu.test(input) && !/licen[cs]e|רישיון/iu.test(reply)) {
    reply = `${reply.trim()} ${he ? 'הנהג הנוסף יצטרך להציג רישיון בתוקף ולהירשם בחוזה לפני שהוא נוהג.' : 'The additional driver will need to show a valid licence and be named in the agreement before driving.'}`;
  }
  // Model-extracted locations may keep abbreviations ("ת\"א"); store the branch name.
  for (const key of ['pickupLocation', 'returnLocation'] as const) {
    const value = state.booking[key];
    if (value && value.length <= 6) { const expanded = expandBranchAbbreviations(value); if (expanded !== value) state.booking[key] = expanded; }
  }
  // A frustrated customer waiting for a pickup, an urgent follow-up and a compensation ask:
  // acknowledge the situation, point to the fastest route and never promise compensation.
  const waitingForPickup = /(?:waiting|been here|nobody(?: is)? here|no one(?: is)? here|nobody showed|no one showed|no one came|nobody came)\b|(?:מחכה|ממתין|ממתינה|מחכים)\s+(?:כבר\s+)?(?:\d+\s*)?(?:דקות|שעה|פה|בסניף)|אין (?:פה )?(?:אף אחד|אף אחת|אף נציג)|אף אחד לא (?:הגיע|בא|פה)/iu.test(input);
  const urgentNow = /\b(?:now|asap|urgent|right away|flight|plane|late for)\b|דחוף|עכשיו|מיד|טיסה|מאחר|מאחרת/iu.test(input);
  const compensationAsk = /\bcompensat|\bdiscount for (?:this|the wait)|\bmake (?:it|this) right|פיצוי|לפצות|הנחה על (?:זה|העיכוב)/iu.test(input);
  const waitedEarlier = state.history.some(entry => entry.from === 'customer' && /(?:waiting|nobody(?: is)? here|no one(?: is)? here)\b|(?:מחכה|ממתין|ממתינה)\s+(?:כבר\s+)?(?:\d+\s*)?(?:דקות|שעה|פה|בסניף)|אין (?:פה )?(?:אף אחד|אף נציג)/iu.test(entry.text));
  if (state.phase === 'service' && state.handedOff && !state.safetyKind
    && (waitingForPickup && /branch|סניף|pickup|איסוף|לאסוף|here|פה/iu.test(input) || waitedEarlier && (urgentNow || compensationAsk) || compensationAsk && state.handoffKind === 'service_issue')) {
    const ref = state.serviceReference ? (he ? ` (הזמנה ${state.serviceReference})` : ` (booking ${state.serviceReference})`) : '';
    reply = compensationAsk
      ? (he ? `אני מבין שזה מתסכל. פיצוי אני לא יכול להבטיח כאן, אבל הוספתי את הבקשה לפנייה${ref} כדי שנציג SmartCar יתייחס אליה. לעזרה מיידית: ${OFFICE_PHONE}.` : `I understand this is frustrating. I cannot promise compensation here, but I have added your request to your message${ref} so a SmartCar representative can respond to it. For immediate help: ${OFFICE_PHONE}.`)
      : waitingForPickup
      ? (he ? `מצטער שאתם מחכים. הפנייה שלכם${ref} כבר אצל נציג SmartCar. הדרך המהירה ביותר עכשיו היא להתקשר ל־${OFFICE_PHONE}.` : `I am sorry you have been waiting. Your message${ref} is already with a SmartCar representative. The fastest way to get help right now is to call ${OFFICE_PHONE}.`)
      : (he ? `מבין שזה דחוף. הכי מהר יהיה להתקשר עכשיו ל־${OFFICE_PHONE}; הפנייה שלכם${ref} כבר אצל נציג.` : `I understand it is urgent. The fastest way is to call ${OFFICE_PHONE} now; your message${ref} is already with a representative.`);
  }
  // Several questions in one message ("1. מאיזה גיל? 2. צריך אשראי? 3. … 4. …"): answer each known topic,
  // and say plainly that a representative answers the rest, instead of answering only one.
  let multiAnswered = false;
  const questionParts = input.split(/(?:^|\s)\d{1,2}[.)]\s+|[?؟]\s*/u).map(part => part.trim()).filter(part => part.length >= 4);
  if (!escalate && !state.handedOff && state.phase !== 'booking' && questionParts.length >= 3) {
    const seen = new Set<string>(); const answers: string[] = []; let unanswered = 0;
    // Keep each answer short: the opening sentences carry the rule; details come on request.
    const brief = (text: string, topic: string) => { const body = text.replace(/^(?:בשמחה|כן|Of course|Yes)[.,—–\s]+/u, '').split(/(?<=[.!?])\s+/u).slice(0, topic === 'deposit' ? 1 : 2).join(' '); return body.charAt(0).toUpperCase() + body.slice(1); };
    for (const part of questionParts) {
      if (/חשמלי|electric|\bEV\b/iu.test(part)) {
        if (!seen.has('ev')) { seen.add('ev'); answers.push(he ? 'יש אצלנו גם קטגוריה של רכבים חשמליים; הזמינות נבדקת לפי התאריכים.' : 'We also have an electric-car category; availability is checked for your dates.'); }
        continue;
      }
      const found = getSmartCarServiceAnswer(part, state.locale);
      if (found) { if (!seen.has(found.topic)) { seen.add(found.topic); answers.push(brief(found.reply, found.topic)); } }
      else if (!/^(?:(?:יש לי )?(?:כמה |מספר )?שאלות|(?:(?:a )?(?:few|quick|couple of|some) )?questions?|היי|hi|hello|hey|שלום)[:\s]*$/iu.test(part)) unanswered += 1;
    }
    if (answers.length >= 2) {
      multiAnswered = true;
      reply = answers.map(answer => `• ${answer}`).join('\n') + (unanswered ? `\n\n${he ? 'על שאר השאלות נציג SmartCar ישמח לענות.' : 'A SmartCar representative will be happy to answer the rest.'}` : '');
    }
  }
  // Card brands are not published: answer honestly instead of ignoring the question.
  if (!escalate && /\b(?:amex|american express|diners|visa|mastercard|master card|isracard)\b|אמריקן אקספרס|אמקס|דיינרס|ויזה|מאסטרקארד|ישראכרט/iu.test(input)
    && !/amex|american express|diners|visa|mastercard|isracard|אמריקן|אמקס|דיינרס|ויזה|מאסטרקארד|ישראכרט|סוג הכרטיס|card type|card brand/iu.test(reply)) {
    reply = `${reply.trim()}\n\n${he ? 'לגבי סוג הכרטיס: נדרש כרטיס אשראי (לא דביט) על שם השוכר; אם מדובר בסוג כרטיס מסוים, נציג SmartCar יאשר מולכם שהוא מתקבל.' : 'On the card: a credit card (not debit) in the renter’s name is required; a SmartCar representative will confirm whether a specific card brand is accepted.'}`;
  }
  // The price line answers price questions only; a toll or fine "who pays" question is not one.
  if (reply.includes(priceAnswer(state.locale)) && !PRICE_OR_AVAILABILITY.test(input)
    && !/כמה (?:זה )?(?:עולה|יעלה|יוצא|ייצא)|מה המחיר|הצעה|\bhow much\b|\bquote\b/iu.test(input)) {
    const stripped = reply.replace(priceAnswer(state.locale), '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
    if (stripped.trim()) reply = stripped;
  }
  // Owner rule: a rental price question always gets the same honest line.
  if (!escalate && state.phase !== 'service' && !state.interest && !state.completedRequestId
    && /כמה (?:זה )?(?:עולה|יעלה|יוצא|ייצא)|(?:זה\s+)?(?:יוצא|יעלה|עולה)\s+(?:יקר|הרבה)|יקר\s*[?؟]|כמה (?:זה )?(?:בערך|בממוצע)|כמה (?:זה )?ל(?:יום|חודש|שבוע)|מה המחיר|מחיר|(?<![לב])עלות|\bhow much\b|\bprice\b|\bcost\b|\brate\b|\bballpark\b/iu.test(input)
    && !/פיקדון|deposit|השתתפות|excess|ביטול|cancel/iu.test(input) && !reply.includes(priceAnswer(state.locale))
    && !/מחיר|הצעה|תעריף|עלות|price|quote|rate|cost/iu.test(reply)) {
    reply = `${priceAnswer(state.locale)} ${reply}`.trim();
  }
  // Same owner rule for leasing and purchase price questions.
  if (!escalate && (state.interest === 'leasing' || state.interest === 'sale') && !state.handedOff
    && /כמה (?:זה )?(?:עולה|יעלה|יוצא|ייצא)|כמה (?:זה )?בחודש|מה המחיר|מחיר|(?<![לב])עלות|\bhow much\b|\bprice\b|\bcost\b|\bmonthly\b/iu.test(input)
    && !/מחיר|תעריף|(?<![לב])עלות|price|rate|cost/iu.test(reply)) {
    reply = `${he ? 'המחיר נסגר סופית מול נציג SmartCar, לפי המסלול, הרכב והתנאים שתבחרו.' : 'The final price is set with a SmartCar representative, based on the plan, vehicle and terms you choose.'} ${reply}`.trim();
  }
  // Model wording may not contain phone numbers; when it tells the customer
  // to call, the application adds the approved office number.
  if (!reply.includes(OFFICE_PHONE) && /\bcall (?:our|the) (?:office|team|branch)\b|\bcall us\b|\bcontact (?:our|the) office\b|\bcontact (?:our|the) (?:service|support) (?:team|cent(?:er|re)|desk)\b|התקשרו (?:אלינו|למשרד|לסניף)|התקשר(?:י)? (?:אלינו|למשרד)|צרו (?:איתנו )?קשר טלפוני|(?:ליצור|צרו|צור|תיצרו) קשר עם (?:מוקד|המוקד|המשרד|הסניף|השירות|מחלקת השירות)/iu.test(reply)) {
    reply = `${reply.trim()} ${he ? `מספר המשרד: ${OFFICE_PHONE}.` : `Office: ${OFFICE_PHONE}.`}`;
  }
  // After a collision, "should I take his details?" deserves a direct answer.
  if (state.handoffKind === 'safety' && (state.safetyKind === 'accident' || !state.safetyKind) && /(?:get|take|exchange|collect) (?:his|her|their|the other (?:driver['’]?s?|party['’]?s?)) (?:details|info|information|insurance)|(?:the )?other driver['’]?s? (?:details|info)|פרטים (?:מ|של )?(?:ה)?נהג|הנהג השני|פרטי (?:ה)?נהג|(?:לקחת|לבקש|לקבל|להחליף)\s+(?:ממנו|ממנה|איתו|איתה)\s+(?:את\s+)?(?:ה)?פרטים|(?:לקחת|לבקש)\s+(?:את\s+)?(?:ה)?פרטים\s+(?:שלו|שלה|ממנו|ממנה)/iu.test(input)
    && !/פרטי הנהג השני|other driver['’]?s details/iu.test(reply)) {
    reply = `${he ? 'כן, אם בטוח לעשות זאת רשמו את פרטי הנהג השני: שם, טלפון, מספר רכב ופרטי הביטוח שלו, וצלמו את הנזק.' : 'Yes, if it is safe, note the other driver’s details: name, phone, plate number and insurance details, and photograph the damage.'} ${reply}`;
  }
  // A safety turn can carry a separate excess/liability question. Answer it
  // conditionally from approved terms rather than dropping it.
  if (state.handoffKind === 'safety' && /השתתפות ה?עצמית|אשלם|מי.{0,15}ישלם|\bexcess\b|\bpay for (?:the )?damage\b|\bliable\b/i.test(input) && !/השתתפות|excess/i.test(reply)) {
    reply += he ? ' לגבי ההשתתפות העצמית: היא תלויה בנסיבות, בכיסוי הביטוחי ובהסכם ההשכרה, ואי אפשר לקבוע חיוב או פטור לפני בדיקת האירוע.' : ' About the excess: it depends on the circumstances, the cover and your rental agreement; no charge or waiver can be determined before the incident is reviewed.';
  }
  // Contact details keep a turn away from the wording provider. An approved-
  // policy question in that same message must still be answered, not dropped.
  if (source === 'local' && !escalate && !multiAnswered && state.phase !== 'service' && /[?؟]/u.test(input) && !state.completedRequestId) {
    const sideFact = getSmartCarServiceAnswer(input, state.locale);
    const contactTurn = privateTurn || /(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}|[^\s@]+@[^\s@]+\.[^\s@]+/u.test(input);
    // Policy facts a customer asked about directly; location/branch facts carry
    // their own date/route prompts and stay with their dedicated branches.
    // Rental policy facts are not leasing/sale terms.
    const side = sideFact && !state.interest && (contactTurn || ['driver_documents', 'insurance', 'deposit', 'age_licence', 'fuel', 'mileage'].includes(sideFact.topic)) ? sideFact.reply : undefined;
    if (side && !reply.includes(side.slice(0, 40))) reply = `${side} ${reply}`;
  }
  // The model understood an existing-booking matter and told the customer that a representative will deal
  // with it. The application makes that true: the case is passed on now (one alert), instead of leaving a
  // promise nobody hears about. Limited to service matters; sales wording is checked by the validator.
  // The model judged that a SmartCar person has to act now (owner, 2026-11-14: a problem with the car the customer
  // has goes to a representative immediately, with the office number in case it is urgent). The model decides;
  // the application performs the handoff the model cannot perform itself.
  const modelAsksForPerson = modelNeedsRepresentative && !/מה (?:קורה|עושים) אם|what (?:happens )?if|(?:^|\s)אם\s|\bif\b/iu.test(input);
  if (source === 'gemini' && !escalate && !state.handedOff && !state.completedRequestId && (modelAsksForPerson
    || !state.interest && (state.phase === 'service' || modelRoute === 'service' || modelRoute === 'human')
    && /נציג(?:\s+(?:של\s+)?SmartCar)?\s+(?:יחזור|יצור|ייצור|יטפל|יבדוק|יעבור על|יעדכן)|(?:representative|someone from (?:our|the) team|our team)\s+will\s+(?:get back|be in touch|contact|call|handle|look into|review|check|update)/iu.test(reply))) {
    state.phase = 'service'; state.handedOff = true; state.handoffAt = new Date().toISOString();
    state.handoffKind = cancellationRequest(input) || mentionsRentalChange(input) ? 'booking_change' : 'service_issue';
    escalate = true; draftNotes.push(modelAsksForPerson ? 'handoff_model_judgement' : 'handoff_from_model_promise');
    if (!/נציג|representative/iu.test(reply)) reply = `${reply.trim()} ${he ? 'העברתי את זה עכשיו לנציג SmartCar.' : 'I have passed this to a SmartCar representative now.'}`;
    if (!reply.includes(OFFICE_PHONE)) reply = `${reply.trim()} ${he ? `אם זה דחוף, התקשרו ל־${OFFICE_PHONE}.` : `If it is urgent, call ${OFFICE_PHONE}.`}`;
  }
  // Outside a service matter nobody is alerted, so a reply that points the customer to a representative
  // must at least say how to reach one.
  if (source === 'gemini' && !escalate && !state.handedOff && !reply.includes(OFFICE_PHONE)
    && /נציג(?:\s+(?:של\s+)?SmartCar|\s+שלנו)?\s+(?:ישמח\s+ל)?(?:יבדוק|יעדכן|יחזור|יצור|ייצור|יתאם|בדוק|עדכן|תאם)|(?:representative)\s+will\s+(?:check|update|get back|contact|call|coordinate|arrange)/iu.test(reply)) {
    reply = `${reply.trim()} ${he ? `אפשר לברר את זה מול המשרד בטלפון ${OFFICE_PHONE}.` : `You can confirm it with our office on ${OFFICE_PHONE}.`}`;
  }
  // Code decides, the model speaks: a reply produced by fixed application wording is reworded by the model in
  // a human voice, as an answer to what the customer actually wrote. The facts stay the application's — the
  // rewording is used only if it keeps every number/phone, adds none, and keeps or omits a question as the
  // original did. Safety wording, summaries, consent steps, links and private turns are never reworded.
  if (source !== 'gemini' && !privateTurn && !PRIVATE_PAYMENT_DETAIL.test(input) && !/\d[\d\s()-]{6,}\d|@/u.test(input) && state.handoffKind !== 'safety' && reply.length >= 45 && reply.length <= 600
    && !/https?:\/\//u.test(reply) && !(state.phase === 'booking' && state.step === 'rental_confirm') && !state.completedRequestId) {
    try {
      const reworder = store.rewordTurn ?? (store.readTurn ? undefined : readBotTurn);
      const reworded = !reworder ? null : await reworder(redactServiceReference(input, state.serviceReference), {
        locale: state.locale, phase: state.phase, today: israelDate(),
        recent: state.history.filter(item => !item.private).slice(-6).map(({ from, text }) => ({ from, text: redactServiceReference(text, state.serviceReference) })),
        known: conversationalKnown(state), approvedFacts: getSmartCarApprovedFacts(state.locale), applicationReply: reply,
        conversation: { interest: state.interest, handoffDeferred: false, hasServiceReference: Boolean(state.serviceReference), step: state.step, completedRequest: false },
      });
      let text = reworded?.rephrased && !/\[[a-z ]+ removed\]/iu.test(reworded.reply) ? reworded.reply.trim() : '';
      // The office number is the one thing the model tends to drop; the application puts it back.
      if (text && reply.includes(OFFICE_PHONE) && !text.includes(OFFICE_PHONE)) {
        text = `${text.replace(/\s*(?:אפשר גם להתקשר(?: אלינו)?(?: ישירות)?|You can also call us(?: directly)?)\.?\s*$/iu, '').trim()} ${he ? `לעזרה מיידית אפשר להתקשר ל־${OFFICE_PHONE}.` : `For immediate help call ${OFFICE_PHONE}.`}`;
      }
      const digits = (value: string) => (value.match(/\d[\d\-–.,:/]*\d|\d/gu) ?? []).map(n => n.replace(/[^\d]/g, ''));
      const original = digits(reply);
      const keepsNumbers = digits(text).every(n => original.includes(n)) && original.every(n => digits(text).includes(n));
      // A question in the application wording must survive; one added question is allowed only for a missing booking reference.
      // No new timing promise ("מחר בבוקר", "today", "בהקדם") that the application did not make.
      const timing = /(?<![\p{L}])(?:מחר|היום|הערב|בבוקר|בהקדם|תוך|בעוד|מיד|עוד מעט)(?![\p{L}])|\b(?:tomorrow|today|tonight|this (?:morning|evening|afternoon)|shortly|soon|within|right away|asap)\b/giu;
      const timingOk = (text.match(timing) ?? []).every(word => new RegExp(word, 'iu').test(reply));
      const sameQuestionShape = timingOk && (/[?؟]/u.test(reply) ? /[?؟]/u.test(text) : !/[?؟]/u.test(text) || state.phase === 'service' && !state.serviceReference && (text.match(/[?؟]/gu) ?? []).length === 1
        && /(?:מספר ה?הזמנה|השם ש?על ההזמנה|על איזה שם|booking (?:number|reference)|name on the booking)[^.!?؟]{0,60}[?؟]/iu.test(text));
      const languageOk = state.locale === 'he' ? /[א-ת]/u.test(text) : !/[א-ת]/u.test(text) && /[A-Za-z]/.test(text);
      if (text && text !== reply && keepsNumbers && sameQuestionShape && languageOk && text.length >= reply.length * 0.5 && text.length <= Math.min(650, reply.length * 1.7 + 40)
        && !/[\u0E00-\u0E7F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/u.test(text) && (reply.includes('₪') || !/₪|ש״ח|NIS/u.test(text))) {
        reply = text; model = reworded!.model; draftNotes.push('reworded');
      } else if (store.isSimulation) draftNotes.push(`reword_rejected: ${text.slice(0, 120)}`);
    } catch { /* keep the application wording */ }
  }
  // A representative does not repeat the same question after every answer. If the reply ends with a
  // question the previous bot message already asked and the customer asked something else instead,
  // answer and leave it; on a go-ahead, ask it the way a person would ("להחזיר גם בהרצליה?").
  {
    const previousBot = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
    const returnQuestion = question('returnLocation', state.locale);
    const trailing = [returnQuestion, question('pickupLocation', state.locale), question('vehicleNeed', state.locale)].find(q => reply.trim().endsWith(q) && previousBot.includes(q));
    const body = trailing ? reply.trim().slice(0, -trailing.length).trim() : '';
    const homeCity = state.booking.pickupLocation?.match(/^(?:מסירה עד הבית|Home delivery) \((.+)\)$/u)?.[1];
    const sameReturn = !state.booking.pickupLocation ? '' : homeCity
      ? (he ? `ובסוף לאסוף את הרכב גם מהבית ב${homeCity}?` : `And collect the car from the same place in ${homeCity} at the end?`)
      : (he ? `להחזיר גם ב${state.booking.pickupLocation}?` : `Return it to ${state.booking.pickupLocation} as well?`);
    if (sameReturn && !state.booking.returnLocation && reply.trim().endsWith(returnQuestion)) {
      // With a known pickup, ask about the return the way a person would; never ask it twice in a row.
      const rest = reply.trim().slice(0, -returnQuestion.length).trim();
      const askedJustNow = previousBot.includes(returnQuestion) || previousBot.includes(sameReturn);
      // One question at a time: if the rest already asks something, the return question waits.
      reply = (askedJustNow || /[?؟]/u.test(rest)) && rest.length >= 12 && state.phase !== 'booking' ? rest.replace(/[:：]\s*$/u, '?') : `${rest} ${sameReturn}`.trim();
    } else if (trailing && body.length >= 12 && state.phase !== 'booking'
      // Only when the customer asked something else or the answer already moves on; "Daniel, 21" must not end on "Thanks, Daniel."
      && (/[?؟]/u.test(body) || /[?؟]|^\s*(?:מה|איך|כמה|האם|אפשר|יש|למה|מתי|what|how|can|do|does|is|are|why|when|could)(?![\p{L}])/iu.test(input))) reply = body;
  }
  // A rental enquiry in progress never ends on a statement: the next thing still needed is asked, and a name given now is thanked.
  if (state.phase === 'explore' && !state.interest && !state.handedOff && !state.completedRequestId && source !== 'safety'
    && (state.booking.pickupDate || state.booking.pickupLocation || state.booking.vehicleNeed)) {
    const missing = nextMissing(state.booking);
    if (!/[?؟]/u.test(reply) && missing && missing !== 'customerEmail' && !/לא יודע|לא בטוח|אין לי מושג|עוד לא החלטתי|don'?t know|not sure|no idea|haven'?t decided/iu.test(input) && !/כשתרצ|when(?:ever)? you(?:'re| are)? ready/iu.test(reply)) {
      const homeCity = state.booking.pickupLocation?.match(/^(?:מסירה עד הבית|Home delivery) \((.+)\)$/u)?.[1];
      const ask = missing === 'returnLocation' && state.booking.pickupLocation
        ? (homeCity ? (he ? `ובסוף לאסוף את הרכב גם מהבית ב${homeCity}?` : `And collect the car from the same place in ${homeCity} at the end?`) : (he ? `להחזיר גם ב${state.booking.pickupLocation}?` : `Return it to ${state.booking.pickupLocation} as well?`))
        : question(missing, state.locale);
      reply = `${reply} ${ask}`.trim();
    }
  }
  // A person does not paste the same sentences twice in a row (the backup wording when the model is unavailable).
  {
    const previousBot = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
    if (previousBot && !reply.includes('\n') && state.step !== 'rental_confirm' && state.phase !== 'service' && source !== 'safety' && !state.handedOff) {
      const sentences = reply.match(/[^.!?؟]+[.!?؟]+/gu) ?? [];
      const kept = sentences.filter(sentence => /[?؟]/u.test(sentence) || sentence.trim().length < 25 || sentence.includes(OFFICE_PHONE) || !previousBot.includes(sentence.trim()));
      if (kept.length && kept.length < sentences.length && kept.join('').trim().length >= 12) reply = kept.join('').trim();
    }
  }
  // Owner rule: the airport surcharge is mentioned (without the amount) once the airport is part of the rental.
  {
    const airport = /^(?:נתב״ג|Ben Gurion Airport)$/u.test(state.booking.pickupLocation ?? '') || /^(?:נתב״ג|Ben Gurion Airport)$/u.test(state.booking.returnLocation ?? '');
    const mentioned = [...state.history.filter(entry => entry.from === 'bot').map(entry => entry.text), reply].some(text => /(?:נתב.?ג|airport)[^.!?؟]{0,60}(?:תוספת|surcharge|extra charge|fee)|(?:תוספת|surcharge|extra charge|fee)[^.!?؟]{0,60}(?:נתב.?ג|airport)/iu.test(text));
    if (airport && !mentioned && state.phase === 'explore' && !state.interest && !state.handedOff && !state.completedRequestId && source !== 'safety' && state.step !== 'rental_confirm' && reply.length < 400) {
      const note = he ? 'רק לידיעתכם, על איסוף או החזרה בנתב״ג יש תוספת, והסכום נסגר מול נציג SmartCar.' : 'Just so you know, there is a surcharge for pickup or return at Ben Gurion Airport; the amount is set with a SmartCar representative.';
      const ask = reply.match(/[^.!?؟]*[?؟]\s*$/u)?.[0] ?? '';
      reply = ask ? `${reply.slice(0, reply.length - ask.length).trim()} ${note} ${ask.trim()}`.trim() : `${reply} ${note}`.trim();
    }
  }
  {
    const firstName = !turnStartName && state.booking.customerName ? state.booking.customerName.split(/\s+/)[0] : '';
    if (firstName && !reply.includes(firstName) && !state.interest && !state.handedOff && !state.completedRequestId && source !== 'safety'
      && state.step !== 'rental_confirm' && /[?؟]\s*$/u.test(reply) && reply.length < 200) reply = `${he ? `תודה, ${firstName}.` : `Thanks, ${firstName}.`} ${reply}`.trim();
  }
  // "5 days in March" then "we land March 12": once the pickup is known, the earlier length gives the return.
  // Also when the pickup moved this turn and the return was not restated ("land March 12" after a guess of the 14th).
  const pickupMoved = Boolean(turnStartPickup && state.booking.pickupDate !== turnStartPickup && state.booking.returnDate === turnStartReturn);
  if (state.booking.pickupDate && (!state.booking.returnDate || pickupMoved) && !state.interest && state.phase !== 'service') {
    const days = [...state.history.filter(entry => entry.from === 'customer').map(entry => entry.text), input].map(text => statedDurationDays(text.replace(/\b(?:in|ב)\s*(?:january|february|march|april|may|june|july|august|september|october|november|december|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\b/giu, ''))).filter((value): value is number => Boolean(value)).at(-1);
    if (days && days <= 60) {
      const start = new Date(`${state.booking.pickupDate}T12:00:00Z`);
      start.setUTCDate(start.getUTCDate() + days);
      state.booking.returnDate = start.toISOString().slice(0, 10);
    }
  }
  // One name for the airport in the request ("the airport", "TLV", "נתב\"ג" → the branch label).
  for (const key of ['pickupLocation', 'returnLocation'] as const) {
    const place = state.booking[key];
    if (place && /^(?:(?:the )?airport|tlv|ben[- ]gurion(?: airport)?|natbag|נתב.?ג|שדה ה?תעופה(?: בן גוריון)?)$/iu.test(place.trim())) state.booking[key] = he ? 'נתב״ג' : 'Ben Gurion Airport';
  }
  // A person does not open every message with the same word ("בשמחה!", "Got it,").
  {
    const opener = (text: string) => text.trim().match(/^([\p{L}'’]+(?:\s[\p{L}'’]+)?)[!,.—–]/u)?.[1]?.toLowerCase();
    const previousBotText = [...state.history].reverse().find(entry => entry.from === 'bot')?.text ?? '';
    const current = opener(reply);
    if (current && current === opener(previousBotText) && reply.length > current.length + 15) {
      const rest = reply.trim().slice(current.length).replace(/^[!,.—–\s]+/u, '');
      reply = rest.charAt(0).toUpperCase() + rest.slice(1);
    }
  }
  // Known Hebrew slips of the model (wording only, not meaning).
  if (he) reply = reply.replace(/(?<![\p{L}])(אנו|אנחנו) מצערים(?![\p{L}])/gu, '$1 מצטערים').replace(/(?<![\p{L}])אני מצער(?![\p{L}])/gu, 'אני מצטער').replace(/(?<![\p{L}])בבשמחה(?![\p{L}])/gu, 'בשמחה').replace(/^\s*בכיכר\s*([,!.])/u, 'בכיף$1');
  // The light model sometimes opens with a non-word ("בכיחוד!"); a lone unknown exclamation word is dropped.
  if (he) {
    const opener = reply.match(/^\s*([\u0590-\u05FF]+)!\s+/u);
    if (opener && !/^(?:בשמחה|מעולה|בטח|מצוין|אחלה|בכיף|סבבה|נהדר|וואו|היי|שלום|תודה|אוקיי|כמובן|ברור|יופי|נעים|איזה|אוי|אחי|הי|ערב|בוקר|מזל|כיף|יאללה|נשמע|טוב|בהחלט|בדיוק|נכון|חבל|מצטער|מצטערת|מצטערים|סליחה|ממש|רגע|הבנתי)$/u.test(opener[1])) reply = reply.slice(opener[0].length);
  }
  // A person greets once. Later replies start with the answer.
  if (state.history.some(entry => entry.from === 'bot')) {
    const withoutGreeting = reply.replace(/^\s*(?:שלום(?: רב)?|היי|הי|אהלן|בוקר טוב|ערב טוב|צהריים טובים|hi(?: there)?|hello|hey|good (?:morning|evening|afternoon))\s*[!,.]\s*/iu, '');
    if (withoutGreeting.length >= 12 && withoutGreeting !== reply) reply = withoutGreeting.charAt(0).toUpperCase() + withoutGreeting.slice(1);
  }
  // One mention of calling the office is enough.
  if (reply.includes(OFFICE_PHONE)) reply = reply.replace(/\s*(?:אפשר גם להתקשר אלינו(?: למשרד)?(?: ישירות)?(?: בכל עת)?|You can also call (?:us|our office)(?: directly)?(?: at any time)?)\.(?=\s)/giu, '');
  pushHistory(state, input, reply, privateTurn);
  if (escalate && !store.isSimulation) await store.beforeEscalationSave?.(phone);
  await store.saveState(phone, state);
  return { reply, state, escalate, source, model, notes: store.isSimulation ? [...new Set(draftNotes)] : undefined };
}
