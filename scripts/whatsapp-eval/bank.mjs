import { readFileSync } from 'node:fs';
/**
 * The large WhatsApp test bank: 100,000 customer messages and a set of full
 * rental conversations, built deterministically (same output on every run).
 *
 * Each message has a category and the behaviour the bot must show even when
 * Gemini is unavailable:
 *   escalate: true  → must reach a person (emergency, complaint, explicit ask)
 *   escalate: false → must NOT be handed off (questions, small talk, rentals)
 *   step            → the conversation must move into that step
 *   startsRental    → the reply must start a rental (any rental_* step)
 * Every message must also get a non-empty reply that never says it did not
 * understand.
 *
 * Variation layers: greetings, endings, slang, emoji, punctuation, Hebrew
 * spelling mistakes (letter swaps, missing/doubled letters, similar-sounding
 * letters, wrong final forms, missing spaces), English typos and mixed
 * Hebrew-English.
 */

/** Small seeded generator so the bank never changes between runs. */
export function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

// ---------------------------------------------------------------------------
// Base messages per category

const INFO = {
  branches: ['איזה סניפים יש לכם', 'איפה הסניפים שלכם', 'יש לכם סניף בירושלים', 'יש סניף בתל אביב', 'יש לכם סניף בנתבג', 'כמה סניפים יש לכם', 'איפה אתם נמצאים', 'מאיפה אוספים את הרכב', 'מה הכתובת של הסניף בהרצליה', 'איפה הסניף בירושלים', 'יש לכם סניף בחיפה', 'יש לכם סניף באילת', 'יש סניף ליד רעננה', 'Where are your branches', 'Do you have a branch in Jerusalem'],
  contact: ['מה מספר הטלפון שלכם', 'איך אפשר להתקשר אליכם', 'מה המייל שלכם', 'לאיזה מייל לשלוח מסמכים', 'יש לכם טלפון', 'אפשר מספר של המשרד', 'איך יוצרים איתכם קשר', 'What is your phone number', 'How do I contact you'],
  hours: ['מה שעות הפעילות', 'עד מתי אתם פתוחים היום', 'אתם פתוחים בשישי', 'אתם עובדים בשבת', 'מתי המשרד פתוח', 'באיזה שעה אתם נפתחים', 'אתם פתוחים בחג', 'What are your opening hours', 'Are you open on Saturday'],
  age: ['מאיזה גיל אפשר לשכור', 'אני בן 20 אפשר לשכור', 'אני בת 19 זה אפשרי', 'מה הגיל המינימלי', 'יש הגבלת גיל', 'גיל 21 זה בסדר', 'אני בן 75 אפשר לשכור', 'Minimum age to rent', 'I am 20 can I rent'],
  new_driver: ['אני נהג חדש אפשר לשכור', 'יש לי רישיון חצי שנה', 'קיבלתי רישיון לפני חודש', 'אין לי שנתיים ותק', 'נהג צעיר יכול לשכור', 'נהגת חדשה זה בעיה', 'I just got my license can I rent'],
  deposit: ['כמה הפיקדון', 'יש פיקדון', 'מה גובה הפיקדון', 'כמה בטחון צריך להשאיר', 'כמה פיקדון לרכב יוקרה', 'כמה פיקדון לרכב קטן', 'מתי מחזירים את הפיקדון', 'תוך כמה זמן הפיקדון חוזר', 'How much is the deposit', 'When do I get the deposit back'],
  payment: ['אפשר לשלם בדביט', 'אפשר לשלם במזומן', 'צריך כרטיס אשראי', 'אין לי אשראי רק דביט', 'איך משלמים', 'אפשר לשלם בביט', 'אפשר תשלומים', 'מתי משלמים', 'Can I pay cash', 'Do you take debit cards'],
  insurance: ['מה כולל הביטוח', 'יש ביטוח ברכב', 'הביטוח כלול במחיר', 'מה ההשתתפות העצמית', 'אפשר לבטל השתתפות עצמית', 'כמה עולה הורדת השתתפות', 'מה קורה אם יש שריטה ויש לי ביטוח', 'ביטוח מקיף או צד ג', 'Is insurance included', 'What is the excess'],
  cancellation: ['מה מדיניות הביטולים', 'אפשר לבטל הזמנה', 'כמה עולה לבטל', 'אם אני מבטל יומיים לפני מה קורה', 'יש דמי ביטול', 'עד מתי אפשר לבטל בחינם', 'אפשר לשנות תאריכים אחרי שהזמנתי', 'עד מתי אפשר לשנות תאריך', 'Can I cancel for free', 'Can I change the dates'],
  fuel: ['צריך להחזיר עם מיכל מלא', 'מה עם הדלק', 'הרכב מגיע עם דלק', 'אם אני מחזיר בלי דלק מה קורה', 'מה מדיניות הדלק', 'Do I return it with a full tank'],
  mileage: ['כמה קילומטרים כלולים', 'יש הגבלת קילומטרים', 'כמה קמ ביום', 'מה הקילומטראז', 'אפשר לנסוע לאילת עם הרכב', 'כמה עולה קילומטר נוסף', 'Is there a mileage limit'],
  rules: ['מותר לעשן ברכב', 'אפשר לעשן', 'אפשר להכניס כלב לרכב', 'מותר לנסוע לירדן', 'אפשר לנסוע לטאבה', 'אפשר לעבוד עם הרכב באובר', 'אפשר לעבוד בוולט', 'מותר לגרור עגלה', 'אפשר לנסוע ליהודה ושומרון', 'Can I smoke in the car', 'Can I drive to Jordan'],
  documents: ['אילו מסמכים צריך', 'מה צריך להביא לאיסוף', 'צריך תעודת זהות', 'צריך דרכון', 'אני תייר מה צריך', 'יש לי רישיון זר', 'רישיון בינלאומי צריך', 'אפשר להוסיף נהג נוסף', 'אשתי יכולה לנהוג גם', 'What documents do I need', 'I am a tourist what do I need'],
  delivery: ['אתם מביאים את הרכב עד הבית', 'יש משלוח של רכב', 'אפשר לקבל את הרכב בבית', 'אתם עושים מסירה לנתניה', 'תביאו לי את הרכב לחיפה', 'יש מסירה לבאר שבע', 'אפשר להחזיר את הרכב בשדה התעופה', 'אפשר לאסוף בתל אביב ולהחזיר בירושלים', 'Do you deliver to my home'],
  leasing: ['יש לכם ליסינג', 'אני מחפש ליסינג פרטי', 'כמה עולה ליסינג', 'ליסינג לעסק', 'לכמה זמן ליסינג', 'מה תקופת הליסינג המינימלית', 'Do you offer leasing'],
  sales: ['אתם מוכרים רכבים', 'יש רכבים למכירה', 'אני רוצה לקנות רכב', 'Do you sell cars'],
  fines: ['מה קורה עם דוחות חניה', 'קיבלתי דוח מי משלם', 'דוח מהירות ברכב שכור', 'Who pays parking tickets'],
  fleet: ['איזה רכבים יש לכם', 'יש לכם רכב חשמלי', 'יש רכב אוטומטי', 'יש לכם 7 מקומות', 'יש לכם ואן', 'יש רכב יוקרה', 'יש לכם טסלה', 'יש כיסא תינוק', 'יש GPS ברכב', 'Do you have electric cars'],
  company: ['ממתי אתם קיימים', 'ספרו על החברה', 'אתם חברה אמינה', 'יש לכם ביקורות'],
};

const SMALL_TALK = ['מה קורה', 'היי', 'שלום', 'מה נשמע', 'אהלן', 'בוקר טוב', 'ערב טוב', 'מה המצב', 'תודה', 'תודה רבה', 'סבבה', 'אחלה', 'מעולה', 'אוקיי', 'אוקי', 'בסדר', 'יופי', 'הבנתי', 'כן', 'לא', 'אולי', 'רגע', 'שנייה', '👍', '🙏', '😊', 'חח', 'חחחח', 'לילה טוב', 'שבוע טוב', 'שבת שלום', 'Hi', 'Hello', 'Thanks', 'Ok', 'Thank you', 'Good morning'];

const RENTAL = ['אני צריך רכב', 'רוצה לשכור רכב', 'מחפש רכב להשכרה', 'אפשר להזמין רכב', 'צריך אוטו', 'יש לכם רכב פנוי', 'צריך רכב למחר', 'צריך רכב לסופש', 'צריך רכב לשבוע', 'צריך רכב לחודש', 'רוצה להזמין רכב מהרצליה', 'צריך רכב משפחתי', 'אני רוצה ג׳יפ', 'אני צריך רכב ל6 אנשים', 'צריך רכב מנתבג', 'צריך רכב מ10/12 עד 15/12', 'אני רוצה לשכור רכב מחר עד יום שישי', 'צריך רכב קטן וזול', 'רוצה רכב יוקרה לחתונה', 'I need a car', 'I want to rent a car tomorrow', 'Need a car from the airport', 'Looking for an SUV next week'];

const EMERGENCY = ['עשיתי תאונה', 'היה לי תאונה עם הרכב', 'נכנסו בי ברמזור', 'קרתה תאונה', 'התנגשתי ברכב אחר', 'דפקו לי את הרכב', 'יש לי פנצר', 'יש לי תקר', 'הרכב לא מניע', 'הרכב לא נדלק', 'נתקעתי בדרך', 'הרכב התקלקל', 'נדלקה נורה אדומה', 'יוצא עשן מהמנוע', 'המצבר מת', 'ננעלתי מחוץ לרכב', 'איבדתי את המפתח', 'פגעו בי וברחו', 'I had an accident', 'I have a flat tyre', 'The car broke down', 'The car will not start'];

const COMPLAINTS = ['חייבתם אותי פעמיים', 'קיבלתי חיוב שלא הסכמתי לו', 'אני רוצה החזר כספי', 'השירות שלכם גרוע', 'אני רוצה להגיש תלונה', 'הנציג לא חזר אליי', 'אף אחד לא עונה לי', 'אני מחכה כבר שעה לרכב', 'הרכב הגיע מלוכלך', 'הרכב שקיבלתי לא תקין', 'חייבו אותי על נזק שלא עשיתי', 'אני כועס מאוד', 'זה לא בסדר מה שעשיתם', 'אני אתבע אתכם', 'You charged me twice', 'I want a refund', 'Terrible service'];

const PERSON = ['אני רוצה לדבר עם נציג', 'תעבירו אותי לנציג', 'אפשר נציג אנושי', 'שמישהו יחזור אליי', 'תתקשרו אליי בבקשה', 'אני רוצה לדבר עם בן אדם', 'אפשר מנהל', 'I want to talk to a person', 'Call me back please'];

const EXISTING = ['יש לי הזמנה', 'אני רוצה לבדוק את ההזמנה שלי', 'מה הסטטוס של ההזמנה', 'כבר הזמנתי אצלכם', 'מספר ההזמנה שלי 12345', 'I have a booking', 'What is my booking status'];

const OFF_TOPIC = ['כמה זה 2 ועוד 2', 'תכתוב לי שיר', 'מה מזג האוויר', 'מי ניצח במשחק', 'אתה בוט', 'אתה רובוט או בן אדם', 'מה השם שלך', 'asdfgh', 'ללללל', '???', '...', 'בדיקה', 'test', 'akuo', 'ma kore', 'ani tzarich rechev'];

// ---------------------------------------------------------------------------
// Variation layers

const HE_PREFIXES = ['', '', '', 'היי ', 'היי, ', 'שלום ', 'שלום, ', 'אחי ', 'אחי, ', 'סליחה ', 'רציתי לשאול ', 'תגיד ', 'תגידי ', 'בוקר טוב ', 'ערב טוב ', 'שאלה: ', 'הי ', 'יו ', 'אהלן ', 'מה קורה, ', 'שלום רב, ', 'בבקשה ', 'דחוף ', 'רק שאלה ', 'מישהו יודע '];
const HE_SUFFIXES = ['', '', '', '?', '??', '???', '!', '!!', ' בבקשה', ' תודה', ' תודה רבה', ' 🙏', ' 😊', '...', ' דחוף', ' אחי', ' ?', ' בבקשה?', ' תודה!', ' 👍'];
const EN_PREFIXES = ['', '', 'Hi ', 'Hi, ', 'Hello ', 'Hey ', 'Quick question: ', 'Excuse me, ', 'Please '];
const EN_SUFFIXES = ['', '', '?', '??', ' please', ' thanks', '!', ' thx', ' pls'];

const SOUND_ALIKE = [['א', 'ע'], ['ע', 'א'], ['ט', 'ת'], ['ת', 'ט'], ['כ', 'ח'], ['ח', 'כ'], ['ס', 'ש'], ['ש', 'ס'], ['ק', 'כ'], ['כ', 'ק'], ['ו', 'ב'], ['ב', 'ו'], ['י', ''], ['ו', '']];
const FINALS = [['ם', 'מ'], ['ן', 'נ'], ['ץ', 'צ'], ['ף', 'פ'], ['ך', 'כ']];
const EN_TYPOS = [['ie', 'ei'], ['a', 'e'], ['o', 'u'], ['th', 't'], ['ck', 'k'], ['ll', 'l'], ['ss', 's']];

// Phone keyboards: the Israeli layout (the iPhone Hebrew keyboard follows it) and QWERTY.
const HE_ROWS = ['/\'קראטוןםפ', 'שדגכעיחלךף', 'זסבהנמצתץ'];
const EN_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,.'];
const HE_TO_EN = {};
HE_ROWS.forEach((row, r) => [...row].forEach((key, c) => { if (/[א-ת]/.test(key)) HE_TO_EN[key] = EN_ROWS[r][c]; }));
const NEAR_KEYS = {};
for (const rows of [HE_ROWS, EN_ROWS]) rows.forEach((row, r) => [...row].forEach((key, c) => {
  NEAR_KEYS[key] = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, -1]].map(([dr, dc]) => rows[r + dr]?.[c + dc]).filter((k) => k && /[א-תa-z]/.test(k));
}));

/** A finger landing on the key next door. */
function fatFinger(text, random) {
  const spots = [...text].map((ch, i) => ({ ch, i })).filter(({ ch }) => NEAR_KEYS[ch.toLowerCase()]?.length);
  if (!spots.length) return text;
  const { ch, i } = pick(random, spots);
  const chars = [...text];
  chars[i] = pick(random, NEAR_KEYS[ch.toLowerCase()]);
  return chars.join('');
}

/** The whole message typed with the keyboard still in English ("צריך רכב" → "mrhl rfc"). */
export function wrongLayout(text) {
  return [...text].map((ch) => HE_TO_EN[ch] ?? ch).join('');
}

function letters(text) {
  return [...text].map((char, index) => ({ char, index })).filter(({ char }) => /[א-תA-Za-z]/.test(char));
}

function typo(text, random) {
  const kind = Math.floor(random() * 12);
  const chars = [...text];
  const spots = letters(text);
  if (!spots.length) return text;
  const at = pick(random, spots).index;
  switch (kind) {
    case 0: // swap two neighbours
      if (at + 1 < chars.length && /\S/.test(chars[at + 1])) [chars[at], chars[at + 1]] = [chars[at + 1], chars[at]];
      return chars.join('');
    case 1: // drop a letter
      chars.splice(at, 1);
      return chars.join('');
    case 2: // double a letter
      chars.splice(at, 0, chars[at]);
      return chars.join('');
    case 3: { // similar-sounding Hebrew letter
      const [from, to] = pick(random, SOUND_ALIKE);
      const i = text.indexOf(from);
      return i < 0 ? text : text.slice(0, i) + to + text.slice(i + 1);
    }
    case 4: { // wrong final form
      const [final, regular] = pick(random, FINALS);
      return text.replaceAll(final, regular);
    }
    case 5: // missing space
      return text.replace(' ', '');
    case 6: // extra spaces
      return text.replace(' ', '   ');
    case 7: { // English typo
      const [from, to] = pick(random, EN_TYPOS);
      return text.replace(from, to);
    }
    case 9: // neighbouring key
    case 10:
      return fatFinger(text, random);
    default: // no punctuation, lower case
      return text.replace(/[?!.,]/g, '').toLowerCase();
  }
}

function decorate(base, random) {
  const english = /^[A-Za-z]/.test(base);
  let text = english
    ? `${pick(random, EN_PREFIXES)}${random() < 0.3 ? base.toLowerCase() : base}${pick(random, EN_SUFFIXES)}`
    : `${pick(random, HE_PREFIXES)}${base}${pick(random, HE_SUFFIXES)}`;
  const typos = random() < 0.45 ? Math.floor(random() * 3) + 1 : 0;
  for (let i = 0; i < typos; i += 1) text = typo(text, random);
  return text.trim() || base;
}

// Emergencies and complaints carry the words the bot must notice, so their
// spelling mistakes are limited to the ones a hurried customer makes most.
function lightDecorate(base, random) {
  const english = /^[A-Za-z]/.test(base);
  let text = english ? `${pick(random, EN_PREFIXES)}${base}${pick(random, ['', '!', '!!', ' help', ' please'])}` : `${pick(random, ['', '', 'היי ', 'דחוף ', 'הצילו ', 'שלום '])}${base}${pick(random, ['', '!', '!!', ' דחוף', ' מה עושים', ' עזרה', '?'])}`;
  if (random() < 0.3) text = typo(text, random);
  return text;
}

const BASE_CATEGORIES = [
  { name: 'info', weight: 40, bases: Object.entries(INFO).filter(([topic]) => topic !== 'leasing' && topic !== 'sales').flatMap(([topic, list]) => list.map((text) => ({ text, topic }))), expect: { escalate: false }, vary: decorate },
  // Leasing and car purchases may go to a representative by design.
  { name: 'commercial', weight: 6, bases: [...INFO.leasing, ...INFO.sales].map((text) => ({ text, topic: 'commercial' })), expect: {}, vary: decorate },
  { name: 'small_talk', weight: 8, bases: SMALL_TALK.map((text) => ({ text })), expect: { escalate: false }, vary: decorate },
  { name: 'rental', weight: 16, bases: RENTAL.map((text) => ({ text })), expect: { escalate: false, startsRental: true }, vary: decorate },
  { name: 'emergency', weight: 9, bases: EMERGENCY.map((text) => ({ text })), expect: { escalate: true }, vary: lightDecorate },
  { name: 'complaint', weight: 8, bases: COMPLAINTS.map((text) => ({ text })), expect: { escalate: true }, vary: lightDecorate },
  { name: 'person', weight: 5, bases: PERSON.map((text) => ({ text })), expect: { escalate: true }, vary: lightDecorate },
  { name: 'existing_booking', weight: 4, bases: EXISTING.map((text) => ({ text })), expect: {}, vary: decorate },
  { name: 'off_topic', weight: 4, bases: OFF_TOPIC.map((text) => ({ text })), expect: { escalate: false }, vary: decorate },
];

// ---------------------------------------------------------------------------
// Large phrase lists (scripts/whatsapp-eval/lexicon/*.json) extend the bases.

function lexicon(name) {
  try {
    return JSON.parse(readFileSync(new URL(`./lexicon/${name}.json`, import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

const listOf = (entry, languages = ['he', 'en', 'translit']) => languages.flatMap((language) => (entry?.[language] ?? []).map((text) => ({ text, language, source: 'lexicon' })));

function withLexicons(categories) {
  const byName = new Map(categories.map((c) => [c.name, { ...c, bases: [...c.bases] }]));
  const add = (name, bases) => {
    const category = byName.get(name);
    const seen = new Set(category.bases.map((b) => b.text));
    for (const base of bases) if (base.text && !seen.has(base.text)) { seen.add(base.text); category.bases.push(base); }
  };
  const rental = lexicon('rental');
  if (rental) add('rental', [...listOf(rental.rental_request), ...listOf(rental.rental_with_details)]);
  const questions = lexicon('questions');
  if (questions) {
    for (const [topic, entry] of Object.entries(questions)) {
      const bases = listOf(entry).map((b) => ({ ...b, topic }));
      add(['leasing', 'cars_for_sale'].includes(topic) ? 'commercial' : 'info', bases);
    }
  }
  const urgent = lexicon('urgent');
  if (urgent) {
    add('emergency', [...listOf(urgent.accident), ...listOf(urgent.breakdown)]);
    add('complaint', listOf(urgent.complaint));
    add('person', listOf(urgent.person));
    add('existing_booking', listOf(urgent.existing_booking));
  }
  const language = lexicon('language');
  if (language) {
    add('small_talk', [...listOf(language.small_talk), ...listOf(language.acknowledgements)]);
    add('off_topic', listOf(language.off_topic));
  }
  return [...byName.values()];
}

export const CATEGORIES = withLexicons(BASE_CATEGORIES);

/** How a base message is turned into one variant, and the label used in reports. */
function variant(category, base, round, random) {
  if (round === 0) return { text: base.text, variant: 'clean' };
  const hebrew = /[א-ת]/.test(base.text);
  // Typed with the keyboard left in English, for Hebrew messages (not for emergencies: those must read as written).
  if (hebrew && random() < 0.05) return { text: wrongLayout(category.vary === lightDecorate ? base.text : decorate(base.text, random)), variant: 'layout' };
  return { text: category.vary(base.text, random), variant: 'typo' };
}

/**
 * Messages one at a time, so millions can be checked without holding them in
 * memory. Every base message appears once as written before any variant.
 */
export function* iterateBank(count = 100_000, seed = 20261019) {
  const random = seeded(seed);
  const total = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
  const counters = new Map(CATEGORIES.map((c) => [c.name, 0]));
  let produced = 0;
  // Interleave categories by weight so any prefix of the bank is balanced.
  const schedule = CATEGORIES.flatMap((c) => Array.from({ length: c.weight }, () => c));
  while (produced < count) {
    for (const category of schedule) {
      if (produced >= count) return;
      const i = counters.get(category.name);
      counters.set(category.name, i + 1);
      const base = category.bases[i % category.bases.length];
      const round = Math.floor(i / category.bases.length);
      const { text, variant: kind } = variant(category, base, round, random);
      produced += 1;
      yield { id: `${category.name}-${i + 1}`, category: category.name, topic: base.topic, source: base.source ?? 'core', language: base.language ?? (/[א-ת]/.test(base.text) ? 'he' : 'en'), base: base.text, text: text.trim() || base.text, variant: kind, expect: category.expect };
    }
  }
  void total;
}

/** `count` single messages (default 100,000). */
export function buildBank(count = 100_000, seed = 20261019) {
  return [...iterateBank(count, seed)];
}

// ---------------------------------------------------------------------------
// Full rental conversations: the same facts given in different orders, in
// one message or several, with spelling mistakes, side questions and changes
// of mind. Each must end at the confirmation step with every fact kept.

const DATE_PAIRS = [
  ['10/12/2026', '15/12/2026'], ['3.1.27', '7.1.27'], ['20 בדצמבר', '24 בדצמבר'], ['5 בינואר', '9 בינואר'], ['1/2/27', '8/2/27'],
  ['12 בנובמבר', '19 בנובמבר'], ['7/3/2027', '10/3/2027'], ['15 במרץ', '18 במרץ'], ['December 20', 'December 27'], ['2.4.27', '6.4.27'],
];
const DATE_TEMPLATES = ['מ{from} עד {to}', 'מה-{from} ועד ה-{to}', '{from} עד {to}', 'איסוף ב{from} והחזרה ב{to}', 'מתאריך {from} עד תאריך {to}', 'בין {from} ל{to}'];
const EN_DATE_TEMPLATES = ['from {from} to {to}', '{from} until {to}', 'pick up {from}, return {to}'];
const PLACES = [['הרצליה', 'נתבג'], ['תל אביב', 'תל אביב'], ['ירושלים', 'הרצליה'], ['נתב״ג', 'ירושלים'], ['הרצליה', 'הרצליה'], ['תל אביב', 'נתב"ג'], ['ירושלים', 'ירושלים']];
const PLACE_TEMPLATES = ['איסוף ב{a} והחזרה ב{b}', 'לאסוף מ{a} ולהחזיר ב{b}', 'איסוף מ{a}, החזרה ל{b}', 'איסוף {a} החזרה {b}'];
const CARS = [
  ['רכב משפחתי', 'SEDAN'], ['ג׳יפ', 'SUV'], ['משהו קטן וחסכוני', 'ECONOMY_COMPACT'], ['7 מקומות', 'VAN'], ['רכב יוקרה', 'LUXURY'],
  ['רכב קטן', 'ECONOMY_COMPACT'], ['SUV', 'SUV'], ['רכב ל-7 אנשים', 'VAN'], ['family car', 'SEDAN'], ['קרוסאובר', 'SUV'],
];
const NAMES = ['ישראל ישראלי', 'דנה כהן', 'John Smith', 'מוחמד חסן', 'אבי לוי', 'Sarah Miller', 'יוסי בן דוד', 'נועה פרץ'];
const OPENERS = ['אני צריך רכב', 'רוצה לשכור רכב', 'היי צריך אוטו', '1', 'שלום, אפשר להזמין רכב?', 'אחי צריך אוטו', 'יש לכם רכב פנוי?', 'I need a car', 'בא לי לשכור רכב', 'צריכה רכב בבקשה', 'ani tzarich rechev', 'mrhl rfc'];
const SIDE_QUESTIONS = ['רגע, כמה הפיקדון?', 'יש ביטוח?', 'מה שעות הפעילות?', 'תודה', 'סבבה', 'אוקיי', 'מאיזה גיל אפשר?', 'יש לכם סניף בירושלים?', 'מה הכתובת בהרצליה?', 'צריך כרטיס אשראי?', 'אפשר להוסיף נהג נוסף?', 'מעולה תודה', '👍'];
const CONFIRMATIONS = ['אני מאשר', 'אני מאשרת', 'מאשר', 'מאשרת', 'כן אני מאשר', 'I confirm', 'מאשר את התנאים', 'אני מסכים'];

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key]);

/** A light slip that keeps the fact readable (never inside a date or a name). */
function slip(text, random) {
  if (random() > 0.35) return text;
  return text.replace(/[א-ת]{4,}|[a-z]{5,}/i, (word) => {
    if (/(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|december)/i.test(word)) return word;
    return typo(word, random);
  });
}

/**
 * `count` complete booking conversations: opener, the facts in any order (in
 * one message or several), side questions and acknowledgements in between,
 * name, email and the final confirmation. Each must create exactly one rental
 * request with every fact kept.
 */
export function buildConversations(count = 2000, seed = 4242) {
  const random = seeded(seed);
  const conversations = [];
  for (let n = 0; n < count; n += 1) {
    const [from, to] = pick(random, DATE_PAIRS);
    const [a, b] = pick(random, PLACES);
    const [carWords, car] = pick(random, CARS);
    const name = pick(random, NAMES);
    const email = `customer${n}@example.com`;
    const pieces = [
      fill(pick(random, /[a-z]/i.test(from) ? EN_DATE_TEMPLATES : DATE_TEMPLATES), { from, to }),
      fill(pick(random, PLACE_TEMPLATES), { a, b }),
      carWords,
    ].sort(() => random() - 0.5);
    const turns = [pick(random, OPENERS)];
    if (random() < 0.25) turns.push(pieces.join(', '));
    else for (const piece of pieces) {
      turns.push(slip(piece, random));
      if (random() < 0.2) turns.push(pick(random, SIDE_QUESTIONS));
    }
    turns.push(name);
    if (random() < 0.15) turns.push(pick(random, SIDE_QUESTIONS));
    turns.push(email, pick(random, CONFIRMATIONS));
    conversations.push({ id: `conversation-${n + 1}`, turns, expect: { vehiclePreference: car, customerName: name, customerEmail: email, pickupLocation: a, dropoffLocation: b } });
  }
  return conversations;
}
