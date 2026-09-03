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
    he: 'אפשר לשכור מגיל 18, גם לפני שנתיים ותק רישיון. הרישיון חייב להיות בתוקף, והזכאות בפועל תלויה בכיסוי הביטוחי ובקבוצת הרכב — התנאים יאושרו לפני ההזמנה.',
    en: 'Rental is available from age 18, including drivers with under two years’ licence experience. The licence must remain valid; actual eligibility depends on the insurance cover and vehicle group, and is confirmed before booking.',
  },
  different_location: {
    topic: 'different_location', href: '/terms', linkLabelHe: 'לתנאי ההשכרה', linkLabelEn: 'Rental terms',
    he: 'אפשר לתאם איסוף והחזרה בסניפים או בכתובות שונות בארץ, כולל שדה התעופה, בכפוף לתיאום מראש ולזמינות. שלחו את שתי הכתובות והתאריכים כדי שנבדוק את המסלול והמחיר הרלוונטי.',
    en: 'Pickup and return can be arranged at branches or different addresses in Israel, including the airport, subject to advance coordination and availability. Send both locations and dates so we can check the route and the relevant price.',
  },
  cancellation: {
    topic: 'cancellation', href: '/terms', linkLabelHe: 'למדיניות הביטול', linkLabelEn: 'Cancellation policy',
    he: 'לפי תנאי ההשכרה: יותר מ־72 שעות לפני האיסוף — החזר מלא; 72–48 שעות — 25% מדמי השכירות הבסיסיים; 48–24 שעות — 50%; פחות מ־24 שעות או אי־הופעה — 100%. שינוי תאריכים ללא חיוב אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות. אם זו הזמנה קיימת, שלחו את מספר ההזמנה ונשמור את ההקשר לנציג.',
    en: 'Under the rental terms: more than 72 hours before pickup — full refund; 72–48 hours — 25% of the base rental fee; 48–24 hours — 50%; under 24 hours or a no-show — 100%. Date changes are free up to 48 hours before pickup, subject to availability. For an existing booking, send the reference and we will retain the context for the representative.',
  },
  availability: {
    topic: 'availability', href: '/terms', linkLabelHe: 'לתנאי הזמינות', linkLabelEn: 'Availability terms',
    he: 'אני מבין כמה זמינות חשובה. אם הקטגוריה שהוזמנה אינה זמינה, SmartCar תציע רכב מקטגוריה גבוהה יותר ללא תוספת תשלום. אם אין רכב זמין כלל, התנאים קובעים החזר מלא של הסכום ששולם, ללא פיצוי נוסף.',
    en: 'I understand availability matters. If the reserved category is unavailable, SmartCar will offer a higher-category vehicle at no extra charge. If no vehicle is available at all, the terms provide a full refund of amounts paid, with no further compensation.',
  },
  damage_accident: {
    topic: 'damage_accident', href: '/terms', linkLabelHe: 'לתנאי נזק ותאונה', linkLabelEn: 'Damage and accident terms',
    he: 'מצטערים שזה קרה. אם יש סכנה או נפגעים, פנו קודם לגורמי החירום. לאחר מכן דווחו ל־SmartCar בתוך שעה ומלאו דוח תאונה; אי־דיווח עלול לבטל כיסוי ביטוחי. נציג מטפל בפנייה עם הפרטים שכבר שיתפתם.',
    en: 'I’m sorry this happened. If anyone is hurt or there is danger, contact emergency services first. Then report it to SmartCar within one hour and complete an accident report; failure to report may void insurance cover. A representative will handle this with the details already shared.',
  },
  opening_hours: {
    topic: 'opening_hours', href: '/contact', linkLabelHe: 'שעות פתיחה באתר', linkLabelEn: 'Opening hours',
    he: 'שעות הפעילות הרגילות שלנו הן ראשון עד חמישי מ-08:00 עד 18:00, ושישי מ-08:00 עד 13:00. נתב"ג פועל 24/7 להזמנות מתואמות מראש.',
    en: 'Our standard operating hours are Sunday to Thursday, 08:00 to 18:00, and Friday from 08:00 to 13:00. Ben Gurion Airport operates 24/7 for pre-coordinated bookings.',
  },
  branches: {
    topic: 'branches', href: '/contact', linkLabelHe: 'לכל הסניפים', linkLabelEn: 'All branches',
    he: 'יש לנו סניפים בפריסה ארצית: נתב"ג (24/7), תל אביב, ירושלים, חיפה ואילת. ניתן לתאם איסוף והחזרה בין סניפים, או הזמנה מיוחדת לכתובת בתיאום מראש.',
    en: 'We have nationwide branches: Ben Gurion Airport (24/7), Tel Aviv, Jerusalem, Haifa, and Eilat. You can coordinate pickup and return between branches, or special delivery to an address in advance.',
  }
};

const TOPIC_PATTERNS: Array<[ServiceKnowledgeTopic, RegExp]> = [
  ['damage_accident', /תאונה|התנגשות|נזק|פגיעה|גניבה|accident|collision|damage|theft/i],
  ['cancellation', /ביטול|לבטל|מדיניות ביטול|cancel|cancellation|refund policy/i],
  ['availability', /לא זמין|אין רכב|זמינות|unavailable|no car|availability/i],
  ['deposit', /פיקדון|כרטיס אשראי|דביט|deposit|security hold|credit card|debit/i],
  ['fuel', /דלק|תדלוק|מלא.?מלא|fuel|refuel|full.?full/i],
  ['mileage', /קילומ|קמ|mileage|kilomet/i],
  ['driver_documents', /נהג נוסף|מסמכים|תעודת זהות|דרכון|additional driver|extra driver|documents?|passport/i],
  ['age_licence', /גיל|ותק רישיון|נהג חדש|רישיון|minimum age|licen[cs]e experience|young driver/i],
  ['different_location', /מקום אחר|החזרה אחרת|איסוף אחר|שדה תעופה|נתבג|one way|different location|airport|drop.?off/i],
  ['insurance', /ביטוח|כיסוי|השתתפות עצמית|insurance|cover(?:age)?|waiver|excess/i],
  ['opening_hours', /מתי פתוח|שעות פתיחה|מתי סוגרים|פתוחים בשבת|מתי עובדים|opening hours|open on|when do you close/i],
  ['branches', /איפה אתם|איפה יש סניפים|באיזו עיר|כתובות|סניפים|סניף שלכם|branches|locations|where are you located/i],
];

export function getSmartCarServiceAnswer(input: string, locale: ServiceLocale): ServiceKnowledgeAnswer | null {
  const match = TOPIC_PATTERNS.find(([, pattern]) => pattern.test(input));
  if (!match) return null;
  const answer = ANSWERS[match[0]];
  return { topic: answer.topic, href: answer.href, reply: answer[locale], linkLabel: locale === 'he' ? answer.linkLabelHe : answer.linkLabelEn };
}

