import { createAdminClient } from '@/lib/supabase/server';
import { OFFICE_PHONE } from '@/lib/constants';
import { normalizeWhatsAppPhone } from '@/lib/rental-quote';
import { normalizeEmail } from '@/lib/email';
import { termsConsent } from '@/lib/consent';
import { getWhatsAppRentalQuotes, type WhatsAppRentalQuote } from '@/lib/whatsapp-rental-quotes';
import { rentalConfirmationIntro, rentalServicePrompt } from '@/lib/whatsapp-rental-service';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { composeServiceResponse, detectConversationMood } from '@/lib/service-response';
import { consultativeSalesReply } from '@/lib/consultative-sales';
import { getCarsForSale, type CarForSale } from '@/lib/cars-for-sale';
import {
  classifyCommercialIntent,
  commercialIntentQuestion,
  getCarSalesReply,
  isCarSaleConversation,
  ownCarSaleHandoff,
  type CarSalesContext,
} from '@/lib/car-sales-flow';

type FlowStep = 'menu' | 'rental_dates' | 'rental_times' | 'rental_locations' | 'rental_vehicle' | 'rental_name' | 'rental_email' | 'rental_confirm';
type FlowLocale = 'he' | 'en';
type LeasingKind = 'private' | 'business' | 'unknown';

export interface FlowState {
  step: FlowStep;
  /** A human is handling this conversation; keep the collected facts but stop auto-routing it. */
  handedOff?: boolean;
  pickupDate?: string;
  dropoffDate?: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  vehiclePreference?: string;
  /** Safe trip needs, captured to help a representative choose a category. */
  passengers?: number;
  luggage?: number;
  childSeats?: number;
  tripNeeds?: string;
  customerName?: string;
  customerEmail?: string;
  /** Booking reference supplied after the customer selects an existing-booking enquiry. */
  bookingReference?: string;
  locale?: FlowLocale;
  /** Context for a purchase of a car listed in the verified sales catalogue. */
  carSale?: CarSalesContext;
  lastQuestion?: string;
  /** Leasing has no self-service quote path; retain its verified intent for the representative. */
  leasing?: { kind: LeasingKind };
}

export interface BookingSummary {
  id: string;
  status: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_location: string;
  dropoff_location: string;
  customer_name: string;
  vehicle: { make: string | null; model: string | null } | null;
}

export interface WhatsAppFlowResult {
  handled: boolean;
  reply?: string;
  escalate?: boolean;
  escalateReason?: string;
}

type ServiceIntent = 'policy' | 'delivery_return' | 'leasing_sale' | 'existing_booking' | 'unknown';

export interface WhatsAppFlowStore {
  activeBooking(phone: string): Promise<BookingSummary | null>;
  loadState(phone: string): Promise<FlowState | null>;
  saveState(phone: string, state: FlowState | null): Promise<void>;
  /** The public demo rehearses a journey only; it must never create a record or imply that it did. */
  isSimulation?: boolean;
  createRentalRequest(phone: string, state: FlowState, locale: FlowLocale): Promise<string | null>;
  getRentalQuotes?(state: FlowState): Promise<WhatsAppRentalQuote[]>;
  getCarsForSale?(): Promise<CarForSale[]>;
  recordLanguageCandidate?(candidate: { phrase: string; field: 'vehicle' | 'time' | 'location'; proposedValue?: string }): Promise<void>;
  resolveApprovedVariant?(phrase: string, field: 'vehicle'): Promise<string | null>;
}

export type WhatsAppInitialRoute = 'accident' | 'breakdown' | 'rental' | 'existing_booking_lookup' | 'existing_customer' | 'new_customer';

const NEW_CUSTOMER_MENU = `ברוכים הבאים ל־SmartCar 👋

נשמח לעזור לכם למצוא את הרכב המתאים — להשכרה, ליסינג או רכישה.

איך נוכל לעזור?
1️⃣ השכרת רכב
2️⃣ בירור לגבי הזמנה קיימת
3️⃣ ליסינג או רכבים למכירה
4️⃣ סניפים, מסירה והחזרה
5️⃣ לדבר עם נציג
6️⃣ עזרה בדרך — תאונה, פנצ׳ר או תקלה

אפשר להשיב עם מספר האפשרות, לכתוב "תפריט" בכל שלב, או לכתוב English למעבר לאנגלית.`;

const NEW_CUSTOMER_MENU_EN = `Welcome to SmartCar 👋

We’re here to help with car rental, leasing, or purchasing a vehicle.

1️⃣ Rent a car
2️⃣ Existing booking
3️⃣ Leasing or cars for sale
4️⃣ Branches, delivery and return
5️⃣ Speak with a representative
6️⃣ Roadside help — accident, flat tyre or breakdown

Reply with a number, type menu at any time, or write עברית for Hebrew.`;

// Conservative, domain-only corrections. We never rewrite names, addresses or
// free text — only a small list whose intended meaning is unambiguous.
const SAFE_TYPOS: Record<string, string> = {
  תעונה: 'תאונה', תאונע: 'תאונה', תאונהה: 'תאונה', פנצאר: 'פנצר', פאנצר: 'פנצר', פנצשר: 'פנצר',
  אפרל: 'אפריל', אפרייל: 'אפריל', אפירל: 'אפריל', אפרילל: 'אפריל', פבואר: 'פברואר',
  הרצלייה: 'הרצליה', ירושליים: 'ירושלים', נתבגג: 'נתבג', נטבג: 'נתבג',
  בוקרר: 'בבוקר', בבקר: 'בבוקר', בערבב: 'בערב',
  aprill: 'april', aprl: 'april', febuary: 'february', februrary: 'february', agust: 'august',
  septembar: 'september', octobar: 'october', decembar: 'december', arond: 'around',
  accidnet: 'accident', acident: 'accident', colision: 'collision', punctuer: 'puncture', breakdwon: 'breakdown',
};

function normalized(input: string) {
  const cleaned = input.trim().toLowerCase().replace(/[״"']/g, '').replace(/\s+/g, ' ');
  // Preserve the punctuation and free text, but correct only complete known
  // domain words. This lets "aprl," and "פנצאר!" work without touching names
  // or addresses that happen to contain a similar sequence.
  return cleaned.replace(/[a-z\u0590-\u05ff]+/gi, (word) => SAFE_TYPOS[word] ?? word);
}

function wordsForMatching(input: string) {
  return normalized(input).replace(/[^a-z\u0590-\u05ff0-9]+/gi, ' ').split(/\s+/).filter(Boolean);
}

/** Allows a single ordinary typo or a swapped adjacent letter in one keyword. */
function typoDistance(left: string, right: string) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 1) return 2;
  const matrix = Array.from({ length: left.length + 1 }, (_, row) => Array.from({ length: right.length + 1 }, (_, col) => row === 0 ? col : col === 0 ? row : 0));
  for (let row = 1; row <= left.length; row++) {
    for (let col = 1; col <= right.length; col++) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(matrix[row - 1][col] + 1, matrix[row][col - 1] + 1, matrix[row - 1][col - 1] + cost);
      if (row > 1 && col > 1 && left[row - 1] === right[col - 2] && left[row - 2] === right[col - 1]) matrix[row][col] = Math.min(matrix[row][col], matrix[row - 2][col - 2] + 1);
    }
  }
  return matrix[left.length][right.length];
}

function hasApproximateKeyword(input: string, keywords: string[]) {
  const text = normalized(input);
  const words = wordsForMatching(input);
  return keywords.some((keyword) => {
    const term = normalized(keyword);
    if (text.includes(term)) return true;
    return !term.includes(' ') && term.length >= 4 && words.some((word) => typoDistance(word, term) <= 1);
  });
}

export function detectWhatsAppLocale(input: string, previous?: FlowLocale): FlowLocale {
  const text = normalized(input);
  if (/^(?:עברית|hebrew)(?:\s+(?:please|בבקשה))?$|(?:speak|in)\s+hebrew/.test(text)) return 'he';
  if (/^(?:english)(?:\s+please)?$|(?:speak|in)\s+english/.test(text)) return 'en';
  if (previous) return previous;
  if (/[\u0590-\u05ff]/.test(text)) return 'he';
  if (/[a-z]/i.test(text)) return 'en';
  return 'he';
}

function isMenuCommand(input: string) {
  return ['תפריט', 'התחל', 'התחלה', 'שלום', 'היי', 'חזור', 'hi', 'hello', 'menu', 'start', 'back'].includes(normalized(input));
}

/**
 * `duringActiveRentalCollection` narrows this to unambiguous escalation
 * signals only. The full keyword list below includes ordinary words a
 * customer uses mid-flow for a brand-new request — "לשנות את שעת האיסוף",
 * "אני קצת מאחר", "אפשר לבטל ולהזמין רכב אחר" — none of which are actually
 * asking for a human. Those ambiguous words matter once there is a real
 * booking to modify (handled elsewhere via hasActiveBooking), but here they
 * were derailing new-request collection into a handoff on ordinary phrasing.
 */
export function requiresHumanHandoff(input: string, duringActiveRentalCollection = false) {
  const text = input.toLowerCase();
  if (/עו[״"']ד/.test(text)) return true;
  if (duringActiveRentalCollection) {
    return /נציג|נציגת|אנושי|בנאדם|בן אדם|לדבר עם|שיחה עם|תאונה|נזק|דפיקה ברכב|שריטה|שפשוף|מכה ברכב|פגיעה|חירום|דחוף|הצילו|תעזרו לי|תביעה|עורך דין|עורכת דין|משפטי|כועס|זועם|מתוסכל|מעצבן|שירות גרוע|תלונה|אכזבה|\b(?:representative|human|agent|legal|lawyer|sue|angry|mad|frustrated|upset|complaint|terrible|awful)\b|speak to|talk to|customer service/.test(normalized(input));
  }
  return /נציג|נציגת|אנושי|בנאדם|בן אדם|לדבר עם|שיחה עם|תאונה|נזק|דפיקה ברכב|שריטה|שפשוף|מכה ברכב|פגיעה|חירום|דחוף|הצילו|תעזרו לי|החזר כספי|כסף בחזרה|זיכוי|פיצוי|חיוב|תביעה|עורך דין|עורכת דין|משפטי|כועס|זועם|מתוסכל|מעצבן|שירות גרוע|תלונה|אכזבה|ביטול|לבטל|שינוי|לשנות|הארכ|להאריך|איחור|מאחר|אני אאחר|\b(?:representative|human|agent|person|someone|refund|money back|charge|charged|legal|lawyer|sue|angry|mad|frustrated|upset|cancel|cancellation|change|modify|amend|extend|extension|late|delayed|complaint|terrible|awful)\b|speak to|talk to|customer service/.test(normalized(input));
}

/**
 * Safety-sensitive intents are classified before menu or intake routing.
 * `hasActiveBooking` comes only from the sender's matching WhatsApp number.
 */
export function classifyWhatsAppInitialRoute(input: string, hasActiveBooking: boolean): WhatsAppInitialRoute {
  const text = normalized(input);
  if (/הצילו|עזרה דחוף|סכנה|לא בטוח(?! איזה (?:רכב|אוטו))|(?:^|\s)אש(?:\s|$)|אמבולנס|משטרה|פצוע|תאונה|התנגשות|התנגשתי|נכנסו בי|נפגע|פגיעה ברכב|דפקו לי את הרכב|עשיתי תאונה|רכב פגע בי|התהפכתי|accident|crash|collision|car accident|hit (?:(?:my|a) )?car|help me|emergency|danger|ambulance|police|injured|fire/.test(text)) return 'accident';
  if (hasApproximateKeyword(text, ['תאונה', 'התנגשות', 'accident', 'collision'])) return 'accident';
  if (/פנצ[׳']?ר|פנצר|תקר|צמיג|גלגל|תקלה|נתקעתי|תקוע|גרירה|גרר|לא מניע|לא מתניע|נורת אזהרה|עשן|ריח דלק|מצבר|מפתח|נעול|האוטו לא זז|בעיה במנוע|רעש מוזר|flat tire|flat tyre|flat|puncture|blowout|breakdown|dead battery|car stopped|i am stuck|im stuck|stranded|tow|wont start|won't start|warning light|smoke|fuel smell|locked out|lost key|engine issue|strange noise/.test(text)) return 'breakdown';
  if (hasApproximateKeyword(text, ['פנצר', 'תקלה', 'מצבר', 'breakdown', 'puncture', 'battery'])) return 'breakdown';
  if (/הזמנה קיימת|יש לי הזמנה|סטטוס הזמנה|מספר הזמנה|כבר הזמנתי|ההזמנה שלי|איפה ההזמנה|לגבי ההזמנה|הזמנתי אצלכם|existing booking|my booking|booking status|booking (?:number|confirmation)|reservation|already booked|where is my booking|about my reservation/.test(text)) return 'existing_booking_lookup';
  if (/השכר|להשכיר|רכב חדש|רכב ל(?:סופש|סוף שבוע|יומיים|שבוע|חודש)|הזמ|אני רוצה רכב|צריך (?:רכב|אוטו|מכונית)|מחפש (?:רכב|אוטו)|לקחת רכב|אפשר רכב|מעוניין ברכב|rent|rental|hire (?:a )?car|car hire|need .*\b(?:car|suv|vehicle)\b|looking for .*\b(?:car|suv|vehicle)\b|\b(?:family|luxury|premium) (?:car|suv|vehicle)\b|book.*car|get a car|want a car/.test(text)) return 'rental';
  if (hasApproximateKeyword(text, ['השכרה', 'לשכור', 'rental', 'rent'])) return 'rental';
  return hasActiveBooking ? 'existing_customer' : 'new_customer';
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function formatBooking(booking: BookingSummary, locale: FlowLocale) {
  const vehicle = [booking.vehicle?.make, booking.vehicle?.model].filter(Boolean).join(' ') || 'רכב SmartCar';
  if (locale === 'en') {
    const status = booking.status === 'CONFIRMED' ? 'Confirmed' : booking.status === 'PENDING' ? 'Pending confirmation' : booking.status === 'ACTIVE' ? 'Active' : booking.status;
    return `Your booking details:\n${vehicle}\nPickup: ${formatDate(booking.pickup_date)} — ${booking.pickup_location}\nReturn: ${formatDate(booking.dropoff_date)} — ${booking.dropoff_location}\nStatus: ${status}\n\nFor a change, extension, or any other assistance, type representative.`;
  }
  return `פרטי ההזמנה שלכם:\n${vehicle}\nאיסוף: ${formatDate(booking.pickup_date)} — ${booking.pickup_location}\nהחזרה: ${formatDate(booking.dropoff_date)} — ${booking.dropoff_location}\nסטטוס: ${booking.status === 'CONFIRMED' ? 'מאושרת' : booking.status === 'PENDING' ? 'ממתינה לאישור' : booking.status}\n\nאם תרצו שינוי, הארכה או עזרה אחרת — כתבו "נציג".`;
}

/**
 * Broad, deterministic service routing.  This is deliberately separate from
 * field parsing: it chooses a safe service path first, then rental intake
 * extracts facts in any order.  It never attempts to interpret contract terms
 * or account-specific bookings without a representative.
 */
function classifyServiceIntent(input: string): ServiceIntent {
  const text = normalized(input);
  if (/ביטוח|כיסוי|השתתפות עצמית|פיקדון|אשראי|דלק|תדלוק|קילומטר|קמ|נהג נוסף|גיל נהג|כיסא (?:בטיחות|תינוק|ילד)|תנאי השכרה|מקיף|חובה|צד ג|הגבלת|כמה עולה|תוספת תשלום|בוסטר|סל קל|חוזה|שעות|פתיחה|מתי פתוח|מתי עובדים|שבת|insurance|cover(?:age)?|waiver|deposit|security hold|credit card|fuel|refuel|mileage|kilomet(?:er|re)|additional driver|extra driver|driver age|child seat|terms|policy|comprehensive|third party|limit|how much is|extra cost|booster|baby seat|contract|hours|open|close/.test(text)) return 'policy';
  if (/מסיר|איסוף|החזרה|נתבג|שדה תעופה|סניף|סניפים|כתובת|איפה אתם|לשדה|מהשדה|תביאו לי|לקחת מ|להחזיר ב|מאיפה אוספים|איפה מחזירים|עד הבית|למלון|one way|different (?:return|location)|drop ?off|collect(?:ion)?|deliver(?:y)?|airport|branch|branches|locations|where are you|to the airport|from the airport|bring it to|pick it up from|where to collect|where to return|to my door|hotel/.test(text)) return 'delivery_return';
  if (/ליסינג|מכירה|רכישה|לקנות|מוכרים|למכירה|קניית|רכב יד שניה|רכב חדש|מימון|טרייד אין|leasing|purchase|buy|cars? for sale|selling|buying|second hand|new car|financing|trade in/.test(text)) return 'leasing_sale';
  if (/הזמנה|reservation|booking|confirmation|מספר הזמנה|ההזמנה שלי|לוודא הזמנה|verify booking/.test(text)) return 'existing_booking';
  return 'unknown';
}

function serviceReply(intent: ServiceIntent, locale: FlowLocale, booking: BookingSummary | null): WhatsAppFlowResult | null {
  if (intent === 'policy') return {
    handled: true,
    reply: locale === 'en'
      ? pickRandom([
          'I understand you are asking about rental terms. Insurance options, the security deposit, fuel, mileage, child seats and additional drivers depend on the rental details and agreement. A SmartCar representative will confirm the applicable terms before pickup — what would you like checked?',
          'Got it, you have a question about our rental terms. Things like insurance, deposits, and mileage limits can vary based on your specific rental. Let me know what exactly you need checked and a human agent will gladly assist!',
          'Happy to help with policy questions! Since things like deposits and insurance depend on the exact vehicle and dates, a representative will need to verify them for you. What specifically can I look up?'
        ])
      : pickRandom([
          'הבנתי שמדובר בתנאי ההשכרה. ביטוח, פיקדון, דלק, קילומטראז׳, כיסאות ילדים ונהג נוסף תלויים בפרטי ההשכרה ובהסכם. נציג SmartCar יאשר את התנאים הרלוונטיים לפני האיסוף — מה חשוב לכם לבדוק?',
          'אין בעיה, שאלות על תנאים ומדיניות זה חשוב. מכיוון שדברים כמו גובה הפיקדון והביטוח משתנים לפי רכב, העברתי את זה לנציג שיבדוק בדיוק למקרה שלכם. על מה תרצו להתמקד?',
          'בשמחה! לגבי מדיניות ותנאי השכרה: הפיקדון, הביטוח ושאר התוספות מותאמים תמיד להזמנה הספציפית שלכם. כתבו לי כאן מה תרצו לברר ונציג יחזור אליכם עם תשובה מדויקת.'
        ])
  };
  if (intent === 'delivery_return') return {
    handled: true,
    reply: locale === 'en'
      ? pickRandom([
          'We can check collection, return, airport service, or delivery at an address. Please send the pickup and return locations with the dates; a representative will confirm whether the route and any service are available.',
          'Looking for branch info or delivery? Just send me the exact locations and dates you have in mind, and our team will verify availability for you.',
          'We offer several pickup and drop-off options, including the airport! Send me your desired locations and dates so a representative can confirm the details.'
        ])
      : pickRandom([
          'אפשר לבדוק איסוף, החזרה, שירות בשדה התעופה או מסירה בכתובת. שלחו את מיקום האיסוף וההחזרה יחד עם התאריכים; נציג יאשר אם המסלול והשירות זמינים.',
          'מעולה, שירותי איסוף והחזרה זה המומחיות שלנו. תכתבו לי בבקשה מאיפה תרצו לאסוף ולאן להחזיר (כולל תאריכים), ונציג יוודא שזה אפשרי.',
          'מחפשים מידע על סניפים או מסירת רכב? בשמחה. רק תרשמו כאן את הערים או הכתובות המבוקשות פלוס תאריכים, ואנחנו נבדוק את זה מיד מול הצוות.'
        ])
  };
  if (intent === 'leasing_sale') return {
    handled: true,
    reply: locale === 'en'
      ? pickRandom([
          'Happy to help with leasing or a vehicle purchase. Is this private leasing, business leasing, or a car for sale? A representative will tailor the options and price to your needs.',
          'Great! We have excellent options for leasing and car sales. Are you looking for private leasing, business, or to buy a car outright? Let me know so the right agent can assist.',
          'I can definitely help with that. To get you the best agent, are you interested in a private lease, a business lease, or purchasing a vehicle?'
        ])
      : pickRandom([
          'בשמחה נעזור בליסינג או ברכישת רכב. מדובר בליסינג פרטי, ליסינג עסקי או רכב למכירה? נציג יתאים את האפשרויות והמחיר לצורך שלכם.',
          'מעולה! יש לנו מחלקת ליסינג ומכירות מצוינת. כדי שאוכל להפנות אותך לנציג הנכון, האם מדובר בליסינג פרטי, עסקי או קניית רכב?',
          'הגעתם למקום הנכון. מחלקת הליסינג והמכירות שלנו תשמח לעזור. רק תגידו לי - זה עבור ליסינג פרטי, ליסינג לעסק או רכישה?'
        ])
  };
  if (intent === 'existing_booking' && !booking) return {
    handled: true,
    reply: locale === 'en'
      ? pickRandom([
          'I could not verify an active booking from this number. Please send the booking reference if you have it; the SmartCar team will check it without asking you to start over.',
          'Hmm, I don\'t see an active reservation linked to this phone number. If you have a booking number, just type it here and an agent will pull it up!',
          'It looks like there is no active booking under this phone number. Could you share your reservation number or full name? A representative will find it for you.'
        ])
      : pickRandom([
          'לא הצלחתי לאמת הזמנה פעילה לפי המספר הזה. אם יש לכם מספר הזמנה, שלחו אותו כאן; צוות SmartCar יבדוק בלי שתצטרכו להתחיל מחדש.',
          'הממ, המערכת לא מזהה הזמנה פעילה על המספר טלפון הזה. יש לכם אולי את מספר ההזמנה או ח.פ? כתבו אותו כאן ונציג מיד יאתר את ההזמנה.',
          'אני לא רואה כרגע השכרה פעילה שמקושרת למספר הזה. אשמח אם תרשמו כאן את מספר ההזמנה שלכם או השם המלא כדי שנציג אנושי יוכל לעזור.'
        ]),
    escalate: true,
    escalateReason: 'בירור הזמנה שלא זוהתה',
  };
  return null;
}

function existingCustomerMenu(booking: BookingSummary, locale: FlowLocale) {
  const firstName = booking.customer_name.trim().split(/\s+/)[0] || 'שלום';
  if (locale === 'en') return `Hi ${firstName}, welcome back to SmartCar 👋

We found an active booking linked to this number.

How can we help?
1️⃣ Booking details
2️⃣ Change or extend the rental
3️⃣ Make a new booking
4️⃣ Branches, delivery and return
5️⃣ Speak with a representative
6️⃣ Another question
7️⃣ Roadside help — accident, flat tyre or breakdown

Reply with a number, type menu at any time, or write עברית for Hebrew.`;
  return `היי ${firstName}, ברוכים הבאים שוב ל־SmartCar 👋

זיהינו הזמנה פעילה המשויכת למספר הזה.

במה נוכל לעזור?
1️⃣ פרטי ההזמנה
2️⃣ שינוי או הארכת ההשכרה
3️⃣ הזמנה חדשה
4️⃣ סניפים, מסירה והחזרה
5️⃣ לדבר עם נציג
6️⃣ שאלה אחרת
7️⃣ עזרה בדרך — תאונה, פנצ׳ר או תקלה

אפשר לכתוב English בכל שלב כדי לעבור לאנגלית.`;
}

function bookingLookupPrompt(locale: FlowLocale) {
  return locale === 'en'
    ? 'Of course. Please send the booking reference, or the full name on the booking. I will keep this enquiry separate from a new rental.'
    : 'בשמחה. שלחו את מספר ההזמנה, או את השם המלא שמופיע בהזמנה. אשמור את הבירור הזה נפרד מבקשת השכרה חדשה.';
}

/**
 * A booking lookup is allowed to collect a reference or a real full name,
 * but never turn a reply such as "I don't know" into a fake identifier.
 */
function hasBookingLookupDetail(input: string) {
  const value = input.trim().replace(/[^a-zA-Z0-9\u0590-\u05ff -]/g, '').replace(/\s+/g, ' ');
  if (value.length < 3) return false;
  return !/^(?:לא יודע|לא זוכר|אין לי|אין מספר|לא בטוח|לא משנה|idk|dont know|don't know|no idea|no number|not sure)$/i.test(normalized(value));
}

function bookingLookupClarification(locale: FlowLocale) {
  return locale === 'en'
    ? 'No problem. Please send either the booking reference or the full name on the booking. If neither is available, write representative and we will take it from there.'
    : 'אין בעיה. שלחו מספר הזמנה או את השם המלא שמופיע בהזמנה. אם אין אף אחד מהם, כתבו „נציג” ונמשיך משם.';
}

function commercialChoicePrompt(locale: FlowLocale) {
  return locale === 'en'
    ? 'Glad to help. Is this private leasing, business leasing, or a car from the verified sales catalogue?'
    : 'בשמחה. מדובר בליסינג פרטי, ליסינג לעסק, או רכב מהקטלוג המאומת למכירה?';
}

function menuFor(booking: BookingSummary | null, locale: FlowLocale) {
  if (booking) return existingCustomerMenu(booking, locale);
  return locale === 'en' ? NEW_CUSTOMER_MENU_EN : NEW_CUSTOMER_MENU;
}

function pickRandom(arr: string[]) {
  // The bot is a deterministic service flow: different wording for the same
  // input makes support review and regression testing unreliable. Keep one
  // reviewed response per branch instead of rotating through variants.
  return arr[0] ?? '';
}

function datesPrompt(locale: FlowLocale, pickupDate?: string) {
  if (pickupDate) {
    return locale === 'en'
      ? pickRandom([
          `Perfect, I’ve got ${formatDate(pickupDate)} for pickup. When would you like to return the car?`,
          `Got it, pickup is set for ${formatDate(pickupDate)}. When can we expect you to return it?`,
          `Great, ${formatDate(pickupDate)} it is. And what date works best for the return?`
        ])
      : pickRandom([
        `מעולה, רשמתי איסוף ב־${formatDate(pickupDate)}. מתי נוח לך להחזיר את הרכב?`,
          `מצוין, התאריך שמור (${formatDate(pickupDate)}). עד מתי תצטרכו את הרכב?`,
          `קיבלתי. האיסוף ב־${formatDate(pickupDate)} — באיזה תאריך תרצו להחזיר?`
        ]);
  }
  return locale === 'en'
    ? pickRandom([
        'I’d be happy to assist with your rental 🚗\n\nWhen would you like to pick it up?',
        'I’d be happy to assist with your rental 🚗\n\nWhat date were you thinking of for pickup?',
        'Let’s get you on the road 🚗\n\nWhat’s your preferred pickup date?'
      ])
    : pickRandom([
        'בשמחה, אעזור לכם למצוא את הרכב המתאים 🚗\n\nמתי נוח לך לאסוף את הרכב?',
        'איזה כיף! בואו נתחיל 🚗\n\nמתי תרצו לקחת את הרכב?',
        'הגעתם למקום הנכון 🚗\n\nמתי נוח לכם להתחיל את ההשכרה?'
      ]);
}

function locationsPrompt(locale: FlowLocale, pickupLocation?: string, dropoffLocation?: string) {
  if (pickupLocation && !dropoffLocation) {
    return locale === 'en'
      ? pickRandom([
          `Got it, pickup from ${pickupLocation}. Where would you like to return it?`,
          `Pickup is set for ${pickupLocation}. And where will you be dropping it off?`
        ])
      : pickRandom([
          `מעולה, רשמתי איסוף מ-${pickupLocation}. לאן תרצו להחזיר את הרכב?`,
          `הבנתי, האיסוף מ-${pickupLocation}. היכן תרצו לבצע את ההחזרה?`
        ]);
  }
  if (!pickupLocation && dropoffLocation) {
    return locale === 'en'
      ? `Got it, return to ${dropoffLocation}. And where would you like to pick it up?`
      : `מעולה, רשמתי החזרה ב-${dropoffLocation}. ומאיפה תרצו לאסוף את הרכב?`;
  }
  return locale === 'en'
    ? pickRandom([
        'Great. Where is most convenient for you to collect the car, and where would you like to return it?\n\nA SmartCar branch or an address in Israel both work.',
        'Perfect. Where should we plan the pickup and return?\n\nYou can choose any of our branches or a specific address.',
        'Got it. From which location would you like to pick up, and where to return?\n\nBranch or delivery address — whatever suits you best.'
      ])
    : pickRandom([
        'מעולה. מאיפה הכי נוח לך לאסוף את הרכב ולאן תרצה להחזיר אותו?\n\nאפשר מסניף או מכתובת בארץ — מה שנוח לך.',
        'מצוין. איפה תרצו לאסוף ולהחזיר את הרכב?\n\nאפשר לבחור סניף שלנו או כתובת מדויקת למסירה.',
        'הבנתי. מהיכן תרצו לאסוף את הרכב ולאן להחזיר?\n\nכל סניף או כתובת בישראל יעבדו כאן.'
      ]);
}

function timesPrompt(locale: FlowLocale, pickupTime?: string, returnTime?: string) {
  if (pickupTime && !returnTime) {
    return locale === 'en'
      ? pickRandom([
          `Got it, pickup at ${pickupTime}. What time would you like to return it?`,
          `Pickup is set for ${pickupTime}. And what about the return time?`
        ])
      : pickRandom([
          `מעולה, רשמתי איסוף ב-${pickupTime}. באיזו שעה תרצו להחזיר את הרכב?`,
          `הבנתי, איסוף ב-${pickupTime}. מתי בערך תתבצע ההחזרה?`
        ]);
  }
  if (!pickupTime && returnTime) {
    return locale === 'en'
      ? `Got it, return at ${returnTime}. And what time would you like to pick it up?`
      : `מעולה, רשמתי החזרה ב-${returnTime}. ובאיזו שעה תרצו לאסוף את הרכב?`;
  }
  return locale === 'en'
    ? pickRandom([
        'What pickup and return times work best for you?',
        'Around what time were you planning to pick up and return?',
        'What hours suit your schedule for the pickup and drop-off?'
      ])
    : pickRandom([
        'באילו שעות הכי נוח לך לאסוף ולהחזיר את הרכב?',
        'באיזו שעה בערך תרצו לבצע את האיסוף ואת ההחזרה?',
        'אילו שעות עובדות לכם הכי טוב לאיסוף ולהחזרה?'
      ]);
}

function vehiclePrompt(locale: FlowLocale) {
  const optionsEn = '\n\n1️⃣ Small and economical\n2️⃣ Family car\n3️⃣ Crossover / SUV\n4️⃣ 7 seats or more\n5️⃣ Luxury car\n6️⃣ Not sure — I’ll help you choose';
  const optionsHe = '\n\n1️⃣ קטן וחסכוני\n2️⃣ משפחתי\n3️⃣ ג׳יפון / SUV\n4️⃣ רכב ל־7 נוסעים ומעלה\n5️⃣ רכב יוקרה\n6️⃣ לא בטוחים? נשמח לעזור להתאים';
  return locale === 'en'
    ? pickRandom([
        `Nice — what kind of car would feel right for this trip? You can also tell me passengers, luggage, or child-seat needs.${optionsEn}`,
        `Awesome. What size vehicle are you looking for? Feel free to mention how many passengers or bags.${optionsEn}`,
        `Great. What type of car suits your needs best? Let me know if you need child seats or extra space.${optionsEn}`
      ])
    : pickRandom([
        `מעולה. איזה רכב יעשה לך את הנסיעה הכי נוחה? אפשר גם לציין כמה נוסעים, מזוודות או כיסאות ילדים יש.${optionsHe}`,
        `נהדר. איזה סוג רכב אתם מחפשים? תרגישו חופשי לפרט על כמות נוסעים, ציוד או צרכים מיוחדים.${optionsHe}`,
        `מצוין. איזה רכב יתאים לכם בדיוק? כדאי גם לציין מזוודות, מספר אנשים או בקשות לכיסא תינוק.${optionsHe}`
      ]);
}

function namePrompt(locale: FlowLocale) {
  return locale === 'en'
    ? pickRandom([
        'Great choice. Who should I put the rental request under?',
        'Excellent. Could you please share your full name for the reservation?',
        'Perfect. Who will be the main driver on this booking?'
      ])
    : pickRandom([
        'בחירה מעולה. על שם מי לרשום את בקשת ההשכרה?',
        'מצוין. איך קוראים לכם כדי שנוכל לרשום את הבקשה?',
        'נהדר. מה השם המלא לרישום ההזמנה (ומי שינהג ברכב)?'
      ]);
}

function emailPrompt(locale: FlowLocale) {
  return locale === 'en'
    ? pickRandom([
        'What email address should we use for the request and the representative’s reply?',
        'Could you provide an email address so we can send you the confirmation details?',
        'Lastly, what’s the best email to reach you at with the booking summary?'
      ])
    : pickRandom([
        'לאיזו כתובת מייל נשלח את פרטי הבקשה ואת הצעת המחיר מהנציג?',
        'נודה לכתובת אימייל כדי שנוכל להעביר את כל הפרטים המסודרים.',
        'מה כתובת המייל שלכם לשליחת האישור והמשך הטיפול?'
      ]);
}

function confirmationPrompt(state: FlowState, locale: FlowLocale) {
  const category: Record<string, { he: string; en: string }> = {
    ECONOMY_COMPACT: { he: 'קטן וחסכוני', en: 'Small and economical' },
    SEDAN: { he: 'משפחתי', en: 'Family car' },
    SUV: { he: 'ג׳יפון / SUV', en: 'Crossover / SUV' },
    VAN: { he: '7 מושבים ומעלה', en: '7 seats or more' },
    LUXURY: { he: 'רכב יוקרה', en: 'Luxury car' },
    ALL: { he: 'נדרשת התאמה של נציג', en: 'Representative recommendation requested' },
  };
  const vehicle = category[state.vehiclePreference ?? 'ALL']?.[locale] ?? state.vehiclePreference ?? '-';
  const needs = [state.passengers && (locale === 'en' ? `${state.passengers} passengers` : `${state.passengers} נוסעים`), state.luggage && (locale === 'en' ? `${state.luggage} bags` : `${state.luggage} מזוודות`), state.childSeats && (locale === 'en' ? `${state.childSeats} child seats` : `${state.childSeats} כיסאות ילדים`), state.tripNeeds].filter(Boolean).join(', ');
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://smartcar.co.il';
  const consent = termsConsent(locale);
  if (locale === 'en') return `${rentalConfirmationIntro(state, locale)}\n\nDates: ${formatDate(state.pickupDate!)} to ${formatDate(state.dropoffDate!)}\nTimes: ${state.pickupTime} to ${state.returnTime}\nPickup: ${state.pickupLocation}\nReturn: ${state.dropoffLocation}\nVehicle: ${vehicle}${needs ? `\nTrip needs: ${needs}` : ''}\nName: ${state.customerName}\nEmail: ${state.customerEmail}\n\nThis is a rental request, not a confirmation of availability, price, or a specific vehicle. A SmartCar representative will review the full fleet and provide final written confirmation.\n\n${consent.text}\n${base}/en/terms\n${base}/en/privacy\n\nReply I confirm to submit, or menu to start again.`;
  return `${rentalConfirmationIntro(state, locale)}\n\nתאריכים: ${formatDate(state.pickupDate!)} עד ${formatDate(state.dropoffDate!)}\nשעות: ${state.pickupTime} עד ${state.returnTime}\nאיסוף: ${state.pickupLocation}\nהחזרה: ${state.dropoffLocation}\nרכב: ${vehicle}${needs ? `\nצרכים: ${needs}` : ''}\nשם: ${state.customerName}\nמייל: ${state.customerEmail}\n\nזוהי בקשת השכרה ולא אישור זמינות, מחיר או רכב מסוים. נציג SmartCar יבדוק את הצי המלא וישלח אישור סופי בכתב.\n\n${consent.text}\n${base}/he/terms\n${base}/he/privacy\n\nכתבו אני מאשר/ת לשליחה, או תפריט להתחלה מחדש.`;
}

function promptForState(state: FlowState, locale: FlowLocale, booking: BookingSummary | null) {
  if (state.step === 'rental_dates') return rentalServicePrompt(state, locale, datesPrompt(locale, state.pickupDate));
  if (state.step === 'rental_times') return rentalServicePrompt(state, locale, timesPrompt(locale, state.pickupTime, state.returnTime));
  if (state.step === 'rental_locations') return rentalServicePrompt(state, locale, locationsPrompt(locale, state.pickupLocation, state.dropoffLocation));
  if (state.step === 'rental_vehicle') return rentalServicePrompt(state, locale, vehiclePrompt(locale));
  if (state.step === 'rental_name') return rentalServicePrompt(state, locale, namePrompt(locale));
  if (state.step === 'rental_email') return rentalServicePrompt(state, locale, emailPrompt(locale));
  if (state.step === 'rental_confirm') return confirmationPrompt({ ...state, locale }, locale);
  return menuFor(booking, locale);
}

const MONTHS: Record<string, number> = {
  ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

const WRITTEN_DAYS: Record<string, number> = {
  ראשון: 1, ראשונה: 1, שני: 2, שנייה: 2, שלישי: 3, שלישית: 3, רביעי: 4, חמישי: 5, חמישית: 5,
  שישה: 6, שישי: 6, שביעי: 7, שמיני: 8, תשיעי: 9, עשירי: 10, עשר: 10, עשרה: 10, אחתעשרה: 11, 'אחת עשרה': 11, אחדעשר: 11, 'אחד עשר': 11, שניםעשר: 12, 'שנים עשר': 12,
  שלושהעשר: 13, 'שלושה עשר': 13, שלושהעשרה: 13, ארבעהעשר: 14, 'ארבעה עשר': 14, חמישהעשר: 15, 'חמישה עשר': 15, שישהעשר: 16, 'שישה עשר': 16, 'שש עשרה': 16, שבעהעשר: 17, 'שבעה עשר': 17, שמונהעשר: 18, 'שמונה עשר': 18, תשעהעשר: 19, 'תשעה עשר': 19, עשרים: 20,
  עשריםואחד: 21, 'עשרים ואחד': 21, עשריםושניים: 22, 'עשרים ושניים': 22, עשריםושלושה: 23, 'עשרים ושלושה': 23, עשריםוארבעה: 24, 'עשרים וארבעה': 24, עשריםוחמישה: 25, 'עשרים וחמישה': 25, עשריםושישה: 26, 'עשרים ושישה': 26, עשריםושבעה: 27, 'עשרים ושבעה': 27, עשריםושמונה: 28, 'עשרים ושמונה': 28, עשריםותשעה: 29, 'עשרים ותשעה': 29, שלושים: 30, שלושיםואחד: 31, 'שלושים ואחד': 31,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
};

function todayInIsrael() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

function dateFromParts(day: number, month: number, suppliedYear?: string) {
  const today = todayInIsrael();
  let year = suppliedYear ? Number(suppliedYear.length === 2 ? `20${suppliedYear}` : suppliedYear) : Number(today.slice(0, 4));
  const asIso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  let value = asIso(year);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  if (!suppliedYear && value < today) value = asIso(++year);
  return value;
}

function dayValue(value: string) {
  return /^\d{1,2}$/.test(value) ? Number(value) : WRITTEN_DAYS[value.toLowerCase().replace(/[׳']/g, '')] ?? null;
}

/** Extracts numeric and written Hebrew/English dates, with an optional year. */
function parseDateCandidates(input: string) {
  const results: string[] = [];
  const add = (dayText: string, month: number, year?: string) => {
    const day = dayValue(dayText);
    const value = day ? dateFromParts(day, month, year) : null;
    if (value && !results.includes(value)) results.push(value);
  };
  const relativeDate = (days: number) => {
    const date = new Date(`${todayInIsrael()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    const value = date.toISOString().slice(0, 10);
    if (!results.includes(value)) results.push(value);
  };
  if (/מחרתיים|day after tomorrow/.test(normalized(input))) relativeDate(2);
  else if (/מחר|tomorrow/.test(normalized(input))) relativeDate(1);
  for (const match of input.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/g)) add(match[1], Number(match[2]), match[3]);

  const monthNames = Object.keys(MONTHS).join('|');
  const dayNames = `\\d{1,2}|${Object.keys(WRITTEN_DAYS).join('|')}`;
  const hebrewOrEnglishDayFirst = new RegExp(`(?:^|\\s)(${dayNames})\\s+(?:ב|ל|of\\s+)?(${monthNames})(?:\\s+(\\d{2,4}))?`, 'gi');
  for (const match of input.matchAll(hebrewOrEnglishDayFirst)) add(match[1], MONTHS[match[2].toLowerCase()], match[3]);
  const englishMonthFirst = new RegExp(`\\b(${monthNames})\\s+(${dayNames})(?:st|nd|rd|th)?(?:,?\\s+(\\d{2,4}))?`, 'gi');
  for (const match of input.matchAll(englishMonthFirst)) add(match[2], MONTHS[match[1].toLowerCase()], match[3]);
  const hebrewMonthFirst = new RegExp(`(?:^|\\s)(${monthNames})\\s+(${dayNames})(?:\\s+(\\d{2,4}))?`, 'gi');
  for (const match of input.matchAll(hebrewMonthFirst)) add(match[2], MONTHS[match[1].toLowerCase()], match[3]);
  return results;
}

function parseTimeValues(input: string): string[] {
  const wordHours: Record<string, number> = { אחת: 1, אחד: 1, שתיים: 2, שניים: 2, שלוש: 3, ארבע: 4, חמש: 5, שש: 6, שבע: 7, שמונה: 8, תשע: 9, עשר: 10, אחתעשרה: 11, שתיםעשרה: 12, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  let text = normalized(input)
    // Do this before accepting numeric hours: otherwise 10/09/2026 is read
    // as 10:00 and 09:00 when a customer supplies the whole request at once.
    .replace(/\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/g, ' ')
    .replace(/(\d{1,2})[.](\d{2})/g, '$1:$2')
    .replace(/\bnoon\b/g, '12:00').replace(/\bmidnight\b/g, '00:00');
  for (const [word, hour] of Object.entries(wordHours)) text = text.replace(new RegExp(`(^|\\s)ב?${word}(?:\\s+וחצי|\\s+and a half|\\s+thirty)?(?=\\s|$)`, 'g'), (full, prefix) => `${prefix}${hour}${/וחצי|and a half|thirty/.test(full) ? ':30' : ''}`);
  text = text.replace(/in the morning/g, 'am').replace(/in the evening|afternoon/g, 'pm').replace(/בצהריים/g, '12:00').replace(/בחצות/g, '00:00');
  const allTokens = [...text.matchAll(/(\d{1,2})(?::([0-5]\d))?\s*(בבוקר|אחה[״"']?צ|בערב|בלילה|am|pm)?/gi)];
  // A full request may include party and luggage counts. Once explicit time
  // syntax exists, do not mistake those numbers for hours.
  const explicitTokens = allTokens.filter((token) => Boolean(token[2] || token[3]));
  const tokens = explicitTokens.length ? explicitTokens : allTokens;
  const toTime = (match: RegExpMatchArray) => {
    let hour = Number(match[1]);
    const period = match[3]?.toLowerCase();
    if ((period === 'pm' || /אחה|בערב|בלילה/.test(period ?? '')) && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return { hour, minute: match[2] ?? '00' };
  };
  return tokens
    .map(toTime)
    .filter(({ hour }) => hour >= 0 && hour <= 23)
    .map(({ hour, minute }) => `${String(hour).padStart(2, '0')}:${minute}`);
}

function parseTimes(input: string): { pickupTime: string; returnTime: string } | null {
  const [pickupTime, returnTime] = parseTimeValues(input);
  return pickupTime && returnTime ? { pickupTime, returnTime } : null;
}

function parseSingleTime(input: string): string | null {
  const times = parseTimeValues(input);
  return times.length === 1 ? times[0] : null;
}

function isVagueTimeReply(input: string) {
  const answer = normalized(input).replace(/[.!?]/g, '').trim();
  return /^(?:בבוקר|בערב|בלילה|אחה[״"']?צ|morning|afternoon|evening|at night|גם|same|also|אותה שעה|אותו זמן)$/.test(answer);
}

function timeClarificationPrompt(locale: FlowLocale, state: FlowState) {
  if (locale === 'en') {
    return state.pickupTime
      ? `I have pickup at ${state.pickupTime}. What return time should I note? For example, 18:00.`
      : 'Morning works. What pickup time should I note? For example, 08:00.';
  }
  return state.pickupTime
    ? `רשמתי איסוף ב־${state.pickupTime}. באיזו שעה לרשום את ההחזרה? למשל 18:00.`
    : 'בבוקר זה מצוין. באיזו שעה לרשום את האיסוף? למשל 08:00.';
}

function parseLocations(input: string): { pickupLocation: string; dropoffLocation: string } | null {
  // Avoid treating ordinary conversational “ready to book” as a route merely
  // because it contains the word “to”. A location pair still has explicit
  // pickup/return wording or a location-style delimiter below.
  if (/^(?:i(?: am|'m)? )?(?:ready|want|need|think|hope)\s+to\s+(?:book|buy|rent|compare|change|cancel|modify|extend)/i.test(input.trim())) return null;
  const cleanLocation = (value: string) => value.trim()
    .replace(/\s+(?=\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?\b|\d{1,2}(?::\d{2})?\s*(?:am|pm|בבוקר|בערב|בלילה)\b).*$/i, '')
    .replace(/\s+and$/i, '')
    .trim();
  if (/(?:איסוף|pickup|pick up)\s+(?:ב)?(?:אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|\d{1,2}(?::\d{2})?)\s*(?:בבוקר|בערב|בלילה|am|pm|in the morning|in the evening)?.{0,40}(?:החזרה|return|drop ?off)\s+(?:ב)?(?:אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|\d{1,2}(?::\d{2})?)/i.test(input)) return null;
  // Prefer explicit "from ... return to ..." wording. Requiring Hebrew מ־
  // here avoids treating "איסוף בתשע בבוקר" as a pair of locations.
  const explicit = input.match(/(?:איסוף|אאסוף|אקח|pickup|pick up|collect)\s+(?:מ[- ]?|from\s+)(.+?)\s+(?:והחזרה|ואחזיר|להחזיר|and return|return|drop ?off|bring back)\s+(?:ל[- ]?|to\s+|at\s+)(.+?)(?=[.!\n]|$)/i);
  if (explicit?.[1] && explicit[2] && explicit[1].trim().length <= 200 && explicit[2].trim().length <= 200) {
    return { pickupLocation: cleanLocation(explicit[1]), dropoffLocation: cleanLocation(explicit[2]) };
  }
  if (/^\s*\d{1,2}(?::\d{2})?\s*\|\s*\d{1,2}(?::\d{2})?\s*$/i.test(input)) return null;
  const parts = input.split(/\s*(?:\||עד|->|→|\bto\b)\s*/i).map((part) => part.replace(/^(?:איסוף|החזרה|pickup|pick up|drop ?off|return|collect)\s*(?:מ|ב|ל|from|in|at|to)?\s*/i, '').trim());
  const isTime = (value: string) => /^\d{1,2}(?::\d{2})?\s*(?:am|pm|בבוקר|בערב|בלילה)?$/i.test(value);
  const isDate = (value: string) => /^\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?$/.test(value);
  const containsDateOrTime = (value: string) => /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|בבוקר|בערב|בלילה|בצהריים|בחצות/i.test(value);
  if (parts.length === 2 && parts[0] && parts[1] && parts.every((part) => part.length <= 200) && !parts.some(containsDateOrTime) && !parts.every(isTime) && !parts.every(isDate)) return { pickupLocation: parts[0], dropoffLocation: parts[1] };

  const natural = input.match(/(?:איסוף|אקח|לקחת|אאסוף|pickup|pick up|collect|delivery)\s+(?:מ|ב|in|from|at)?\s*(.+?)\s+(?:והחזרה|החזרה|ואחזיר|להחזיר|and return|return|drop ?off|bring back)\s+(?:ל|ב|at|to|in)?\s*(.+)$/i);
  const looksLikeTimePhrase = (value: string) => /\d{1,2}(?::\d{2})?|\b(?:am|pm|morning|evening|afternoon|noon|midnight)\b|בבוקר|בערב|בלילה|בצהריים|בחצות|תשע|שש|שמונה|עשר/.test(value);
  if (natural?.[1] && natural[2] && natural[1].trim().length <= 200 && natural[2].trim().length <= 200 && !looksLikeTimePhrase(natural[1]) && !looksLikeTimePhrase(natural[2])) {
    return { pickupLocation: cleanLocation(natural[1]), dropoffLocation: cleanLocation(natural[2]) };
  }
  const implicit = input.match(/(?:^|\s)ב(?:סניף\s+)?(.+?)\s+(?:ומחזיר|ואחזיר|להחזיר|והחזרה|and return|return|drop ?off)\s+(?:ב|ל|at|to|in)\s*(.+)$/i);
  if (implicit?.[1] && implicit[2] && implicit[1].trim().length <= 200 && implicit[2].trim().length <= 200 && !looksLikeTimePhrase(implicit[1]) && !looksLikeTimePhrase(implicit[2])) {
    return { pickupLocation: implicit[1].trim(), dropoffLocation: implicit[2].trim() };
  }
  return null;
}

const VEHICLE_PREFERENCES: Record<string, string> = {
  '1': 'ECONOMY_COMPACT', '2': 'SEDAN', '3': 'SUV', '4': 'VAN', '5': 'LUXURY', '6': 'ALL',
};

function parseVehiclePreference(input: string) {
  const text = normalized(input);
  if (text in VEHICLE_PREFERENCES) return VEHICLE_PREFERENCES[text];
  if (/קטן|מיני|חסכוני|אוטומט קטן|זול|פשוט|פיקנטו|I10|i10|סופר מיני|רכב קומפקטי|ספארק|ספייס סטאר|שברולט ספארק|מיצובישי ספייס|economy|compact|small car|city car|cheap|tiny|picanto|spark|space star/.test(text)) return 'ECONOMY_COMPACT';
  if (/משפח|ילדים|סטנדרטי|רגיל|מזדה 3|קורולה|סדאן|ארוך|אלנטרה|איוניק|sedan|family car|family vehicle|standard|regular|corolla|elantra|ioniq|mazda 3/.test(text)) return 'SEDAN';
  if (/ג[׳']?יפ|suv|crossover|4x4|4 על 4|jeep|גבוה|שטח|טוסון|ספורטאז|טיגואן|סלטוס|נירו|סורנטו|טיגו|אקליפס|קרניבל|טרברס|high seat|tucson|sportage|seltos|niro|sorento|tiggo|eclipse/.test(text)) return 'SUV';
  if (/7 מקומות|8 מקומות|9 מקומות|שבעה מושבים|ואן|מסחרי|מיניואן|קרניבל|טרברס|minivan|van|7.?seater|8.?seater|9.?seater|seven.?seater|people carrier|big car|carnival|traverse/.test(text)) return 'VAN';
  if (/יוקרה|מפואר|מרצדס|במו|אאודי|ספורט|קבריולט|לוקסוס|טסלה|חשמלי|חשמלית|vip|luxury|premium|executive|mercedes|bmw|audi|sport|convertible|tesla|electric|byd|geely/.test(text)) return 'LUXURY';
  if (/לא יודע|לא בטוח|תמליצ|מה מתאים|מה כדאי|מה מומלץ|אין לי מושג|תציעו לי|not sure|help me choose|recommend|dont know|what do you suggest/.test(text)) return 'ALL';
  return undefined;
}

function parseTripNeeds(input: string): Pick<FlowState, 'passengers' | 'luggage' | 'childSeats' | 'tripNeeds'> {
  const text = normalized(input);
  const countFor = (pattern: RegExp) => {
    const match = text.match(pattern);
    return match ? Number(match[1]) : undefined;
  };
  const passengers = countFor(/\b(\d{1,2})\s*(?:נוסע(?:ים|ות)?|אנשים|חבר[הי]ם|מבוגרים|people|passengers?|adults?|persons?|guys?)\b/i);
  const luggage = countFor(/\b(\d{1,2})\s*(?:מזווד(?:ה|ות)|תיק(?:ים)?|טרולי|מטען|bags?|suitcases?|luggage|baggage|backpacks?)\b/i);
  const childSeats = countFor(/\b(\d{1,2})\s*(?:כיסאות? (?:ילדים|בטיחות|תינוק)|בוסטר(?:ים)?|סלקל|child ?seats?|baby ?seats?|boosters?)\b/i);
  const children = /ילדים|תינוק|פעוט|kids?|children|baby|toddler/.test(text);
  const family = /משפחה|family/.test(text);
  const youngDriver = /נהג חדש|נהג צעיר|חייל|מתחת לגיל 24|בן 18|בן 19|בן 20|בן 21|בן 22|בן 23|young driver|new driver|under 24|soldier/.test(text);
  const offRoad = /שטח|יער|מדבר|קמפינג|טיול שטח|off road|camping|desert/.test(text);
  const longTerm = /חודש|חודשיים|תקופה ארוכה|רילוקיישן|monthly|long term|relocation/.test(text);
  const debitOrCash = /דביט|מזומן|דיירקט|בלי אשראי|debit|cash|direct|no credit card/.test(text);
  const crossBorder = /סיני|טאבה|ירדן|שטחים|פלסטינ|רמאללה|חברון|sinai|taba|jordan|palestin/.test(text);
  const pets = /כלב|חתול|בעלי חיים|pets?|dogs?|cats?/.test(text);
  
  const needsArray = [];
  if (children) needsArray.push(family ? 'family / children' : 'children');
  else if (family) needsArray.push('family');
  if (youngDriver) needsArray.push('young driver');
  if (offRoad) needsArray.push('off road trip');
  if (longTerm) needsArray.push('long term rental');
  if (debitOrCash) needsArray.push('no credit card');
  if (crossBorder) needsArray.push('cross border');
  if (pets) needsArray.push('pets');

  return {
    ...(passengers && passengers <= 20 ? { passengers } : {}),
    ...(luggage && luggage <= 20 ? { luggage } : {}),
    ...(childSeats && childSeats <= 10 ? { childSeats } : {}),
    ...(needsArray.length ? { tripNeeds: needsArray.join(', ') } : {}),
  };
}

function explicitName(input: string) {
  const match = input.match(/(?:קוראים לי|שמי|השם שלי הוא|my name is|name\s*(?:is|:))\s+(.+?)(?=\s+(?:ו?המייל|email|e-mail)|[,.!\n]|$)/i);
  return match ? validName(match[1]) : null;
}

function rentalStepFor(state: FlowState): FlowStep {
  if (!state.pickupDate || !state.dropoffDate) return 'rental_dates';
  if (!state.pickupTime || !state.returnTime) return 'rental_times';
  if (!state.pickupLocation || !state.dropoffLocation) return 'rental_locations';
  if (!state.vehiclePreference) return 'rental_vehicle';
  if (!state.customerName) return 'rental_name';
  if (!state.customerEmail) return 'rental_email';
  return 'rental_confirm';
}

function isRentalStep(step: FlowStep) {
  return step.startsWith('rental_');
}

function safeLearningPhrase(input: string) {
  const phrase = normalized(input).replace(/https?:\/\/\S+|\S+@\S+|\b\d{5,}\b/g, '').replace(/[^a-z\u0590-\u05ff\s-]/gi, ' ').replace(/\s+/g, ' ').trim();
  // Keep candidate collection out of free addresses/names and out of long
  // prose. Learning is for a small controlled vocabulary, never customer PII.
  return phrase.length >= 2 && phrase.length <= 40 && phrase.split(' ').length <= 5 ? phrase : null;
}

function learnableField(step: FlowStep): 'vehicle' | 'time' | 'location' | null {
  // Only vehicle vocabulary is eligible for automatic reuse. Time/location
  // often contain addresses or personal schedules and remain review-only.
  if (step === 'rental_vehicle') return 'vehicle';
  return null;
}

/**
 * Extract only facts that have an unambiguous shape. It is intentionally
 * conservative: an unclear sentence remains in the current step and can be
 * handed to a person, rather than silently becoming wrong booking data.
 */
function extractRentalDetails(body: string, current: FlowState): Partial<FlowState> {
  const extracted: Partial<FlowState> = {};
  const dates = parseDateCandidates(body);
  if (dates.length >= 2) {
    const [pickupDate, dropoffDate] = dates;
    if (pickupDate >= todayInIsrael() && dropoffDate >= pickupDate) Object.assign(extracted, { pickupDate, dropoffDate });
  } else if (dates.length === 1) {
    const [date] = dates;
    if (date >= todayInIsrael()) {
      if (!current.pickupDate) extracted.pickupDate = date;
      else if (date >= current.pickupDate) extracted.dropoffDate = date;
    }
  }

  // Parse durations if pickup date is already known
  if (current.pickupDate && !extracted.dropoffDate) {
    let days = 0;
    if (/חודש|month/i.test(body)) days = 30;
    else if (/שבועיים|two weeks|fortnight/i.test(body)) days = 14;
    else if (/שבוע|week/i.test(body)) days = 7;
    else if (/יומיים|two days/i.test(body)) days = 2;
    else {
      const dayMatch = body.match(/(\d+)\s*(?:ימים|days)/i);
      if (dayMatch) days = parseInt(dayMatch[1], 10);
    }
    
    if (days > 0) {
      const date = new Date(`${current.pickupDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      extracted.dropoffDate = date.toISOString().slice(0, 10);
    }
  }

  // Dates contain numbers too. Only attempt a time range when the message
  // actually contains time syntax or a time-of-day word.
  const hasTimeSyntax = /:|\d\s*(?:am|pm)\b|\b(?:morning|evening|afternoon|noon|midnight)\b|בבוקר|בערב|בלילה|בצהריים|בחצות|שעה|hours?/i.test(body)
    || (current.step === 'rental_times' && /^\s*\d{1,2}\s*$/.test(body));
  if (hasTimeSyntax) {
    const times = parseTimes(body);
    if (times && (!current.pickupDate || current.pickupDate !== current.dropoffDate || times.returnTime > times.pickupTime)) Object.assign(extracted, times);
    else {
      const time = parseSingleTime(body);
      if (time) {
        if (!current.pickupTime) extracted.pickupTime = time;
        else if (!current.returnTime) extracted.returnTime = time;
      }
    }
  }

  const locations = parseLocations(body);
  if (locations) Object.assign(extracted, locations);
  const vehiclePreference = parseVehiclePreference(body);
  if (vehiclePreference) extracted.vehiclePreference = vehiclePreference;
  Object.assign(extracted, parseTripNeeds(body));
  const emailMatch = body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? validEmail(emailMatch[0]) : validEmail(body);
  if (email) extracted.customerEmail = email;
  const name = explicitName(body);
  if (name) extracted.customerName = name;
  return extracted;
}

async function activeBooking(phone: string): Promise<BookingSummary | null> {
  const canonicalPhone = normalizeWhatsAppPhone(phone);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, status, pickup_date, dropoff_date, pickup_location, dropoff_location, customer_name, vehicle:vehicles(make, model), customer_phone')
    .eq('customer_phone_normalized', canonicalPhone ?? '')
    .in('status', ['PENDING', 'CONFIRMED', 'ACTIVE'])
    .order('pickup_date', { ascending: true })
    .limit(20);
  if (error) throw new Error(`[whatsapp-flow] booking lookup failed: ${error.message}`);
  const bookings = ((data ?? []) as unknown as (BookingSummary & { customer_phone: string })[]).filter(
    (booking) => normalizeWhatsAppPhone(booking.customer_phone) === canonicalPhone
  );
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const currentOrUpcoming = bookings.filter((booking) => booking.dropoff_date >= today);
  currentOrUpcoming.sort((a, b) => {
    const aRank = a.status === 'ACTIVE' ? 0 : 1;
    const bRank = b.status === 'ACTIVE' ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.pickup_date.localeCompare(b.pickup_date);
  });
  return currentOrUpcoming[0] ?? null;
}

async function loadState(phone: string): Promise<FlowState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('whatsapp_conversation_states').select('state, updated_at').eq('phone', phone).maybeSingle();
  if (error) throw new Error(`[whatsapp-flow] failed to load state: ${error.message}`);
  if (!data?.state || typeof data.state !== 'object') return null;
  if (Date.now() - new Date(data.updated_at).getTime() > 30 * 60 * 1000) {
    const { error: deleteError } = await supabase.from('whatsapp_conversation_states').delete().eq('phone', phone);
    if (deleteError) console.error('[whatsapp-flow][ALERT] failed to remove expired state:', deleteError.message);
    return null;
  }
  const state = data.state as FlowState;
  return ['menu', 'rental_dates', 'rental_times', 'rental_locations', 'rental_vehicle', 'rental_name', 'rental_email', 'rental_confirm'].includes(state.step) ? state : null;
}

async function saveState(phone: string, state: FlowState | null) {
  const supabase = createAdminClient();
  if (!state) {
    const { error } = await supabase.from('whatsapp_conversation_states').delete().eq('phone', phone);
    if (error) throw new Error(`[whatsapp-flow] failed to clear state: ${error.message}`);
    return;
  }
  const { error } = await supabase.from('whatsapp_conversation_states').upsert({ phone, state, updated_at: new Date().toISOString() });
  if (error) throw new Error(`[whatsapp-flow] failed to save state: ${error.message}`);
}

function validName(input: string) {
  const value = input.trim().replace(/\s+/g, ' ');
  return value.length >= 2 && value.length <= 100 && !/https?:\/\//i.test(value) ? value : null;
}

function validEmail(input: string) {
  const value = normalizeEmail(input);
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function confirmsTerms(input: string) {
  const value = normalized(input).replace(/[/.]/g, '').replace(/\s+/g, ' ');
  return ['אני מאשר', 'אני מאשרת', 'מאשר', 'מאשרת', 'אני מסכים', 'אני מסכימה', 'מסכים לתנאים', 'מסכימה לתנאים', 'מאשר את התנאים', 'אישור', 'כן אני מאשר', 'כן אני מאשרת', 'i confirm', 'confirm', 'i agree', 'agree', 'i accept', 'i accept the terms', 'yes i confirm', 'yes please', 'submit', 'go ahead', 'thats correct'].includes(value);
}

async function createRentalRequest(phone: string, state: FlowState, locale: FlowLocale) {
  const consent = termsConsent(locale);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_rental_requests')
    .insert({
      phone: normalizeWhatsAppPhone(phone),
      customer_name: state.customerName,
      customer_email: state.customerEmail,
      pickup_date: state.pickupDate,
      dropoff_date: state.dropoffDate,
      pickup_time: state.pickupTime,
      return_time: state.returnTime,
      pickup_location: state.pickupLocation,
      dropoff_location: state.dropoffLocation,
      vehicle_preference: state.vehiclePreference,
      trip_needs: [
        state.passengers && `${state.passengers} passengers`,
        state.luggage && `${state.luggage} luggage`,
        state.childSeats && `${state.childSeats} child seats`,
        state.tripNeeds,
      ].filter(Boolean).join(', ') || null,
      locale,
      status: 'PENDING',
      terms_version: consent.version,
      terms_text_hash: consent.hash,
      terms_accepted_at: new Date().toISOString(),
      consent_source: 'whatsapp',
    })
    .select('id')
    .single();
  if (error || !data?.id) {
    console.error('[whatsapp-flow][ALERT] rental request creation failed:', error?.message ?? 'missing id');
    return null;
  }
  return String(data.id);
}

async function recordLanguageCandidate(candidate: { phrase: string; field: 'vehicle' | 'time' | 'location'; proposedValue?: string }) {
  const supabase = createAdminClient();
  const { data } = await supabase.from('whatsapp_language_candidates')
    .select('id, occurrences')
    .eq('normalized_phrase', candidate.phrase).eq('field', candidate.field)
    .eq('proposed_value', candidate.proposedValue ?? '').maybeSingle();
  if (data?.id) {
    await supabase.from('whatsapp_language_candidates').update({ occurrences: Math.min(Number(data.occurrences ?? 1) + 1, 20), last_seen_at: new Date().toISOString() }).eq('id', data.id);
    return;
  }
  await supabase.from('whatsapp_language_candidates').insert({ normalized_phrase: candidate.phrase, field: candidate.field, proposed_value: candidate.proposedValue ?? null });
}

async function resolveApprovedVariant(phrase: string, field: 'vehicle') {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('whatsapp_language_candidates')
    .select('proposed_value').eq('normalized_phrase', phrase).eq('field', field).eq('status', 'APPROVED').maybeSingle();
  if (error || !data?.proposed_value || !Object.values(VEHICLE_PREFERENCES).includes(data.proposed_value)) return null;
  return data.proposed_value;
}

const persistentStore: WhatsAppFlowStore = {
  activeBooking, loadState, saveState, createRentalRequest,
  getRentalQuotes: (state) => getWhatsAppRentalQuotes(state.vehiclePreference, state.pickupDate!, state.dropoffDate!),
  getCarsForSale,
  recordLanguageCandidate,
  resolveApprovedVariant,
};

function quotePrompt(quotes: WhatsAppRentalQuote[], locale: FlowLocale) {
  if (!quotes.length) return '';
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://smartcar.co.il';
  const options = quotes.map((quote) => {
    const link = `${base}/${locale}/rental/${quote.id}`;
    return locale === 'en' ? `${quote.title}\n₪${quote.pricePerDay.toLocaleString()}/day · ₪${quote.total.toLocaleString()} for ${quote.days} days\n${link}` : `${quote.title}\n₪${quote.pricePerDay.toLocaleString()} ליום · ₪${quote.total.toLocaleString()} ל־${quote.days} ימים\n${link}`;
  }).join('\n\n');
  return locale === 'en'
    ? pickRandom([
        `Here are catalogue price suggestions for your dates:\n\n${options}\n\nThese are price suggestions, not a reservation or final availability confirmation. A SmartCar representative confirms the final booking.\n\n`,
        `I pulled up some estimated prices for those dates:\n\n${options}\n\nPlease note these are catalogue estimates, not a confirmed reservation. A human representative will check live availability and confirm everything with you!\n\n`,
        `Based on the dates you requested, here is a quick price check:\n\n${options}\n\nJust a reminder: this is an estimate and not a final booking. Our team will verify availability and give you the final go-ahead.\n\n`
      ])
    : pickRandom([
        `הנה הצעות מחיר מהקטלוג לתאריכים שביקשתם:\n\n${options}\n\nאלה הצעות מחיר בלבד, לא הזמנה ולא אישור זמינות סופי. נציג SmartCar מאשר את ההזמנה הסופית.\n\n`,
        `בדקתי את התעריפים לתאריכים האלו, הנה כמה אופציות:\n\n${options}\n\nחשוב לי לציין שאלו הצעות מחיר כלליות ולא הבטחה למלאי. נציג אנושי יעבור על הבקשה ויאשר לכם זמינות סופית!\n\n`,
        `לפי התאריכים ששלחתם, זו הערכת המחירים שלנו:\n\n${options}\n\nשימו לב שזו הערכה מהקטלוג ולא הזמנה סגורה. נציג של סמארט-קאר יוודא שיש רכב פנוי ויסגור איתכם את הפרטים.\n\n`
      ]);
}

async function continueRental(phone: string, body: string, current: FlowState, locale: FlowLocale, booking: BookingSummary | null, store: WhatsAppFlowStore): Promise<WhatsAppFlowResult | null> {
  const extracted = extractRentalDetails(body, current);

  if (!Object.keys(extracted).length) {
    if (current.step === 'rental_times' && isVagueTimeReply(body)) {
      return { handled: true, reply: timeClarificationPrompt(locale, current) };
    }
    const field = learnableField(current.step);
    const phrase = field ? safeLearningPhrase(body) : null;
    const approvedValue = phrase && field === 'vehicle' ? await store.resolveApprovedVariant?.(phrase, field) : null;
    if (approvedValue) return continueRental(phone, approvedValue, current, locale, booking, store);
    if (phrase && field) await store.recordLanguageCandidate?.({ phrase, field });
    return null;
  }
  const merged: FlowState = { ...current, ...extracted, locale };
  // Trip needs are retained as customer context. The bot must not silently
  // change a requested category or state an unverified policy, age rule,
  // insurance term, payment condition, border rule, or fee.

  const nextStep = rentalStepFor(merged);
  const vehicleWasAdded = !current.vehiclePreference && Boolean(merged.vehiclePreference);
  const state = { ...merged, step: nextStep };
  await store.saveState(phone, state);

  let suggestions = '';
  if (vehicleWasAdded && state.pickupDate && state.dropoffDate) {
    try {
      const quotes = await store.getRentalQuotes?.(state) ?? [];
      suggestions = quotePrompt(quotes, locale);
    } catch {
      // Catalogue suggestions are optional. Intake never fails because the
      // catalogue is temporarily unavailable.
    }
  }
  return { handled: true, reply: `${suggestions}${promptForState(state, locale, booking)}` };
}

function handoffState(state: FlowState | null, locale: FlowLocale): FlowState {
  return { ...(state ?? { step: 'menu' as const }), locale, handedOff: true };
}

function handoffSummary(state: FlowState | null, reason: string) {
  const facts = state ? [
    state.pickupDate && `איסוף ${state.pickupDate}`,
    state.dropoffDate && `החזרה ${state.dropoffDate}`,
    state.pickupLocation && `מ־${state.pickupLocation}`,
    state.dropoffLocation && `ל־${state.dropoffLocation}`,
    state.vehiclePreference && `קטגוריה ${state.vehiclePreference}`,
    state.carSale?.selectedCarIds?.length && `רכב למכירה ${state.carSale.selectedCarIds.join(', ')}`,
    state.carSale?.budget && `תקציב עד ₪${state.carSale.budget}`,
    state.carSale?.needs?.length && `צרכי קנייה ${state.carSale.needs.join('/')}`,
    state.leasing?.kind && state.leasing.kind !== 'unknown' && `ליסינג ${state.leasing.kind === 'business' ? 'עסקי' : 'פרטי'}`,
    state.bookingReference && `מספר הזמנה ${state.bookingReference}`,
  ].filter(Boolean).join(', ') : '';
  return facts ? `${reason} | הקשר: ${facts}` : reason;
}

function leasingKindFrom(input: string): Exclude<LeasingKind, 'unknown'> | null {
  const text = normalized(input);
  if (/עסקי|חברה|צי רכב|business|company|fleet/.test(text)) return 'business';
  if (/פרטי|אישי|private|personal/.test(text)) return 'private';
  return null;
}

function leasingTypeQuestion(locale: FlowLocale) {
  return locale === 'he'
    ? pickRandom([
        'בשמחה. כדי לא לנחש תנאי ליסינג: מדובר בליסינג פרטי או בליסינג עסקי?',
        'מעולה, עסקאות ליסינג זה ממש התחום שלנו! רק כדי שאפנה אותך לנציג הנכון, מדובר בליסינג פרטי או שזה רכב לעסק?',
        'הגעת למקום הנכון. תרצו לקבל פרטים על מסלול ליסינג פרטי או ליסינג עסקי / חברה?'
      ])
    : pickRandom([
        'Happy to help. So I do not guess leasing terms: is this private or business leasing?',
        'Great, we have excellent leasing programs! Just to get you to the right agent, is this a private lease or a business lease?',
        'Leasing is a great option. Are you looking into private leasing or do you need a car for your business?'
      ]);
}

function leasingHandoffReply(locale: FlowLocale, kind: Exclude<LeasingKind, 'unknown'>) {
  const label = locale === 'he' ? (kind === 'business' ? 'ליסינג עסקי' : 'ליסינג פרטי') : (kind === 'business' ? 'business leasing' : 'private leasing');
  return locale === 'he'
    ? pickRandom([
        `הבנתי שמדובר ב־${label}. תנאים, רכב, מחיר ומועד מסירה אינם מאומתים כאן, לכן העברתי לנציג עם הפרט הזה כדי שיבדוק את האפשרויות בלי להבטיח דבר.`,
        `מצוין, סימנתי שאתם מתעניינים ב־${label}. מאחר שמחירי ליסינג ותנאים דורשים התאמה אישית, נציג שלנו משתלט כעת על השיחה ויחזור אליכם בהקדם עם ההצעות.`,
        `מעולה. העברתי לצוות שלנו שאתם מעוניינים ב־${label}. נציג אנושי יבדוק את המלאי והמסלולים וישלח לכם את ההצעות הכי רלוונטיות בלי שום התחייבות בשלב זה.`
      ])
    : pickRandom([
        `I understand this is ${label}. Terms, vehicle, price, and delivery timing are not verified here, so I have passed this detail to a representative to check the options without promising any of them.`,
        `Noted, you're looking for ${label}. Since leasing requires a custom quote, I've handed this over to a human agent who will get back to you shortly with options.`,
        `Perfect. I've sent your request for ${label} to our leasing team. A representative will review the vehicles available and provide you with an exact quote soon.`
      ]);
}

function knowledgeReply(input: string, locale: FlowLocale, state?: FlowState | null): WhatsAppFlowResult | null {
  const answer = getSmartCarServiceAnswer(input, locale);
  if (!answer) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://smartcar.co.il';
  return {
    handled: true,
    reply: composeServiceResponse({
      locale, input, state, kind: answer.topic === 'damage_accident' ? 'complaint' : 'information',
      answer: answer.reply, nextStep: `${answer.linkLabel}: ${base}/${locale}${answer.href}`,
      subject: answer.topic === 'deposit' ? (locale === 'he' ? 'גובה הפיקדון' : 'the deposit amount') : undefined,
    }),
  };
}

/** Handles the complete deterministic SmartCar service flow. */
export async function getWhatsAppFlowReply(phone: string, body: string, store: WhatsAppFlowStore = persistentStore): Promise<WhatsAppFlowResult> {
  const input = normalized(body);
  const [booking, existingState] = await Promise.all([store.activeBooking(phone), store.loadState(phone)]);
  const locale = detectWhatsAppLocale(body, existingState?.locale);

  // The final "send the request" step is a plain yes/no gate. It stays
  // deterministic so a customer is never told the request was confirmed
  // before createRentalRequest has actually saved it.
  if (existingState?.step === 'rental_confirm') {
    if (!confirmsTerms(body)) {
      return {
        handled: true,
        reply: locale === 'en'
          ? 'The request has not been submitted yet. Reply I confirm to agree to the terms and submit it, or menu to start again.'
          : 'הבקשה עדיין לא נשלחה. כתבו אני מאשר/ת כדי להסכים לתנאים ולשלוח אותה, או תפריט להתחלה מחדש.',
      };
    }
    if (store.isSimulation) {
      await store.saveState(phone, null);
      return {
        handled: true,
        reply: locale === 'en'
          ? 'The simulation is complete. No request was sent, no customer record was created, and no booking was made. You can reset the chat and try another scenario.'
          : 'הסימולציה הושלמה. לא נשלחה בקשה, לא נוצר רישום לקוח ולא בוצעה הזמנה. אפשר לאפס את השיחה ולנסות תרחיש נוסף.',
      };
    }
    const requestId = await store.createRentalRequest(phone, existingState, locale);
    if (!requestId) {
      return {
        handled: true,
        reply: locale === 'en'
          ? 'We could not save the request due to a temporary issue. Your details are still here. Please try I confirm again or type representative.'
          : 'לא הצלחנו לשמור את הבקשה עקב תקלה זמנית. הפרטים עדיין שמורים. נסו לכתוב שוב אני מאשר/ת או כתבו נציג.',
      };
    }
    await store.saveState(phone, null);

    let pdfLinkStr = '';
    try {
      const { generateWhatsAppPdfQuoteLink } = await import('./whatsapp-pdf');
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';
      const link = await generateWhatsAppPdfQuoteLink(existingState, locale, baseUrl);
      if (link) {
        pdfLinkStr = locale === 'en' ? `\n\nHere is your requested price quote document:\n${link}` : `\n\nמצורפת הצעת המחיר המבוקשת:\n${link}`;
      }
    } catch (err) { console.error('[whatsapp-flow] PDF link generation failed', err); }

    return {
      handled: true,
      reply: (locale === 'en'
        ? 'Thank you — your rental request has been received by SmartCar. A representative will check the full fleet and contact you with availability, price, and final written confirmation. The request is not yet a confirmed booking.'
        : 'תודה — בקשת ההשכרה התקבלה ב־SmartCar. נציג יבדוק את הצי המלא ויחזור אליכם עם זמינות, מחיר ואישור סופי בכתב. הבקשה עדיין אינה הזמנה מאושרת.') + pdfLinkStr,
      escalate: true,
      escalateReason: `בקשת השכרה חדשה מ-WhatsApp (${requestId})`,
    };
  }

  const initialRoute = classifyWhatsAppInitialRoute(body, Boolean(booking));

  if (input === 'english' || input === 'עברית' || input === 'hebrew') {
    const state = existingState ? { ...existingState, locale, handedOff: false } : { step: 'menu' as const, locale };
    await store.saveState(phone, state);
    return { handled: true, reply: promptForState(state, locale, booking) };
  }

  // A numeric choice must be interpreted before free-text classifiers. This
  // keeps the simulator buttons and a real WhatsApp menu from falling into a
  // generic menu or a rental intake simply because "2" or "3" has no words.
  if (existingState?.lastQuestion === 'booking_lookup' && !isMenuCommand(body)) {
    if (!hasBookingLookupDetail(body)) {
      return { handled: true, reply: bookingLookupClarification(locale) };
    }
    const bookingReference = body.trim().replace(/[^a-zA-Z0-9\u0590-\u05ff -]/g, '').slice(0, 80);
    const state: FlowState = { ...existingState, bookingReference: bookingReference || undefined, lastQuestion: undefined };
    await store.saveState(phone, handoffState(state, locale));
    return {
      handled: true,
      escalate: true,
      escalateReason: handoffSummary(state, 'בירור הזמנה שלא אומתה לפי המספר'),
      reply: locale === 'en'
        ? 'Thank you. I have passed the booking enquiry with the detail you shared, so you will not need to start a new rental request.'
        : 'תודה. העברתי את בירור ההזמנה עם הפרט ששיתפתם, כך שלא תצטרכו להתחיל בקשת השכרה חדשה.',
    };
  }

  // A customer does not have to know the menu number. Treat ordinary wording
  // such as "I have an existing booking" exactly like choice 2, even when
  // the booking was made from another phone number.
  if (!booking && initialRoute === 'existing_booking_lookup' && (!existingState || existingState.step === 'menu') && !existingState?.lastQuestion) {
    const state: FlowState = { step: 'menu', locale, lastQuestion: 'booking_lookup' };
    await store.saveState(phone, state);
    return { handled: true, reply: bookingLookupPrompt(locale) };
  }

  if (booking && (!existingState || existingState.step === 'menu')) {
    if (input === '1') return { handled: true, reply: formatBooking(booking, locale) };
    if (input === '2' || input === '5') {
      await store.saveState(phone, handoffState(existingState, locale));
      return {
        handled: true,
        escalate: true,
        escalateReason: input === '2' ? handoffSummary(existingState, 'בקשה לשינוי או הארכת הזמנה') : handoffSummary(existingState, 'בקשה לדבר עם נציג'),
        reply: locale === 'en'
          ? 'I have passed this request with your active booking details, so you will not need to repeat them.'
          : 'העברתי את הבקשה עם פרטי ההזמנה הפעילה, כך שלא תצטרכו לחזור עליהם.',
      };
    }
    if (input === '3') {
      const state: FlowState = { step: 'rental_dates', locale };
      await store.saveState(phone, state);
      return { handled: true, reply: datesPrompt(locale) };
    }
    if (input === '4') return {
      handled: true,
      reply: locale === 'en'
        ? 'Please send the pickup and return locations with the dates. A representative will confirm the route or service without assuming availability.'
        : 'שלחו את מיקום האיסוף וההחזרה יחד עם התאריכים. נציג יאשר את המסלול או השירות בלי להניח זמינות.',
    };
    if (input === '6') {
      await store.saveState(phone, handoffState(existingState, locale));
      return {
        handled: true,
        escalate: true,
        escalateReason: handoffSummary(existingState, 'שאלה חופשית של לקוח קיים'),
        reply: locale === 'en' ? 'Please write the question or important detail here. I have kept the active booking context for a representative.' : 'כתבו כאן את השאלה או הפרט החשוב. שמרתי את הקשר ההזמנה הפעילה לנציג.',
      };
    }
    if (input === '7') return {
      handled: true,
      reply: locale === 'en' ? 'Please tell me what happened: accident, flat tyre, or roadside breakdown. If there is immediate danger, contact emergency services first.' : 'כתבו מה קרה: תאונה, פנצ׳ר או תקלה בדרך. אם יש סכנה מיידית, פנו קודם לגורמי החירום.',
    };
  }

  if (!booking && (!existingState || existingState.step === 'menu') && !existingState?.lastQuestion) {
    if (input === '1') {
      const state: FlowState = { step: 'rental_dates', locale };
      await store.saveState(phone, state);
      return { handled: true, reply: datesPrompt(locale) };
    }
    if (input === '2') {
      const state: FlowState = { step: 'menu', locale, lastQuestion: 'booking_lookup' };
      await store.saveState(phone, state);
      return { handled: true, reply: bookingLookupPrompt(locale) };
    }
    if (input === '3') {
      const state: FlowState = { step: 'menu', locale, lastQuestion: 'commercial_choice' };
      await store.saveState(phone, state);
      return { handled: true, reply: commercialChoicePrompt(locale) };
    }
    if (input === '4') return {
      handled: true,
      reply: locale === 'en' ? 'Please send the pickup and return locations with the dates, and I will keep the request focused on that service.' : 'שלחו את מיקום האיסוף וההחזרה יחד עם התאריכים, ואשמור את הבירור ממוקד בשירות הזה.',
    };
    if (input === '5') {
      await store.saveState(phone, handoffState(existingState, locale));
      return {
        handled: true,
        escalate: true,
        escalateReason: 'בקשה לדבר עם נציג',
        reply: locale === 'en' ? 'I have passed your request to a representative. Please write any important detail here.' : 'העברתי את הבקשה לנציג. אפשר לכתוב כאן כל פרט שחשוב שנכיר.',
      };
    }
    if (input === '6') return {
      handled: true,
      reply: locale === 'en' ? 'Please tell me what happened: accident, flat tyre, or roadside breakdown. If there is immediate danger, contact emergency services first.' : 'כתבו מה קרה: תאונה, פנצ׳ר או תקלה בדרך. אם יש סכנה מיידית, פנו קודם לגורמי החירום.',
    };
  }

  if (initialRoute === 'accident') {
    await store.saveState(phone, handoffState(existingState, locale));
    return {
      handled: true,
      reply: locale === 'en'
        ? pickRandom([
            `I’m sorry this happened. Safety first: if there is immediate danger or anyone is hurt, contact emergency services now.\n\nOnly if it is safe, stop in a safe place, use hazard lights, and move away from traffic where possible.\n\nThen call SmartCar: ${OFFICE_PHONE}. A representative is taking over — you do not need to repeat the details already shared.`,
            `Oh no, I'm so sorry! Please make sure everyone is safe first. If there are injuries, call emergency services immediately.\n\nIf you're safe, pull over, turn on your hazard lights, and call us at ${OFFICE_PHONE}. An agent is stepping in to help right now.`,
            `I'm really sorry to hear that. Your safety is the priority—call emergency services if anyone is hurt.\n\nOnce you are in a safe spot away from traffic, please call our emergency line at ${OFFICE_PHONE}. I've already alerted our team with your details.`
          ])
        : pickRandom([
            `מצטערים שזה קרה. קודם כול בטיחות: אם יש סכנה מיידית או נפגעים, פנו עכשיו לגורמי החירום.\n\nרק אם בטוח לעשות זאת, עצרו במקום בטוח, הפעילו אורות אזהרה והתרחקו מהתנועה ככל האפשר.\n\nאחר כך התקשרו ל־SmartCar: ${OFFICE_PHONE}. נציג מטפל בפנייה — אין צורך לחזור על הפרטים שכבר כתבתם.`,
            `אוי, אני ממש מצטער לשמוע! קודם כל הבטיחות שלכם: אם יש נפגעים התקשרו מיד לכוחות ההצלה (100/101).\n\nאם הכול בסדר, רדו לשוליים בזהירות, הפעילו וינקרים והתקשרו אלינו ל־${OFFICE_PHONE}. נציג שלנו משתלט על השיחה עכשיו ויעזור לכם.`,
            `מצטערים מאוד על החוויה. בבקשה ודאו שכולם בריאים ושלמים ואם צריך הזמינו אמבולנס או משטרה.\n\nברגע שאתם במקום בטוח, חייגו למוקד שלנו: ${OFFICE_PHONE}. צוות החירום שלנו כבר קיבל את ההודעה ומוכן לעזור.`
          ]),
      escalate: true,
      escalateReason: 'תאונה מדווחת',
    };
  }

  if (initialRoute === 'breakdown') {
    await store.saveState(phone, handoffState(existingState, locale));
    return {
      handled: true,
      reply: locale === 'en'
        ? pickRandom([
            `I’m sorry you’re stuck. If the vehicle is unsafe or traffic is a risk, do not keep driving; contact emergency services if there is immediate danger.\n\nOnly if safe, stop in a safe place and use hazard lights. Call SmartCar now: ${OFFICE_PHONE}. A representative is taking over, with the details already shared.`,
            `Sorry to hear about the car trouble! Please pull over safely and turn on your hazards.\n\nCall our support line at ${OFFICE_PHONE} and a human agent will organize roadside assistance for you right away.`,
            `That's frustrating, I'm sorry! Make sure you are safely off the road. I've flagged this to a representative—please call ${OFFICE_PHONE} so we can get help to you as quickly as possible.`
          ])
        : pickRandom([
            `מצטערים שנתקעתם. אם הרכב אינו בטוח או שיש סיכון מהתנועה, אל תמשיכו לנסוע; במקרה של סכנה מיידית פנו לגורמי החירום.\n\nרק אם בטוח, עצרו במקום בטוח והפעילו אורות אזהרה. התקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}. נציג מטפל בפנייה עם הפרטים שכבר כתבתם.`,
            `אוי לא, איזה באסה להיתקע ככה! בבקשה תעצרו בצד במקום בטוח והפעילו אורות אזהרה.\n\nאני מעביר את הקריאה מיד לצוות הטכני. חייגו אלינו ל־${OFFICE_PHONE} כדי שנוכל לשלוח אליכם חילוץ או גרר.`,
            `מצטער לשמוע שיש תקלה ברכב. אם אתם על כביש מהיר, צאו מהרכב מעבר למעקה הבטיחות.\n\nהעברתי את הפנייה לנציג, התקשרו אלינו למוקד ${OFFICE_PHONE} ונדאג לעזור לכם כמה שיותר מהר.`
          ]),
      escalate: true,
      escalateReason: 'פנצ׳ר או תקלה בדרך',
    };
  }

  // A disputed charge needs account-level review. Give ownership first rather
  // than quoting a general policy as though it resolved the individual case.
  if (/חיוב|חויב|charge|charged|damage charge|fuel charge/i.test(input) && /הזוי|לא מקבל|לא מסכים|כועס|מתוסכל|ridiculous|do not accept|unacceptable|angry|frustrated/i.test(input)) {
    await store.saveState(phone, handoffState(existingState, locale));
    return {
      handled: true, escalate: true, escalateReason: handoffSummary(existingState, 'מחלוקת על חיוב'),
      reply: composeServiceResponse({
        locale, input: body, state: existingState, kind: 'complaint',
        answer: locale === 'en' ? 'I have sent the charge for review with the details already shared, so you will not need to repeat the issue.' : 'העברתי את החיוב לבדיקה עם הפרטים שכבר שיתפתם, כך שלא תצטרכו לחזור על העניין.',
        nextStep: locale === 'en' ? 'If you have it, send the booking reference or receipt here.' : 'אם יש מספר הזמנה או קבלה, אפשר לשלוח אותם כאן.',
      }),
    };
  }

  // Keep the four commercial intents separate. A customer who says only
  // “car” receives one short disambiguation question; buying a listed car
  // enters the verified catalogue flow and never falls into rental intake.
  const commercialIntent = classifyCommercialIntent(body);
  if (!existingState?.handedOff && existingState?.leasing?.kind === 'unknown') {
    const kind = leasingKindFrom(body);
    if (!kind) return { handled: true, reply: leasingTypeQuestion(locale) };
    const state: FlowState = { ...existingState, locale, leasing: { kind } };
    await store.saveState(phone, handoffState(state, locale));
    return {
      handled: true, escalate: true, escalateReason: handoffSummary(state, 'בקשת ליסינג'),
      reply: leasingHandoffReply(locale, kind),
    };
  }
  if (!existingState?.handedOff && commercialIntent === 'leasing') {
    const kind = leasingKindFrom(body);
    if (!kind) {
      await store.saveState(phone, { ...(existingState ?? { step: 'menu' as const }), locale, leasing: { kind: 'unknown' } });
      return { handled: true, reply: leasingTypeQuestion(locale) };
    }
    const state: FlowState = { ...(existingState ?? { step: 'menu' as const }), locale, leasing: { kind } };
    await store.saveState(phone, handoffState(state, locale));
    return {
      handled: true, escalate: true, escalateReason: handoffSummary(state, 'בקשת ליסינג'),
      reply: leasingHandoffReply(locale, kind),
    };
  }
  if (!existingState?.handedOff && commercialIntent === 'sell_own_car') {
    await store.saveState(phone, handoffState(existingState, locale));
    return {
      handled: true, escalate: true, escalateReason: handoffSummary(existingState, 'בקשה למכירת רכב פרטי'),
      reply: ownCarSaleHandoff(locale),
    };
  }
  if (!existingState?.handedOff && !existingState?.carSale && commercialIntent === 'ambiguous' && initialRoute !== 'rental' && !isRentalStep(existingState?.step ?? 'menu')) {
    const state: FlowState = { ...(existingState ?? { step: 'menu' as const }), locale };
    await store.saveState(phone, state);
    return { handled: true, reply: commercialIntentQuestion(locale) };
  }
  if (!existingState?.handedOff && isCarSaleConversation(body, existingState?.carSale)) {
    let cars: CarForSale[];
    try {
      cars = await (store.getCarsForSale?.() ?? getCarsForSale());
    } catch (error) {
      console.error('[whatsapp-flow] cars-for-sale catalogue unavailable:', error);
      await store.saveState(phone, handoffState(existingState, locale));
      return {
        handled: true, escalate: true, escalateReason: handoffSummary(existingState, 'קטלוג רכבים למכירה אינו זמין'),
        reply: locale === 'he'
          ? 'אני לא יכול לאמת כרגע את נתוני קטלוג הרכבים למכירה, ולכן לא אציג פרטים לא בדוקים. העברתי לנציג את הבקשה וההקשר שכבר שיתפתם.'
          : 'I cannot verify the cars-for-sale catalogue right now, so I will not show unchecked details. I have passed your request and the context already shared to a representative.',
      };
    }
    const sales = getCarSalesReply(body, locale, cars, existingState?.carSale);
    const state: FlowState = {
      ...(existingState ?? { step: 'menu' as const }), locale, lastQuestion: undefined, carSale: sales.context,
      ...(sales.escalate ? { handedOff: true } : {}),
    };
    await store.saveState(phone, state);
    return {
      handled: true, reply: sales.reply, escalate: sales.escalate,
      escalateReason: sales.escalate ? handoffSummary(state, sales.escalateReason ?? `מכירת רכב: ${sales.action}`) : undefined,
    };
  }

  // Published SmartCar answers take precedence over generic escalation. This
  // avoids making customers ask a representative about information already
  // stated in the terms, while the accident/breakdown safety paths above keep
  // their mandatory human handoff.
  if (initialRoute !== 'rental' && !isRentalStep(existingState?.step ?? 'menu')) {
    const answer = knowledgeReply(body, locale, existingState);
    if (answer) return answer;
  }

  if (initialRoute !== 'rental' && !isRentalStep(existingState?.step ?? 'menu')) {
    const sales = consultativeSalesReply(body, locale, existingState);
    if (sales) {
      if (sales.play.mustHandoff) await store.saveState(phone, handoffState(existingState, locale));
      return {
        handled: true, reply: sales.reply, escalate: sales.play.mustHandoff,
        escalateReason: sales.play.mustHandoff ? handoffSummary(existingState, `מכירה ייעוצית: ${sales.play.id}`) : undefined,
      };
    }
  }

  // When a customer objects to being asked twice, continue from the facts we
  // already hold. This is a service recovery, not a reason to hand off.
  if (existingState && isRentalStep(existingState.step) && /כבר כתבתי|שוב שואלים|למה אתם שוב|already (?:told|gave|wrote)|asking again/i.test(input)) {
    return {
      handled: true,
      reply: composeServiceResponse({
        locale, input: body, state: existingState, kind: 'complaint',
        answer: locale === 'en' ? 'You are right — I will use the details already here.' : 'נכון — אשתמש בפרטים שכבר נמצאים כאן.',
        nextStep: promptForState(existingState, locale, booking),
      }),
    };
  }

  if (/טיסה.*מתעכב|טיסה.*אאחר|flight.*(?:delay|late)|(?:delay|late).*flight/i.test(input)) {
    await store.saveState(phone, handoffState(existingState, locale));
    return {
      handled: true, escalate: true, escalateReason: handoffSummary(existingState, 'איחור או עיכוב בטיסה'),
      reply: composeServiceResponse({
        locale, input: body, state: existingState, kind: 'change', subject: locale === 'he' ? 'עיכוב הטיסה' : 'the flight delay',
        answer: locale === 'en' ? 'I have passed the timing issue to SmartCar with the details already shared.' : 'העברתי את עניין התזמון ל־SmartCar עם הפרטים שכבר שיתפתם.',
        nextStep: locale === 'en' ? `If pickup is close, call SmartCar now: ${OFFICE_PHONE}.` : `אם האיסוף קרוב, התקשרו עכשיו ל־SmartCar: ${OFFICE_PHONE}.`,
      }),
    };
  }

  // Some consultative plays are themselves a human handoff (discount,
  // extension, business terms, or unconfirmed availability). Handle those
  // before the broad escalation keyword check so the handoff preserves the
  // recognised need instead of reducing it to a generic “representative”.
  if (existingState && isRentalStep(existingState.step) && existingState.step !== 'rental_vehicle') {
    const sales = consultativeSalesReply(body, locale, existingState);
    if (sales?.play.mustHandoff) {
      const extracted = extractRentalDetails(body, existingState);
      const advisoryState: FlowState = Object.keys(extracted).length
        ? { ...existingState, ...extracted, locale, step: rentalStepFor({ ...existingState, ...extracted, locale }) }
        : existingState;
      await store.saveState(phone, handoffState(advisoryState, locale));
      return {
        handled: true, escalate: true,
        escalateReason: handoffSummary(advisoryState, `מכירה ייעוצית בהשכרה: ${sales.play.id}`),
        reply: composeServiceResponse({
          locale, input: body, state: advisoryState, kind: 'handoff', answer: sales.play.response,
          nextStep: sales.play.nextAction, subject: sales.play.reflection,
        }),
      };
    }
  }

  // A generic change or cancellation request is genuinely ambiguous while
  // details are being collected. Preserve the draft and route it with its
  // context instead of guessing which fact the customer wants changed.
  const isGenericDraftChange = Boolean(existingState && isRentalStep(existingState.step))
    && /(?:ביטול|לבטל|שינוי|לשנות|הארכ|להאריך|cancel|cancellation|change|modify|amend|extend|extension)/i.test(input)
    && !Object.keys(extractRentalDetails(body, existingState!)).length;
  if (isGenericDraftChange) {
    await store.saveState(phone, handoffState(existingState, locale));
    return {
      handled: true,
      escalate: true,
      escalateReason: handoffSummary(existingState, 'בקשת שינוי או ביטול במהלך איסוף פרטים'),
      reply: composeServiceResponse({
        locale,
        input: body,
        state: existingState,
        kind: 'handoff',
        answer: locale === 'en'
          ? 'I have passed the change or cancellation request to SmartCar with the details already shared, so you will not need to repeat them or start again.'
          : 'העברתי את בקשת השינוי או הביטול ל־SmartCar עם הפרטים שכבר שיתפתם, כך שלא תצטרכו להתחיל מחדש.',
        nextStep: locale === 'en' ? 'If you have it, send the booking reference here.' : 'אם יש מספר הזמנה, אפשר לשלוח אותו כאן.',
      }),
    };
  }

  const validStructuredEmail = existingState?.step === 'rental_email' && Boolean(validEmail(body));
  const collectingNewRental = Boolean(existingState) && isRentalStep(existingState!.step);
  if (requiresHumanHandoff(body, collectingNewRental) && !validStructuredEmail) {
    await store.saveState(phone, handoffState(existingState, locale));
    const mood = detectConversationMood(body);
    return {
      handled: true,
      reply: composeServiceResponse({
        locale, input: body, state: existingState, kind: mood === 'angry' ? 'complaint' : 'handoff',
        answer: locale === 'en'
          ? 'I have passed this to the SmartCar team with the details already shared, so you will not need to repeat yourself.'
          : 'העברתי את הפנייה לצוות SmartCar עם הפרטים שכבר שיתפתם, כך שלא תצטרכו לחזור עליהם.',
        nextStep: locale === 'en' ? 'If you have it, send the booking reference here.' : 'אם יש מספר הזמנה, אפשר לשלוח אותו כאן.',
      }),
      escalate: true,
      escalateReason: handoffSummary(existingState, 'בקשה לדבר עם נציג או טיפול חריג'),
    };
  }

  // Answer common, general service questions from a controlled knowledge set.
  // Do not let these messages steal a rental intake that includes extractable
  // facts; in that case the rental engine keeps collecting the request.
  if (!isRentalStep(existingState?.step ?? 'menu') && initialRoute !== 'rental') {
    const service = serviceReply(classifyServiceIntent(body), locale, booking);
    if (service) return service;
  }

  if (isMenuCommand(body)) {
    await store.saveState(phone, { step: 'menu', locale });
    return { handled: true, reply: menuFor(booking, locale) };
  }

  // Once the conversation is with a person, never resume the form silently.
  // A conscious menu/language command above is the customer-controlled reset.
  if (existingState?.handedOff) return { handled: true, escalate: true, escalateReason: 'שיחה כבר הועברה לנציג' };

  if (!existingState) {
    if (/תינוק|ילד|baby|child/.test(input) && /נוחת|נחיתה|landing|land at|airport/.test(input)) {
      const state: FlowState = { step: 'rental_dates', locale, ...extractRentalDetails(body, { step: 'rental_dates', locale }) };
      await store.saveState(phone, state);
      return {
        handled: true,
        reply: composeServiceResponse({
          locale, input: body, state, kind: 'request',
          answer: locale === 'en' ? 'I’ve noted that you are travelling with a baby and arriving late; I will keep that in the request.' : 'רשמתי שאתם עם תינוק ונוחתים מאוחר; אשמור את זה בבקשה.',
          nextStep: datesPrompt(locale, state.pickupDate),
        }),
      };
    }
    if (input === '1' || initialRoute === 'rental') {
      const state: FlowState = { step: 'rental_dates', locale };
      const progressed = await continueRental(phone, body, state, locale, booking, store);
      if (progressed) return progressed;
      await store.saveState(phone, state);
      return { handled: true, reply: datesPrompt(locale) };
    }
    if (initialRoute === 'existing_booking_lookup') return { handled: true, reply: booking ? existingCustomerMenu(booking, locale) : locale === 'en' ? 'We could not find an active booking linked to this number. Type representative and our team will help.' : 'לא זיהינו הזמנה פעילה לפי המספר הזה. כתבו "נציג" ונעזור לכם לאתר את ההזמנה.' };
    if (input.includes('ליסינג') || input.includes('מכירה') || /leasing|buy|purchase|cars? for sale/.test(input)) return { handled: true, reply: locale === 'en' ? 'SmartCar offers private and business leasing, as well as selected vehicles for sale. Tell us whether you are interested in private leasing, business leasing, or purchasing a vehicle, and we will guide you.' : 'SmartCar מציעה ליסינג פרטי ועסקי וגם רכבים נבחרים למכירה. כתבו לנו מה מעניין אתכם — ליסינג פרטי, ליסינג לעסק או רכב לרכישה — ונכוון אתכם.' };
    if (input.includes('סניף') || input.includes('מסיר') || input.includes('החזר') || /branch|delivery|return/.test(input)) return { handled: true, reply: locale === 'en' ? 'SmartCar has branches in Herzliya, Tel Aviv, Jerusalem, and Ben Gurion Airport. Delivery and collection at an address in Israel can also be arranged in advance, subject to availability.' : 'לרשותכם סניפים בהרצליה, תל אביב, ירושלים ונתב״ג. אפשר גם לתאם מסירה והחזרה בכתובת שנוחה לכם ברחבי הארץ, בכפוף לתיאום מראש ולזמינות.' };
    await store.saveState(phone, { step: 'menu', locale });
    return { handled: true, reply: menuFor(booking, locale) };
  }

  // A customer may provide any missing facts in any order, including in one
  // message. Handle that before the legacy single-field prompts below.
  if (isRentalStep(existingState.step)) {
    // Advisory selling is available inside a rental request too.  Capture
    // any unambiguous new facts first, then answer the hesitation and retain
    // the same single next missing field.  Vehicle selection itself is kept
    // in the intake parser so “SUV” continues the form rather than becoming
    // a generic sales reply.
    const sales = existingState.step === 'rental_vehicle'
      ? null
      : consultativeSalesReply(body, locale, existingState);
    if (sales) {
      const extracted = extractRentalDetails(body, existingState);
      const advisoryState: FlowState = Object.keys(extracted).length
        ? { ...existingState, ...extracted, locale, step: rentalStepFor({ ...existingState, ...extracted, locale }) }
        : existingState;
      const savedState = sales.play.mustHandoff ? handoffState(advisoryState, locale) : advisoryState;
      await store.saveState(phone, savedState);
      return {
        handled: true, escalate: sales.play.mustHandoff,
        escalateReason: sales.play.mustHandoff ? handoffSummary(advisoryState, `מכירה ייעוצית בהשכרה: ${sales.play.id}`) : undefined,
        reply: composeServiceResponse({
          locale, input: body, state: advisoryState, kind: sales.play.mustHandoff ? 'handoff' : 'request',
          answer: sales.play.response,
          nextStep: sales.play.mustHandoff
            ? sales.play.nextAction
            : promptForState(advisoryState, locale, booking),
          subject: sales.play.reflection,
        }),
      };
    }
    const progressed = await continueRental(phone, body, existingState, locale, booking, store);
    if (progressed) return progressed;
  }

  if (existingState.step === 'rental_dates') {
    const dates = parseDateCandidates(body);
    if (!dates.length) return { handled: true, reply: locale === 'en' ? 'I did not recognise that date. Please tell me the pickup or return date again in your own words.' : 'לא הצלחתי לזהות את התאריך. כתבו אותו שוב בצורה שנוחה לכם.' };
    if (!existingState.pickupDate) {
      const pickupDate = dates[0];
      if (pickupDate < todayInIsrael()) return { handled: true, reply: locale === 'en' ? 'The pickup date must be today or later. Please send another date.' : 'תאריך האיסוף צריך להיות מהיום והלאה. שלחו בבקשה תאריך אחר.' };
      const dropoffDate = dates[1];
      if (!dropoffDate) {
        const state = { ...existingState, pickupDate };
        await store.saveState(phone, state);
        return { handled: true, reply: datesPrompt(locale, pickupDate) };
      }
      if (dropoffDate < pickupDate) return { handled: true, reply: locale === 'en' ? 'The return date needs to be on or after the pickup date. Please send it again.' : 'תאריך ההחזרה צריך להיות ביום האיסוף או אחריו. שלחו אותו שוב בבקשה.' };
      await store.saveState(phone, { ...existingState, pickupDate, dropoffDate, step: 'rental_times' });
      return { handled: true, reply: timesPrompt(locale) };
    }
    const dropoffDate = dates[0];
    if (dropoffDate < existingState.pickupDate) return { handled: true, reply: locale === 'en' ? 'The return date needs to be on or after the pickup date. Please send it again.' : 'תאריך ההחזרה צריך להיות ביום האיסוף או אחריו. שלחו אותו שוב בבקשה.' };
    await store.saveState(phone, { ...existingState, dropoffDate, step: 'rental_times' });
    return { handled: true, reply: timesPrompt(locale) };
  }

  if (existingState.step === 'rental_times') {
    const times = parseTimes(body);
    if (!times) return { handled: true, reply: locale === 'en' ? 'I did not recognise both times. Please tell me the pickup and return times again in your own words.' : 'לא זיהיתי את שתי השעות. כתבו אותן שוב בצורה שנוחה לכם.' };
    if (existingState.pickupDate === existingState.dropoffDate && times.returnTime <= times.pickupTime) {
      return { handled: true, reply: locale === 'en' ? 'For a same-day rental, the return time must be later than the pickup time.' : 'בהשכרה באותו יום, שעת ההחזרה חייבת להיות מאוחרת משעת האיסוף.' };
    }
    await store.saveState(phone, { ...existingState, ...times, step: 'rental_locations' });
    return { handled: true, reply: locationsPrompt(locale) };
  }

  if (existingState.step === 'rental_locations') {
    const locations = parseLocations(body);
    if (!locations) return { handled: true, reply: locale === 'en' ? 'I need both locations. You can include full delivery and collection addresses.' : 'אני צריך את שני המיקומים. אפשר גם לכתוב כתובות מלאות למסירה ולהחזרה.' };
    await store.saveState(phone, { ...existingState, ...locations, step: 'rental_vehicle' });
    return { handled: true, reply: vehiclePrompt(locale) };
  }

  if (existingState.step === 'rental_vehicle') {
    const vehiclePreference = parseVehiclePreference(body);
    if (!vehiclePreference) return { handled: true, reply: locale === 'en' ? 'Tell me the kind of car you have in mind, and I’ll take it from there.' : 'כתבו לי איזה סוג רכב מתאים לכם, ואני אמשיך מכאן.' };
    const state = { ...existingState, vehiclePreference, step: 'rental_name' as const };
    await store.saveState(phone, state);
    let quotes: WhatsAppRentalQuote[] = [];
    try { quotes = await store.getRentalQuotes?.(state) ?? []; } catch (error) { console.error('[whatsapp-flow] quote suggestions unavailable:', error); }
    return { handled: true, reply: `${quotePrompt(quotes, locale)}${namePrompt(locale)}` };
  }

  if (existingState.step === 'rental_name') {
    const customerName = validName(body);
    if (!customerName) return { handled: true, reply: locale === 'en' ? 'Please enter a valid full name, without a link.' : 'כתבו בבקשה שם מלא תקין, ללא קישור.' };
    await store.saveState(phone, { ...existingState, customerName, step: 'rental_email' });
    return { handled: true, reply: emailPrompt(locale) };
  }

  if (existingState.step === 'rental_email') {
    const customerEmail = validEmail(body);
    if (!customerEmail) return { handled: true, reply: locale === 'en' ? 'That email address does not look valid. Please enter it again, for example: name@example.com' : 'כתובת המייל אינה נראית תקינה. כתבו אותה שוב, לדוגמה: name@example.com' };
    const completed = { ...existingState, customerEmail, step: 'rental_confirm' as const };
    await store.saveState(phone, completed);
    return { handled: true, reply: confirmationPrompt(completed, locale) };
  }

  // rental_confirm is handled at the top of getWhatsAppFlowReply and is
  // unreachable here because that branch returns early.

  // A customer often writes a full sentence after the menu was already shown.
  // Keep recognising service intent instead of forcing them back to a number.
  if (existingState.step === 'menu') {
    if (initialRoute === 'rental') {
      await store.saveState(phone, { step: 'rental_dates', locale });
      return { handled: true, reply: datesPrompt(locale) };
    }
    if (initialRoute === 'existing_booking_lookup') {
      return { handled: true, reply: booking ? existingCustomerMenu(booking, locale) : locale === 'en' ? 'We could not find an active booking linked to this number. Type representative and our team will help.' : 'לא זיהינו הזמנה פעילה לפי המספר הזה. כתבו "נציג" ונעזור לכם לאתר את ההזמנה.' };
    }
    if (/ליסינג|מכירה|leasing|purchase|buy|cars? for sale/.test(input)) return { handled: true, reply: locale === 'en' ? 'SmartCar offers private and business leasing, as well as selected vehicles for sale. Tell us what interests you, and we will guide you.' : 'SmartCar מציעה ליסינג פרטי ועסקי וגם רכבים נבחרים למכירה. כתבו לנו מה מעניין אתכם — ליסינג פרטי, ליסינג לעסק או רכב לרכישה — ונכוון אתכם.' };
    if (/סניף|מסירה|החזרה|branch|delivery|return/.test(input)) return { handled: true, reply: locale === 'en' ? 'SmartCar has branches in Herzliya, Tel Aviv, Jerusalem, and Ben Gurion Airport. Delivery and collection at an address in Israel can also be arranged in advance, subject to availability.' : 'לרשותכם סניפים בהרצליה, תל אביב, ירושלים ונתב״ג. אפשר גם לתאם מסירה והחזרה בכתובת שנוחה לכם ברחבי הארץ, בכפוף לתיאום מראש ולזמינות.' };
  }

  if (booking) {
    if (input === '1') return { handled: true, reply: formatBooking(booking, locale) };
    if (input === '2' || input === '5' || input.includes('נציג')) return { handled: true, reply: locale === 'en' ? 'Of course. We have forwarded your request to the SmartCar team. A representative will assist you as soon as possible.' : 'כמובן. העברנו את הפנייה שלכם לצוות SmartCar. נציג יחזור אליכם בהקדם האפשרי.', escalate: true, escalateReason: input === '2' ? 'בקשה לשינוי או הארכת הזמנה' : 'בקשה לדבר עם נציג' };
    if (input === '3') {
      await store.saveState(phone, { step: 'rental_dates', locale });
      return { handled: true, reply: datesPrompt(locale) };
    }
    if (input === '4') return { handled: true, reply: locale === 'en' ? 'SmartCar has branches in Herzliya, Tel Aviv, Jerusalem, and Ben Gurion Airport. Delivery and collection at an address in Israel can also be arranged in advance, subject to availability.' : 'לרשותכם סניפים בהרצליה, תל אביב, ירושלים ונתב״ג. אפשר גם לתאם מסירה והחזרה בכתובת שנוחה לכם ברחבי הארץ, בהתאם לזמינות ולתיאום מראש.' };
    if (input === '6') return { handled: true, reply: locale === 'en' ? 'We have forwarded your request to the SmartCar team. Reply here with your question or any important details, and a representative will assist you.' : 'העברנו את הפנייה לצוות SmartCar. כתבו כאן את השאלה או הפרטים שחשוב שנכיר, ונציג יטפל בה בהקדם.', escalate: true, escalateReason: 'שאלה חופשית של לקוח קיים' };
    if (input === '7') return { handled: true, reply: locale === 'en' ? 'Tell us what happened: accident, flat tyre, or roadside breakdown. If there is immediate danger, contact the emergency services first.' : 'כתבו לנו מה קרה: תאונה, פנצ׳ר או תקלה בדרך. אם קיימת סכנה מיידית, פנו קודם לגורמי החירום.' };
    return { handled: true, reply: existingCustomerMenu(booking, locale) };
  }

  if (input === '1' || input.includes('השכר')) {
    await store.saveState(phone, { step: 'rental_dates', locale });
    return { handled: true, reply: datesPrompt(locale) };
  }
  if (input === '2') return { handled: true, reply: locale === 'en' ? 'We could not find an active booking linked to this WhatsApp number. If the booking uses another number, type representative and we will help.' : 'לא זיהינו הזמנה פעילה לפי מספר הוואטסאפ הזה. אם ההזמנה נרשמה עם מספר אחר, כתבו "נציג" ונעזור לכם.' };
  if (input === '3') return { handled: true, reply: locale === 'en' ? 'SmartCar offers private and business leasing, as well as selected vehicles for sale. Tell us what interests you, and we will guide you.' : 'SmartCar מציעה ליסינג פרטי ועסקי וגם רכבים נבחרים למכירה. כתבו לנו מה מעניין אתכם — ליסינג פרטי, ליסינג לעסק או רכב לרכישה — ונכוון אתכם.' };
  if (input === '4') return { handled: true, reply: locale === 'en' ? 'SmartCar has branches in Herzliya, Tel Aviv, Jerusalem, and Ben Gurion Airport. Delivery and collection at an address in Israel can also be arranged in advance, subject to availability.' : 'לרשותכם סניפים בהרצליה, תל אביב, ירושלים ונתב״ג. אפשר גם לתאם מסירה והחזרה בכתובת שנוחה לכם ברחבי הארץ, בכפוף לתיאום מראש ולזמינות.' };
  if (input === '5' || input.includes('נציג')) return { handled: true, reply: locale === 'en' ? 'Of course. We have forwarded your request to the SmartCar team. A representative will assist you as soon as possible.' : 'כמובן. העברנו את הפנייה שלכם לצוות SmartCar. נציג יחזור אליכם בהקדם האפשרי.', escalate: true, escalateReason: 'בקשה לדבר עם נציג' };
  if (input === '6') return { handled: true, reply: locale === 'en' ? 'Tell us what happened: accident, flat tyre, or roadside breakdown. If there is immediate danger, contact the emergency services first.' : 'כתבו לנו מה קרה: תאונה, פנצ׳ר או תקלה בדרך. אם קיימת סכנה מיידית, פנו קודם לגורמי החירום.' };
  return { handled: true, reply: menuFor(booking, locale) };
}
