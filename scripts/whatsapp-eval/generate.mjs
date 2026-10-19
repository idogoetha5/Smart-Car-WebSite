#!/usr/bin/env node
/**
 * Builds the WhatsApp bot question bank (questions.json): thousands of
 * customer messages in the ways people really write them — Hebrew and
 * English, polite and blunt, with and without question marks, with greetings
 * and slang — each with what a correct answer must contain.
 *
 * Every expected fact comes from the published site (terms, insurance, FAQ,
 * branches). Re-run after changing a topic: `node scripts/whatsapp-eval/generate.mjs`.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * expect.any: the reply must contain at least one of these.
 * expect.escalate: true/false when handing to a person is (or is not) required.
 * expect.step: the conversation step after the reply, for booking intents.
 */
const TOPICS = [
  { topic: 'branches', expect: { any: ['הרצליה', 'נתב', 'ירושלים', 'תל אביב', 'הירקון', 'Herzliya'], escalate: false }, he: ['איזה סניפים יש לכם', 'איפה הסניפים שלכם', 'יש לכם סניף בירושלים', 'כמה סניפים יש', 'איפה אתם נמצאים', 'איפה אפשר לאסוף רכב', 'יש לכם סניף בשדה התעופה', 'יש סניף בתל אביב', 'מאיפה אוספים את הרכב', 'איפה המשרד שלכם'], en: ['Which branches do you have', 'Where are you located', 'Do you have a branch at the airport', 'Where can I pick up the car'] },
  { topic: 'herzliya_address', expect: { any: ['רמת ים', 'Ramat Yam'], escalate: false }, he: ['מה הכתובת של הסניף בהרצליה', 'איפה בדיוק הסניף בהרצליה', 'כתובת הרצליה', 'הסניף בהרצליה איפה הוא'], en: ['What is the address of the Herzliya branch'] },
  { topic: 'telaviv_address', expect: { any: ['הירקון', 'HaYarkon'], escalate: false }, he: ['מה הכתובת בתל אביב', 'איפה הסניף בתל אביב', 'כתובת הסניף בת"א'], en: ['Where is your Tel Aviv branch'] },
  { topic: 'phone', expect: { any: ['09-9509757', '099509757'], escalate: false }, he: ['מה מספר הטלפון שלכם', 'איך אפשר להתקשר אליכם', 'יש לכם מספר טלפון', 'למי מתקשרים', 'טלפון של המשרד'], en: ['What is your phone number', 'How can I call you'] },
  { topic: 'email', expect: { any: ['office@smartcar.co.il'], escalate: false }, he: ['מה המייל שלכם', 'לאיזה מייל לשלוח', 'יש לכם כתובת מייל'], en: ['What is your email address'] },
  { topic: 'hours', expect: { any: ['08:00', '18:00', '8:00'], escalate: false }, he: ['מה שעות הפעילות', 'עד מתי אתם פתוחים', 'אתם פתוחים בשישי', 'מתי אתם עובדים', 'מה שעות הפתיחה', 'באיזה שעות המשרד פתוח'], en: ['What are your opening hours', 'Are you open on Friday', 'When are you open'] },
  { topic: 'min_age', expect: { any: ['21'], escalate: false }, he: ['מאיזה גיל אפשר לשכור', 'אני בן 20 אפשר לשכור', 'מה הגיל המינימלי', 'אני בת 22 זה בסדר', 'גיל מינימום לשכירה', 'אפשר לשכור בגיל 19'], en: ['What is the minimum age to rent', 'Can I rent at 20', 'I am 22, can I rent'] },
  { topic: 'new_driver', expect: { any: ['ותק', 'נהג חדש', 'שנתיים', 'new driver', 'experience'], escalate: false }, he: ['אני נהג חדש אפשר לשכור', 'יש לי רישיון רק חצי שנה', 'נהגים חדשים יכולים לשכור', 'אין לי שנתיים ותק', 'קיבלתי רישיון לפני חודש'], en: ['I am a new driver, can I rent', 'I have had my licence for 6 months'] },
  { topic: 'deposit', expect: { any: ['פיקדון', '1,000', '1,500', 'deposit'], escalate: false }, he: ['כמה הפיקדון', 'יש פיקדון', 'מה גובה הפיקדון', 'כמה צריך להשאיר בטחון', 'כמה פיקדון לרכב יוקרה', 'פיקדון לרכב קטן כמה'], en: ['How much is the deposit', 'Is there a deposit'] },
  { topic: 'deposit_refund', expect: { any: ['14'], escalate: false }, he: ['מתי מחזירים את הפיקדון', 'תוך כמה זמן הפיקדון חוזר', 'כמה זמן לוקח להחזיר פיקדון'], en: ['When do I get my deposit back'] },
  { topic: 'debit_card', expect: { any: ['דביט', 'אשראי', 'debit', 'credit'], escalate: false }, he: ['אפשר לשלם בכרטיס דביט', 'צריך כרטיס אשראי', 'אין לי אשראי רק דביט', 'אפשר לשלם במזומן', 'איך משלמים'], en: ['Can I pay with a debit card', 'Do I need a credit card'] },
  { topic: 'insurance', expect: { any: ['ביטוח', 'השתתפות', 'insurance', 'excess'], escalate: false }, he: ['מה כולל הביטוח', 'יש ביטוח ברכב', 'הביטוח כלול במחיר', 'מה ההשתתפות העצמית', 'אפשר לבטל השתתפות עצמית', 'מה קורה אם יש שריטה ויש לי ביטוח'], en: ['What does the insurance include', 'Is insurance included', 'What is the excess'] },
  { topic: 'cancellation', expect: { any: ['72', 'ביטול', 'cancel'], escalate: false }, he: ['מה מדיניות הביטולים', 'אפשר לבטל הזמנה', 'כמה עולה לבטל', 'אם אני מבטל יומיים לפני', 'יש דמי ביטול'], en: ['What is your cancellation policy', 'Can I cancel for free'] },
  { topic: 'date_change', expect: { any: ['48', 'שינוי', 'change'], escalate: false }, he: ['אפשר לשנות תאריכים אחרי שהזמנתי', 'עד מתי אפשר לשנות תאריך', 'שינוי תאריך עולה כסף'], en: ['Can I change the dates later'] },
  { topic: 'fuel', expect: { any: ['מלא', 'דלק', 'full', 'fuel'], escalate: false }, he: ['צריך להחזיר עם מיכל מלא', 'מה עם הדלק', 'מקבלים את הרכב עם דלק', 'אם אני מחזיר בלי דלק מה קורה', 'מדיניות דלק'], en: ['Do I need to return it with a full tank', 'What is the fuel policy'] },
  { topic: 'mileage', expect: { any: ['200', 'ק״מ', 'ק"מ', 'km'], escalate: false }, he: ['כמה קילומטרים כלולים', 'יש הגבלת קילומטרים', 'כמה ק"מ ביום', 'מה הקילומטראז', 'אפשר לנסוע לאילת עם הרכב יש הגבלה'], en: ['How many kilometres are included', 'Is there a mileage limit'] },
  { topic: 'smoking', expect: { any: ['עישון', 'אסור', 'smok'], escalate: false }, he: ['מותר לעשן ברכב', 'אפשר לעשן', 'מה קורה אם עישנתי ברכב'], en: ['Can I smoke in the car'] },
  { topic: 'abroad', expect: { any: ['מחוץ', 'גבול', 'ישראל', 'outside', 'Israel'], escalate: false }, he: ['אפשר לנסוע עם הרכב לירדן', 'מותר לצאת עם הרכב לחו"ל', 'אפשר לנסוע לטאבה', 'אפשר לחצות גבול'], en: ['Can I drive to Jordan', 'Can I take the car abroad'] },
  { topic: 'tourist', expect: { any: ['בינלאומי', 'international'], escalate: false }, he: ['אני תייר מה צריך', 'יש לי רישיון זר אפשר לשכור', 'תייר יכול לשכור רכב'], en: ['I am a tourist, what do I need', 'Can I rent with a foreign licence'] },
  { topic: 'documents', expect: { any: ['רישיון', 'דרכון', 'תעודת זהות', 'licence', 'license', 'passport'], escalate: false }, he: ['אילו מסמכים צריך להביא', 'מה צריך כדי לשכור', 'מה להביא לאיסוף', 'צריך תעודת זהות'], en: ['What documents do I need', 'What should I bring to pickup'] },
  { topic: 'additional_driver', expect: { any: ['נהג נוסף', 'רישיון', 'additional driver', 'licence', 'license'], escalate: false }, he: ['אפשר להוסיף נהג נוסף', 'אשתי יכולה לנהוג גם', 'עוד נהג ברכב אפשר'], en: ['Can I add another driver'] },
  { topic: 'delivery', expect: { any: ['מסירה', 'עד הבית', 'כתובת', 'deliver'], escalate: false }, he: ['אתם מביאים את הרכב עד הבית', 'יש משלוח של רכב', 'אפשר לקבל את הרכב בבית', 'אתם עושים מסירה לנתניה', 'תביאו לי את הרכב לחיפה', 'יש מסירה לבאר שבע'], en: ['Do you deliver the car to my home', 'Can you bring the car to Haifa'] },
  { topic: 'leasing', expect: { any: ['ליסינג', 'leasing'] }, he: ['יש לכם ליסינג', 'אני מחפש ליסינג פרטי', 'כמה עולה ליסינג', 'ליסינג לעסק', 'מה התנאים לליסינג'], en: ['Do you offer leasing', 'I want a private lease'] },
  { topic: 'leasing_terms', expect: { any: ['12', '60', 'חודשים', 'months'], escalate: false }, he: ['לכמה זמן אפשר ליסינג', 'מה תקופת הליסינג המינימלית', 'אפשר ליסינג לשנה'], en: ['What is the minimum leasing period'] },
  { topic: 'cars_for_sale', expect: { any: ['למכירה', 'מכירה', 'for sale', 'sale'] }, he: ['אתם מוכרים רכבים', 'יש רכבים למכירה', 'אני רוצה לקנות רכב'], en: ['Do you sell cars', 'Any cars for sale'] },
  { topic: 'rideshare', expect: { any: ['אסור', 'Uber', 'מונית', 'not allowed', 'prohibited'], escalate: false }, he: ['אפשר לעבוד עם הרכב באובר', 'מותר להשתמש ברכב כמונית', 'אפשר לעבוד בוולט עם הרכב'], en: ['Can I drive for Uber with the rental'] },
  { topic: 'fines', expect: { any: ['דוח', 'קנס', 'שוכר', 'fine'], escalate: false }, he: ['מה קורה עם דוחות חניה', 'קיבלתי דוח מי משלם', 'דוח מהירות ברכב שכור'], en: ['Who pays parking tickets'] },
  { topic: 'unavailable', expect: { any: ['קטגוריה', 'החזר', 'category', 'refund'], escalate: false }, he: ['מה קורה אם אין את הרכב שהזמנתי', 'אם הרכב לא זמין מה עושים'], en: ['What if my car is not available'] },
  { topic: 'experience', expect: { any: ['2003', 'שנים', 'ניסיון'], escalate: false }, he: ['ממתי אתם קיימים', 'כמה זמן אתם בתחום', 'ספרו על החברה'], en: ['How long have you been in business'] },
  { topic: 'small_talk', expect: { escalate: false }, he: ['מה קורה', 'היי', 'שלום', 'מה נשמע', 'אהלן', 'בוקר טוב', 'ערב טוב', 'מה המצב', 'תודה', 'אחלה'], en: ['Hi', 'Hello', 'How are you', 'Thanks'] },
  { topic: 'rental_intent', expect: { any: ['מתי', 'תאריך', 'When', 'date'], escalate: false, step: 'rental_dates' }, he: ['אני צריך רכב', 'רוצה לשכור רכב', 'מחפש רכב להשכרה', 'אפשר להזמין רכב', 'צריך אוטו', 'יש לכם רכב פנוי', 'כמה עולה לשכור רכב'], en: ['I need a car', 'I want to rent a car', 'How much is a rental'] },
  { topic: 'representative', expect: { escalate: true }, he: ['אני רוצה לדבר עם נציג', 'תעבירו אותי לבן אדם', 'אפשר נציג אנושי', 'שמישהו יחזור אליי'], en: ['I want to talk to a person', 'Can someone call me back'] },
  { topic: 'accident', expect: { any: ['חירום', 'בטיחות', 'emergency', 'safety'], escalate: true }, he: ['עשיתי תאונה עם הרכב', 'נכנסו בי ברמזור', 'היה לי תאונה', 'קרתה תאונה'], en: ['I had an accident', 'Someone hit my rental car'] },
  { topic: 'breakdown', expect: { escalate: true }, he: ['יש לי פנצר', 'הרכב לא מניע', 'נתקעתי בדרך', 'הרכב התקלקל'], en: ['I have a flat tyre', 'The car broke down'] },
];

const HE_PREFIXES = ['', 'היי, ', 'שלום, ', 'אחי ', 'סליחה, ', 'רציתי לשאול ', 'תגיד ', 'בוקר טוב, ', 'שאלה: ', 'הי '];
const HE_SUFFIXES = ['', '?', '??', ' בבקשה', ' תודה', ' 🙏', '...'];
const EN_PREFIXES = ['', 'Hi, ', 'Hello, ', 'Quick question: ', 'Hey '];
const EN_SUFFIXES = ['', '?', ' please', ' thanks', '??'];
const PER_TOPIC = 70;

/** Small, deterministic shuffle so the bank is stable between runs. */
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const random = seeded(20261019);
const questions = [];
for (const entry of TOPICS) {
  const variants = new Set();
  for (const base of entry.he) for (const prefix of HE_PREFIXES) for (const suffix of HE_SUFFIXES) variants.add(`${prefix}${base}${suffix}`);
  for (const base of entry.en) for (const prefix of EN_PREFIXES) for (const suffix of EN_SUFFIXES) variants.add(`${prefix}${base}${suffix}`);
  // Small talk and emergencies only make sense without polite decorations stacked on.
  const all = [...variants].sort(() => random() - 0.5);
  const bases = [...entry.he, ...entry.en];
  const picked = [...new Set([...bases, ...all])].slice(0, Math.min(PER_TOPIC, variants.size));
  for (const text of picked) questions.push({ id: `${entry.topic}-${questions.filter((q) => q.topic === entry.topic).length + 1}`, topic: entry.topic, text, expect: entry.expect });
}

writeFileSync(join(here, 'questions.json'), `${JSON.stringify(questions, null, 1)}\n`);
console.log(`Wrote ${questions.length} questions across ${TOPICS.length} topics.`);
