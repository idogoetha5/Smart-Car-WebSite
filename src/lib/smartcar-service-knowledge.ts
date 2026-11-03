/**
 * SmartCar's single approved, bilingual source for deterministic service
 * answers in messaging. Facts are transcribed from the published Terms v2.0
 * (effective 2026-06-01) and Insurance page, not from external rental norms.
 *
 * Cancellation is deliberately canonicalised to the Terms page. The FAQ used
 * to give only general wording; it now links to the same policy so WhatsApp
 * cannot give a competing cancellation answer.
 */
export type ServiceLocale = 'he' | 'en';
export type ServiceKnowledgeTopic =
  | 'insurance' | 'deposit' | 'fuel' | 'mileage' | 'driver_documents'
  | 'age_licence' | 'different_location' | 'cancellation' | 'availability'
  | 'damage_accident' | 'opening_hours' | 'branches';

export type ServiceKnowledgeAnswer = {
  topic: ServiceKnowledgeTopic;
  reply: string;
  href: '/terms' | '/insurance' | '/' | '/contact';
  linkLabel: string;
};

type LocalisedAnswer = Omit<ServiceKnowledgeAnswer, 'reply' | 'linkLabel'> & {
  he: string;
  en: string;
  linkLabelHe: string;
  linkLabelEn: string;
};

export const ANSWERS: Record<ServiceKnowledgeTopic, LocalisedAnswer> = {
  insurance: {
    topic: 'insurance', href: '/insurance', linkLabelHe: 'לפרטי הביטוח', linkLabelEn: 'Insurance details',
    he: 'שאלה חשובה. בכל השכרה כלול כיסוי בסיסי: ביטוח חובה ונזקי תאונה, אש וגניבה בכפוף להשתתפות עצמית. גובה ההשתתפות והאפשרות להפחית או לבטל אותה נקבעים בהצעה ובחוזה; נהג שלא נרשם אינו מכוסה.',
    en: 'Important question. Every rental includes basic cover: compulsory liability plus accident, fire and theft cover, subject to an excess. The excess and any option to reduce or waive it are set in the quote and agreement; an unregistered driver is not covered.',
  },
  deposit: {
    topic: 'deposit', href: '/terms', linkLabelHe: 'לתנאי הפיקדון', linkLabelEn: 'Deposit terms',
    he: 'בשמחה. באיסוף נדרש כרטיס אשראי תקף על שם השוכר; דביט אינו מתקבל. הפיקדון האינדיקטיבי הוא ₪1,000 לכלכלה, ₪1,500 לקומפקטי/סדאן/חשמלי, ₪2,000–₪2,500 ל־SUV/ואן/קבריולט ו־₪3,000 ליוקרה. הוא משתחרר בתוך עד 14 ימי עסקים לאחר ההחזרה אם לא נמצא נזק; נזק, ניקוי, דלק חסר או קנסות עשויים להיגרע. הסכום הסופי מופיע בחוזה.',
    en: 'Of course. Pickup requires a valid credit card in the renter’s name; debit cards are not accepted. Indicative deposits: ₪1,000 economy, ₪1,500 compact/sedan/electric, ₪2,000–₪2,500 SUV/van/convertible, and ₪3,000 luxury. It is released within up to 14 business days after return if no damage is found; damage, cleaning, missing fuel or fines may be deducted. The agreement sets the final amount.',
  },
  fuel: {
    topic: 'fuel', href: '/terms', linkLabelHe: 'לתנאי השימוש', linkLabelEn: 'Rental terms',
    he: 'כן — המדיניות היא מלא־מלא: הרכב נמסר עם מיכל מלא ומוחזר מלא. אם חסר דלק, יחול חיוב לפי מחיר השוק. כדאי לשמור את קבלת התדלוק סמוך להחזרה.',
    en: 'Yes — the policy is full-to-full: the vehicle is handed over full and should be returned full. Missing fuel is charged at market price. Keeping the refuelling receipt near return can help.',
  },
  mileage: {
    topic: 'mileage', href: '/terms', linkLabelHe: 'לתנאי הקילומטראז׳', linkLabelEn: 'Mileage terms',
    he: 'הקילומטראז׳ כלול לפי משך ההשכרה: 1–7 ימים — 200 ק״מ ליום; 8–30 ימים — 220 ק״מ ליום; ומעל 30 ימים — 2,500 ק״מ לכל 30 יום. חריגה מחויבת לפי התעריף בחוזה ההשכרה.',
    en: 'Mileage is included by rental length: 1–7 days — 200 km/day; 8–30 days — 220 km/day; over 30 days — 2,500 km per 30-day period. Excess kilometres are charged at the rate in the rental agreement.',
  },
  driver_documents: {
    topic: 'driver_documents', href: '/insurance', linkLabelHe: 'לרשימת המסמכים', linkLabelEn: 'Document checklist',
    he: 'כדי שהאיסוף יעבור חלק, הביאו תעודת זהות או דרכון, רישיון מקורי בתוקף וכרטיס אשראי על שם השוכר. נהג נוסף חייב להציג רישיון ולהירשם בחוזה לפני הנהיגה; ברישיון זר ייתכן שיידרש גם רישיון בינלאומי או תרגום רשמי.',
    en: 'To keep pickup smooth, bring an ID card or passport, the original valid driving licence, and a credit card in the renter’s name. An additional driver must show a licence and be added to the agreement before driving; a foreign licence may also require an IDP or official translation.',
  },
  age_licence: {
    topic: 'age_licence', href: '/terms', linkLabelHe: 'לתנאי הזכאות', linkLabelEn: 'Eligibility terms',
    he: 'אפשר לשכור מגיל 21, גם לפני שנתיים ותק רישיון. הרישיון חייב להיות בתוקף, והזכאות בפועל תלויה בכיסוי הביטוחי ובקבוצת הרכב — התנאים יאושרו לפני ההזמנה.',
    en: 'Rental is available from age 21, including drivers with under two years’ licence experience. The licence must remain valid; actual eligibility depends on the insurance cover and vehicle group, and is confirmed before booking.',
  },
  different_location: {
    topic: 'different_location', href: '/terms', linkLabelHe: 'לתנאי ההשכרה', linkLabelEn: 'Rental terms',
    he: 'אפשר לתאם איסוף והחזרה בסניפים או בכתובות שונות בארץ, כולל שדה התעופה, בכפוף לתיאום מראש ולזמינות. שלחו את שתי הכתובות והתאריכים כדי שנבדוק את המסלול והמחיר הרלוונטי.',
    en: 'Pickup and return can be arranged at branches or different addresses in Israel, including the airport, subject to advance coordination and availability. Send both locations and dates so we can check the route and the relevant price.',
  },
  cancellation: {
    topic: 'cancellation', href: '/terms', linkLabelHe: 'למדיניות הביטול', linkLabelEn: 'Cancellation policy',
    he: 'לפי תנאי ההשכרה: יותר מ־72 שעות לפני האיסוף — החזר מלא; 72–48 שעות — 25% מדמי השכירות הבסיסיים; 48–24 שעות — 50%; פחות מ־24 שעות או אי־הופעה — 100%. שינוי תאריכים ללא חיוב אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות. אם זו הזמנה קיימת, שלחו את מספר ההזמנה ונשמח לעזור.',
    en: 'Under the rental terms: more than 72 hours before pickup — full refund; 72–48 hours — 25% of the base rental fee; 48–24 hours — 50%; under 24 hours or a no-show — 100%. Date changes are free up to 48 hours before pickup, subject to availability. For an existing booking, send the reference and we will be happy to help.',
  },
  availability: {
    topic: 'availability', href: '/terms', linkLabelHe: 'לתנאי הזמינות', linkLabelEn: 'Availability terms',
    he: 'אני מבין כמה זמינות חשובה. אם הקטגוריה שהוזמנה אינה זמינה, SmartCar תציע רכב מקטגוריה גבוהה יותר ללא תוספת תשלום. אם אין רכב זמין כלל, התנאים קובעים החזר מלא של הסכום ששולם, ללא פיצוי נוסף.',
    en: 'I understand availability matters. If the reserved category is unavailable, SmartCar will offer a higher-category vehicle at no extra charge. If no vehicle is available at all, the terms provide a full refund of amounts paid, with no further compensation.',
  },
  damage_accident: {
    topic: 'damage_accident', href: '/terms', linkLabelHe: 'לתנאי נזק ותאונה', linkLabelEn: 'Damage and accident terms',
    he: 'אם יש סכנה או נפגעים, פנו קודם לגורמי החירום. לאחר מכן דווחו ל־SmartCar בתוך שעה ומלאו דוח תאונה; אי־דיווח עלול לבטל כיסוי ביטוחי. לתיאום טיפול במקרה מסוים התקשרו למשרד.',
    en: 'If anyone is hurt or there is danger, contact emergency services first. Then report it to SmartCar within one hour and complete an accident report; failure to report may void insurance cover. Call the office to arrange help for a specific case.',
  },
  opening_hours: {
    topic: 'opening_hours', href: '/contact', linkLabelHe: 'שעות פתיחה באתר', linkLabelEn: 'Opening hours',
    // Owner-confirmed hours (see branches/page.tsx): Sun–Thu 08:00–18:00, Fridays and holiday eves 08:30–14:00.
    he: 'הסניפים בהרצליה, תל אביב וירושלים פתוחים בימים ראשון עד חמישי בין 08:00 ל־18:00, ובימי שישי וערבי חג בין 08:30 ל־14:00. בשבת הסניפים סגורים. בנתב"ג פועל שירות מסירה 24/7 בתיאום מראש.',
    en: 'Our Herzliya, Tel Aviv and Jerusalem branches are open Sunday to Thursday, 08:00–18:00, and on Fridays and holiday eves 08:30–14:00. Branches are closed on Saturday. Ben Gurion Airport delivery runs 24/7 by prior arrangement.',
  },
  branches: {
    topic: 'branches', href: '/contact', linkLabelHe: 'לכל הסניפים', linkLabelEn: 'All branches',
    // Must match src/lib/branches.ts (owner-confirmed). There is no branch in Haifa or Eilat; those areas are served by delivery.
    he: 'הסניפים שלנו: הרצליה (רמת ים 122), תל אביב (הירקון 112), ירושלים (המלך דוד 8), ושירות מסירה בנתב"ג 24/7. אפשר לאסוף ולהחזיר בסניפים שונים, או לתאם מסירה והחזרה בכתובת בכל הארץ בתיאום מראש.',
    en: 'Our branches: Herzliya (Ramat Yam 122), Tel Aviv (HaYarkon 112), Jerusalem (King David 8), and 24/7 delivery at Ben Gurion Airport. You can pick up and return at different branches, or arrange delivery and collection at an address anywhere in Israel in advance.',
  }
};

export type SmartCarApprovedFact = { id: string; text: string };

/** Trusted static knowledge for model phrasing; contains no customer data,
 * live inventory, personal price or authority to perform an action. */
export function getSmartCarApprovedFacts(locale: ServiceLocale): SmartCarApprovedFact[] {
  return [
    ...Object.values(ANSWERS).map(answer => ({ id: answer.topic, text: answer[locale] })),
    { id: 'rental_extension', text: locale === 'he'
      ? 'הארכת השכרה דורשת בדיקת זמינות ואישור מפורש של SmartCar לפני מועד ההחזרה הקיים. עד לאישור, מועד ההחזרה המקורי נשאר בתוקף; אין להניח שמותר להמשיך להחזיק ברכב מעבר לו. המחיר לימים הנוספים עשוי להשתנות ואינו מובטח כמחיר היומי המקורי. אפשר להסביר זאת גם אם מספר ההזמנה עדיין אינו זמין; שיחת בירור אינה אישור הארכה.'
      : 'A rental extension requires an availability check and explicit SmartCar confirmation before the existing return deadline. Until confirmed, the original agreed return deadline remains binding; do not assume permission to keep the car beyond it. Extra days may have a different rate; the original daily price is not guaranteed. These conditions can be explained even when the booking reference is not handy. An advisory discussion is not extension approval.' },
    { id: 'request_boundary', text: locale === 'he'
      ? 'בקשת השכרה דורשת תאריכי איסוף והחזרה, מיקומים, צרכי רכב, קבוצת גיל נהג 21–23 או 24+, שם ומספר WhatsApp שמגיע מהשיחה. מייל אינו חובה. הבקשה, המחיר והרכב מחייבים אישור SmartCar; אין לאשר בשיחה הזמנה, שינוי, ביטול או זיכוי.'
      : 'A rental request needs pickup and return dates, locations, vehicle needs, driver age group 21–23 or 24+, a name and the WhatsApp number supplied by the channel. Email is optional. The request, price and vehicle require SmartCar confirmation; never approve a booking, change, cancellation or refund in chat.' },
    { id: 'vehicle_comparison', text: locale === 'he'
      ? 'קומפקטי הוא כיוון להשוואה כשחשובים גודל וחניה בעיר. משפחתית מציעה בדרך כלל יותר מקום לנוסעים ולציוד. התאמה לכיסא בטיחות, עגלה ומזוודות תלויה בדגם המסוים ובמידות הציוד; אין להבטיח התאמה. שאלה או השוואה אינן בחירה ברכב.'
      : 'A compact is a starting point to compare when city size and parking matter. A family car generally offers more passenger and luggage room. Child-seat, stroller and luggage fit depend on the actual model and equipment dimensions; do not promise fit. A question or comparison is not a vehicle selection.' },
    { id: 'commercial_enquiry', text: locale === 'he'
      ? 'ליסינג ומכירה: אפשר לברר צרכים, שימוש, העדפת רכב ותקציב. בליסינג מבררים גם תקופה וקילומטראז׳ שנתי. 24 חודשים הם תקופה קצרה יותר מ־36; להשוואת הצעות בודקים אותו רכב וקילומטראז׳, עלות כוללת, תשלומים ראשוניים וסופיים, מגבלת קילומטרים, חריגה ותנאי יציאה. ביטוח וטיפולים כלולים רק אם נכתב בהצעה ובחוזה. אין מחיר אישי, מלאי או אישור עסקה מאומתים במידע זה. הייעוץ כללי ולא המלצה פיננסית אישית.'
      : 'Leasing and sale enquiries can explore needs, use, vehicle preference and budget. Leasing also needs a term and annual mileage. 24 months is shorter than 36; compare offers for the same car and mileage, total cost, initial and final payments, mileage limits, excess charges and exit terms. Insurance and maintenance are included only if stated in the offer and contract. These facts contain no verified personal price, inventory or deal approval. Advice is general, not personalised financial advice.' },
  ].map(fact => ({ id: fact.id, text: fact.text.slice(0, 1000) }));
}

const TOPIC_PATTERNS: Array<[ServiceKnowledgeTopic, RegExp]> = [
  ['damage_accident', /תאונה|התנגשות|נזק|פגיעה|גניבה|accident|collision|damage|theft/i],
  ['cancellation', /ביטול|לבטל|מבטל|מבוטל|מדיניות ביטול|cancel|cancellation|refund policy/i],
  ['availability', /לא זמין|אין רכב|זמינות|unavailable|no car|availability/i],
  ['deposit', /פיקדון|כרטיס אשראי|דביט|deposit|security hold|credit card|debit/i],
  ['fuel', /דלק|תדלוק|מלא.?מלא|fuel|refuel|full.?full/i],
  ['mileage', /קילומ|קמ|mileage|kilomet/i],
  ['driver_documents', /נהג נוסף|מסמכים|תעודת זהות|דרכון|רישיון זר|רישיון בינלאומי|foreign licen[cs]e|international driving permit|additional driver|extra driver|another driver|second driver|documents?|passport/i],
  ['age_licence', /גיל|בן\s*\d{2}|בת\s*\d{2}|ותק רישיון|נהג חדש|רישיון|minimum age|licen[cs]e experience|young driver/i],
  ['different_location', /מקום אחר|החזרה אחרת|איסוף אחר|שדה תעופה|נתב.?ג|one way|different location|airport|drop.?off/i],
  ['insurance', /ביטוח|כיסוי|השתתפות עצמית|insurance|cover(?:age)?|waiver|excess/i],
  ['opening_hours', /מתי (?:אתם )?פתוח|שעות ה?פתיחה|שעות ה?פעילות|באיזה שעות|עד איזה שעה|עד איזו שעה|מתי נפתחים|מתי סוגרים|פתוחים|עד מתי אתם|מתי עובדים|opening hours|open on|when do you close|when are you open/i],
  ['branches', /איפה אתם|איפה יש סניפים|באיזו עיר|כתובות|סניפים|סניף שלכם|מאיפה אפשר לאסוף|איפה אפשר לאסוף|where can (?:i|we) pick up|branches|locations|where are you located/i],
];

export function getSmartCarServiceAnswer(input: string, locale: ServiceLocale): ServiceKnowledgeAnswer | null {
  if (/להוסיף.{0,12}נהג|לצרף.{0,12}נהג|נהג.{0,10}נוסף|add (?:an? )?(?:additional|extra|second|another) driver/i.test(input)
      && /אפשר|יכול|ניתן|can|could|possible/i.test(input)
      && !/מסמכים|documents?|מה צריך|what.*need/i.test(input)) {
    return {
      topic: 'driver_documents', href: '/insurance',
      linkLabel: locale === 'he' ? 'לפרטי הנהגים' : 'Driver details',
      reply: locale === 'he'
        ? 'אפשר לבקש לצרף נהג נוסף להשכרה. עליו להציג רישיון נהיגה בתוקף ולהירשם בחוזה לפני שינהג; ההתאמה והתנאים יאושרו עם פרטי ההשכרה.'
        : 'You can ask to add another driver to the rental. They must show a valid licence and be named in the agreement before driving; eligibility and terms are confirmed with the rental details.',
    };
  }
  const match = TOPIC_PATTERNS.find(([, pattern]) => pattern.test(input));
  if (!match) return null;
  const answer = ANSWERS[match[0]];
  return { topic: answer.topic, href: answer.href, reply: answer[locale], linkLabel: locale === 'he' ? answer.linkLabelHe : answer.linkLabelEn };
}

