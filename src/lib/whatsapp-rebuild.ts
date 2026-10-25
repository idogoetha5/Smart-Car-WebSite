import { OFFICE_PHONE } from '@/lib/constants';
import { getBusinessKnowledgeResponse } from '@/lib/whatsapp-business-knowledge';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { readBotTurn, type BotReading, type GeminiBotContext, type VehicleDirection } from '@/lib/whatsapp-rebuild-gemini';

type Locale = 'he' | 'en';
type Phase = 'explore' | 'booking' | 'service';
type BookingKey = 'pickupDate' | 'returnDate' | 'pickupLocation' | 'returnLocation' | 'vehicleNeed' | 'customerName' | 'customerEmail';
type BookingDraft = Partial<Record<BookingKey, string>> & { passengers?: number; luggage?: number; childSeats?: number };
type HistoryEntry = { from: 'customer' | 'bot'; text: string; private?: boolean };

export type RebuildState = {
  version: 2;
  phase: Phase;
  step: 'menu' | 'rental_dates' | 'rental_locations' | 'rental_vehicle' | 'rental_name' | 'rental_email' | 'rental_confirm';
  locale: Locale;
  booking: BookingDraft;
  history: HistoryEntry[];
  handedOff?: boolean;
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

const ORDER: BookingKey[] = ['pickupDate', 'returnDate', 'pickupLocation', 'returnLocation', 'vehicleNeed', 'customerName', 'customerEmail'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OUTSIDE = /מוני(?:ת|ות)|אוטובוס|רכבת|תחבורה ציבורית|אוויס|אלדן|סיקסט|הרץ|מתחר|חברת השכרה אחרת|\btaxi\b|\bbus\b|\btrain\b|\buber\b|\bavis\b|\bhertz\b|\bsixt\b|competitor|another rental company/i;
const UNSAFE_CLAIM = /(?:יש לנו|יש אצלנו|זמין עכשיו|זמין בדיוק|פנוי עכשיו|מובטח|בטוח ש|בהחלט ייכנס|בהחלט יתאים|we have available|guaranteed|definitely fits|confirmed booking)/i;

function language(input: string, previous: Locale): Locale {
  if (/עברית|hebrew/i.test(input)) return 'he';
  if (/english|אנגלית/i.test(input)) return 'en';
  if (EMAIL.test(input.trim()) || /(?:\+972|0)[\d\s()-]{8,}/.test(input)) return previous;
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
  if (missing === 'customerName') return 'rental_name';
  return 'rental_email';
}

function question(key: BookingKey, locale: Locale): string {
  const he: Record<BookingKey, string> = {
    pickupDate: 'באיזה תאריך תרצו לאסוף את הרכב?', returnDate: 'באיזה תאריך תחזירו את הרכב?',
    pickupLocation: 'מאיפה תרצו לאסוף את הרכב?', returnLocation: 'איפה תרצו להחזיר אותו?',
    vehicleNeed: 'איזה סוג רכב תרצו, או כמה נוסעים וציוד יהיו?', customerName: 'על איזה שם לרשום את הבקשה?',
    customerEmail: 'לאיזו כתובת מייל לשלוח את סיכום הבקשה?',
  };
  const en: Record<BookingKey, string> = {
    pickupDate: 'What date would you like to pick up the car?', returnDate: 'What date will you return it?',
    pickupLocation: 'Where would you like to pick it up?', returnLocation: 'Where will you return it?',
    vehicleNeed: 'What kind of car do you need, or how many passengers and bags?', customerName: 'What name should I put on the request?',
    customerEmail: 'What email address should receive the request summary?',
  };
  return (locale === 'he' ? he : en)[key];
}

function israelDate(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); }
function validDate(value: string): boolean { return /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }

function explicitBooking(input: string): boolean {
  if (/לא רוצה להזמין|רק מתעניין|רק שואל|לא עכשיו|not ready|just asking|don't book|do not book/i.test(input)) return false;
  if (/[?؟]/.test(input) && /כדאי|האם|should|would it|how/i.test(input)) return false;
  return /אני רוצה (?:להזמין|לשכור)|בוא(?:ו)? נתקדם|אפשר להתחיל (?:הזמנה|בקשה)|תכין(?:ו)? (?:לי )?בקשה|אני (?:אזמין|אשכור)|I(?:'d| would) like to (?:book|rent)|let'?s (?:book|proceed)|I want to (?:book|rent)/i.test(input);
}

function safety(input: string): 'accident' | 'breakdown' | null {
  if (/מה קורה אם|אם תהיה|hypothetical|what if/i.test(input)) return null;
  if (/תאונה|התנגשות|נפגע|פצוע|accident|crash|collision|injured/i.test(input)) return 'accident';
  if (/פנצ[׳']?ר|גרר|נתקעתי|לא מניע|רעש.{0,25}בלמ|בלמ.{0,25}רעש|עשן|תקלה ברכב|flat tire|breakdown|won'?t start|brake.{0,25}(?:noise|problem)|(?:noise|problem).{0,25}brake/i.test(input)) return 'breakdown';
  return null;
}

function direction(reading: BotReading | null, draft: BookingDraft, input: string): VehicleDirection {
  const people = draft.passengers ?? 0;
  if (people >= 6) return 'seven_seat';
  if (draft.childSeats || /תינוק|ילד|כיסא בטיחות|baby|child seat|car seat/i.test(input)) return 'family';
  if (people >= 3 || (draft.luggage ?? 0) >= 3) return 'family';
  if (/פגיש|עיר|חניה|city|meeting|parking/i.test(input)) return 'compact';
  return reading?.direction && reading.direction !== 'none' ? reading.direction : 'none';
}

function advice(input: string, state: RebuildState, reading: BotReading | null): string {
  const he = state.locale === 'he';
  const group = direction(reading, state.booking, input);
  const topic = /תינוק|ילד|כיסא בטיחות|baby|child seat|car seat/i.test(input) || Boolean(state.booking.childSeats) ? 'child' :
    /פגיש|עיר|חניה|city|meeting|parking/i.test(input) ? 'city' : 'trip';
  const lead = he ? ({ compact: 'הייתי מתחיל מרכב קומפקטי של SmartCar', family: 'הייתי מתחיל ממשפחתית של SmartCar', suv: 'ג׳יפון של SmartCar הוא כיוון לבדיקה', seven_seat: 'הייתי בודק רכב שבעה מקומות של SmartCar', none: 'אפשר לבחור רכב של SmartCar לפי הנסיעה שלכם' } as const)[group]
    : ({ compact: 'I would start with a SmartCar compact', family: 'I would start with a SmartCar family car', suv: 'A SmartCar SUV is a direction to check', seven_seat: 'I would check a SmartCar seven-seater', none: 'We can choose a SmartCar car around your trip' } as const)[group];
  const benefit = he ? topic === 'child' ? 'זה כיוון נוח לבדיקת מקום לנוסעים ולציוד; את התאמת כיסא הבטיחות צריך לוודא בדגם המסוים.' : topic === 'city' ? 'רכב שיעמוד לרשותכם בין היעדים נותן גמישות לאורך היום.' : 'כך אפשר להתאים את המרחב והנוחות למשך הנסיעה ולציוד שלכם.'
    : topic === 'child' ? 'It is a good starting point for passenger and luggage space; the child seat must be checked against the actual car.' : topic === 'city' ? 'Having the car at your disposal gives flexibility between stops during the day.' : 'We can match passenger space and comfort to the trip and your luggage.';
  const next = state.booking.pickupDate ? (he ? 'מאיפה תרצו לאסוף?' : 'Where would you like to pick it up?') : (he ? 'לאילו תאריכים תצטרכו את הרכב?' : 'What dates do you need the car?');
  const price = /כמה עולה|מחיר|עלות|זמין|פנוי|how much|price|cost|available/i.test(input)
    ? (he ? 'מחיר וזמינות מדויקים דורשים בדיקה לתאריכים ולדגם; אין לי אישור מלאי כרגע. ' : 'Exact price and availability need checking for the dates and vehicle; I cannot confirm inventory here. ') : '';
  return `${lead}. ${benefit} ${price}${next}`.replace(/\s+/g, ' ').trim();
}

function safeModelReply(reading: BotReading | null, input: string, state: RebuildState): string | null {
  if (!reading || OUTSIDE.test(input) || /תינוק|ילד|כיסא בטיחות|baby|child seat|car seat/i.test(input)) return null;
  if (/כמה עולה|מחיר|עלות|זמין|פנוי|how much|price|cost|available/i.test(input)) return null;
  const reply = reading.reply;
  if (OUTSIDE.test(reply) || UNSAFE_CLAIM.test(reply) || /₪|\b\d{2,}\b/.test(reply)) return null;
  if (reply.length > 40 && !/[.!?…]$/.test(reply)) return null;
  if ((reply.match(/[?؟]/g) ?? []).length > 1) return null;
  if (state.locale === 'he' && !/[א-ת]/.test(reply)) return null;
  if (state.locale === 'en' && /[א-ת]/.test(reply)) return null;
  return reply;
}

function applyFields(input: string, state: RebuildState, reading: BotReading | null): void {
  if (!reading) return;
  const fields = reading.fields;
  for (const [source, target] of [['pickupDate', 'pickupDate'], ['returnDate', 'returnDate'], ['pickupLocation', 'pickupLocation'], ['returnLocation', 'returnLocation'], ['vehicleNeed', 'vehicleNeed']] as const) {
    const field = fields[source];
    if (!field || !input.toLocaleLowerCase().includes(field.evidence.toLocaleLowerCase())) continue;
    if ((source === 'pickupDate' || source === 'returnDate') && !validDate(field.value)) continue;
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
}

function privateDetail(input: string, state: RebuildState): boolean {
  if (state.step === 'rental_email') {
    const email = input.trim();
    if (EMAIL.test(email) && email.length <= 160) { state.booking.customerEmail = email; return true; }
  }
  if (state.step === 'rental_name') {
    const explicit = input.match(/(?:קוראים לי|שמי|השם שלי|my name is|I am)\s+([\p{L}' -]{3,60})/iu)?.[1]?.trim();
    const candidate = explicit ?? (/^[\p{L}' -]{3,60}$/u.test(input.trim()) ? input.trim() : '');
    if (candidate && candidate.split(/\s+/).length <= 4) { state.booking.customerName = candidate; return true; }
  }
  return false;
}

function summary(state: RebuildState): string {
  const b = state.booking;
  if (state.locale === 'en') return `Request summary: ${b.vehicleNeed}, ${b.pickupDate} to ${b.returnDate}, pickup ${b.pickupLocation}, return ${b.returnLocation}, name ${b.customerName}, email ${b.customerEmail}. This is a request, not a confirmed booking. Reply “I confirm” to send it.`;
  return `סיכום הבקשה: ${b.vehicleNeed}, מ־${b.pickupDate} עד ${b.returnDate}, איסוף ב${b.pickupLocation}, החזרה ב${b.returnLocation}, שם ${b.customerName}, מייל ${b.customerEmail}. זו בקשה לבדיקה, לא הזמנה מאושרת. שלחו ״אני מאשר/ת״ כדי לשלוח אותה.`;
}

function pushHistory(state: RebuildState, input: string, reply: string, privateTurn: boolean): void {
  state.history.push({ from: 'customer', text: input.slice(0, 450), private: privateTurn }, { from: 'bot', text: reply.slice(0, 650), private: privateTurn });
  state.history = state.history.slice(-20);
}

export async function getRebuiltBotReply(phone: string, raw: string, store: RebuildStore): Promise<RebuildResult> {
  const input = raw.trim().slice(0, 1000);
  const stored = await store.loadState(phone);
  const state = stored?.version === 2 ? structuredClone(stored) : fresh(language(input, 'he'));
  state.locale = language(input, state.locale);
  const he = state.locale === 'he';
  let reply = '';
  let source: RebuildResult['source'] = 'local';
  let model: string | undefined;
  let escalate = false;
  let privateTurn = false;

  const incident = safety(input);
  if (incident) {
    state.phase = 'service'; state.handedOff = true;
    reply = he ? `אם הרכב אינו בטוח, אל תמשיכו לנסוע. עצרו במקום בטוח אם אפשר; אם יש סכנה מיידית או נפגעים, פנו לגורמי החירום. התקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.` : `If the car may be unsafe, do not continue driving. Stop somewhere safe if you can; call emergency services if anyone is hurt or in immediate danger. Call SmartCar now: ${OFFICE_PHONE}.`;
    source = 'safety'; escalate = true;
  } else if (state.handedOff) {
    reply = he ? `הפנייה דורשת טיפול של הצוות. אפשר להתקשר ל־SmartCar: ${OFFICE_PHONE}.` : `The team needs to handle this case. You can call SmartCar on ${OFFICE_PHONE}.`;
  } else if (state.phase === 'booking' && state.step === 'rental_confirm' && /^(?:אני מאשר(?:ת)?|מאשר(?:ת)?|כן,? מאשר(?:ת)?|i confirm|confirm)$/i.test(input)) {
    const id = await store.createRentalRequest(phone, state);
    if (id) {
      state.completedRequestId = id; state.phase = 'explore'; state.step = 'menu';
      reply = store.isSimulation ? (he ? 'בסימולציה הבקשה נקלטה לצורכי בדיקה בלבד; לא נוצרה הזמנה אמיתית.' : 'The request was recorded in this simulation only; no real booking was created.') : (he ? `בקשת ההשכרה נשלחה לבדיקה, מספר ${id}. היא עדיין אינה הזמנה מאושרת.` : `Your rental request was sent for review, reference ${id}. It is not a confirmed booking yet.`);
    } else reply = he ? 'לא הצלחתי לשמור את הבקשה כרגע. לא נוצרה הזמנה; אפשר לנסות שוב או להתקשר למשרד.' : 'I could not save the request. No booking was created; please try again or call the office.';
  } else {
    privateTurn = state.phase === 'booking' && (state.step === 'rental_name' || state.step === 'rental_email');
    const gotPrivate = privateDetail(input, state);
    let reading: BotReading | null = null;
    if (!gotPrivate && !EMAIL.test(input) && !/(?:\+972|0)[\d\s()-]{8,}/.test(input)) {
      const context: GeminiBotContext = {
        locale: state.locale, phase: state.phase, today: israelDate(),
        recent: state.history.filter(item => !item.private).slice(-8).map(({ from, text }) => ({ from, text })),
        known: { pickupDate: state.booking.pickupDate, returnDate: state.booking.returnDate, pickupLocation: state.booking.pickupLocation, returnLocation: state.booking.returnLocation, vehicleNeed: state.booking.vehicleNeed, passengers: state.booking.passengers, luggage: state.booking.luggage, childSeats: state.booking.childSeats },
      };
      reading = await (store.readTurn ?? readBotTurn)(input, context);
      if (reading) { model = reading.model; applyFields(input, state, reading); }
    }
    const wantsBooking = explicitBooking(input) || (state.phase === 'booking' && !/לא רוצה להזמין|אל תזמין|don't book|cancel this request/i.test(input));
    if (state.phase === 'booking' && /לא רוצה להזמין|אל תזמין|don't book|cancel this request/i.test(input)) {
      state.phase = 'explore'; state.step = 'menu';
      reply = he ? 'בסדר, לא שלחתי בקשה. הפרטים יישארו כאן אם תרצה להמשיך להתלבט.' : 'Okay, I have not sent a request. The details stay here if you want to think it over.';
    } else if (wantsBooking) {
      state.phase = 'booking';
      const missing = nextMissing(state.booking);
      state.step = bookingStep(missing);
      if (!missing) reply = summary(state);
      else {
        const prefix = /כמה עולה|מחיר|עלות|זמין|פנוי|how much|price|cost|available/i.test(input)
          ? (he ? 'מחיר וזמינות סופיים ייבדקו לפי הרכב והתאריכים. ' : 'Final price and availability need checking for the dates and car. ') : '';
        const policy = reading?.route === 'policy' ? getSmartCarServiceAnswer(input, state.locale)?.reply : null;
        reply = `${policy ? `${policy}\n\n` : prefix}${question(missing, state.locale)}`;
      }
    } else if (reading?.route === 'human' || /(?:דבר|לדבר|נציג|בן אדם|human|representative|person)/i.test(input) && /רוצה|אפשר|need|want|speak/i.test(input)) {
      state.phase = 'service'; state.handedOff = true; escalate = true;
      reply = he ? `כדי שהצוות יטפל בזה, התקשרו ל־SmartCar: ${OFFICE_PHONE}.` : `Please call SmartCar so the team can handle this: ${OFFICE_PHONE}.`;
    } else if (reading?.route === 'service' || /הזמנה קיימת|ההזמנה שלי|שכרתי|existing booking|my booking|I rented/i.test(input)) {
      state.phase = 'service';
      const booking = await store.activeBooking(phone);
      const answer = getSmartCarServiceAnswer(input, state.locale);
      if (answer) reply = answer.reply;
      else if (booking) reply = he ? `מצאתי הזמנה במצב ${booking.status}. שינוי או בירור ספציפי דורשים טיפול צוות; התקשרו ל־${OFFICE_PHONE}.` : `I found a booking with status ${booking.status}. A specific change or case review needs the team; please call ${OFFICE_PHONE}.`;
      else reply = he ? `כדי לבדוק מקרה מסוים נדרש מספר ההזמנה. אפשר גם להתקשר ל־${OFFICE_PHONE}.` : `To check a specific case, please send the booking reference or call ${OFFICE_PHONE}.`;
    } else if (reading?.route === 'policy') {
      const fact = getSmartCarServiceAnswer(input, state.locale) ?? getBusinessKnowledgeResponse(input, state.locale);
      reply = fact?.reply ?? (he ? 'את התנאי המדויק צריך לבדוק בהצעה ובחוזה הרלוונטיים. מה בדיוק חשוב לך לברר?' : 'The exact term needs checking in the relevant offer and agreement. What would you like to clarify?');
    } else if (reading?.route === 'leasing' || reading?.route === 'sale') {
      reply = reading.route === 'leasing'
        ? (he ? 'ב־SmartCar יש ליסינג פרטי ועסקי. התאמת הרכב והתשלום תלויה במשך ובקילומטראז׳ שבהצעה. לכמה זמן תצטרך את הרכב?' : 'SmartCar offers private and business leasing. Vehicle and payment depend on the term and mileage in the offer. How long would you need the car?')
        : (he ? 'אפשר לבדוק את הרכבים של SmartCar למכירה לפי הצורך והתקציב שלך. איזה סוג רכב אתה מחפש?' : 'We can look at SmartCar cars for sale around your needs and budget. What kind of car are you looking for?');
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
