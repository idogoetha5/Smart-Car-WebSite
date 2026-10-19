import { ENGLISH_VOCABULARY, HEBREW_VOCABULARY, TRANSLITERATED_HEBREW } from '@/lib/whatsapp-vocabulary';
/**
 * How people actually type on a phone: neighbouring keys, the wrong keyboard
 * language, Hebrew written in English letters, missing spaces.
 *
 * The WhatsApp bot repairs a message with these rules before it routes it,
 * and compares words with a keyboard-aware distance, so "צריכ רכו", "rkb",
 * "ani tzarich rechev" and "teh car broke donw" are all understood even when
 * Gemini is unavailable. Gemini also receives the repaired text.
 */

// Standard Israeli layout (SI-1452), which the iPhone Hebrew keyboard follows.
const HEBREW_ROWS = ['/\'קראטוןםפ', 'שדגכעיחלךף', 'זסבהנמצתץ'];
const ENGLISH_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,.'];

/** The same physical key in each language: q↔/, e↔ק, a↔ש, … */
const LATIN_TO_HEBREW: Record<string, string> = {};
const HEBREW_TO_LATIN: Record<string, string> = {};
ENGLISH_ROWS.forEach((row, r) => [...row].forEach((key, c) => {
  const hebrew = HEBREW_ROWS[r][c];
  if (!hebrew) return;
  LATIN_TO_HEBREW[key] = hebrew;
  if (!/[/'.,;]/.test(hebrew)) HEBREW_TO_LATIN[hebrew] = key;
}));

function neighbours(rows: string[]) {
  const map = new Map<string, Set<string>>();
  rows.forEach((row, r) => [...row].forEach((key, c) => {
    const near = new Set<string>();
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, -1], [-1, -1], [1, 1]]) {
      const other = rows[r + dr]?.[c + dc];
      if (other) near.add(other);
    }
    map.set(key, near);
  }));
  return map;
}

const NEAR = new Map([...neighbours(HEBREW_ROWS), ...neighbours(ENGLISH_ROWS)]);

/** Letters that sound alike or that people swap in writing (final forms, א/ע, ט/ת, כ/ח, ס/ש, ק/כ, ו/ב). */
const SOUND_ALIKE = [['א', 'ע'], ['ט', 'ת'], ['כ', 'ח'], ['ס', 'ש'], ['ק', 'כ'], ['ו', 'ב'], ['ם', 'מ'], ['ן', 'נ'], ['ץ', 'צ'], ['ף', 'פ'], ['ך', 'כ'], ['c', 'k'], ['s', 'z'], ['i', 'y'], ['f', 'v']];
const ALIKE = new Set(SOUND_ALIKE.flatMap(([a, b]) => [`${a}${b}`, `${b}${a}`]));

function substitutionCost(a: string, b: string) {
  if (a === b) return 0;
  if (NEAR.get(a)?.has(b) || ALIKE.has(`${a}${b}`)) return 0.75;
  return 1;
}

/**
 * Edit distance where a neighbouring key or a sound-alike letter costs half,
 * so two fat-finger slips in one word still count as one mistake.
 */
export function keyboardDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 2) return 3;
  const rows = left.length + 1;
  const cols = right.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      // A doubled letter ("רכבב") is the cheapest slip of all.
      const insertCost = j > 1 && right[j - 1] === right[j - 2] ? 0.5 : 1;
      const deleteCost = i > 1 && left[i - 1] === left[i - 2] ? 0.5 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + deleteCost,
        d[i][j - 1] + insertCost,
        d[i - 1][j - 1] + substitutionCost(left[i - 1], right[j - 1]),
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.75);
    }
  }
  return d[left.length][right.length];
}

/** How far a customer's word may be from a keyword and still mean it. */
export function closeEnough(word: string, keyword: string) {
  if (keyword.length < 4 || word.length < 3) return word === keyword;
  // Short words tolerate one slip of a finger; longer words one real mistake, the longest two slips.
  const allowed = keyword.length >= 7 ? 1.5 : keyword.length >= 5 ? 1 : 0.75;
  return keyboardDistance(word, keyword) <= allowed;
}

// ---------------------------------------------------------------------------
// Words that tell us which language a message is really in.

/** Common Hebrew words in customer messages, used to recognise Hebrew typed on an English keyboard. */
export const HEBREW_WORDS = [
  'אני', 'אתה', 'את', 'אתם', 'אנחנו', 'הוא', 'היא', 'זה', 'זו', 'של', 'על', 'עם', 'לא', 'כן', 'מה', 'איך', 'כמה', 'למה', 'מתי', 'איפה', 'יש', 'אין', 'לי', 'לכם', 'שלכם', 'שלום', 'היי', 'תודה', 'בבקשה',
  'רכב', 'אוטו', 'מכונית', 'גיפ', 'רכבים', 'צריך', 'צריכה', 'רוצה', 'רוצים', 'מחפש', 'מחפשת', 'להשכיר', 'לשכור', 'השכרה', 'להזמין', 'הזמנה', 'מחר', 'היום', 'שבוע', 'חודש', 'סופש', 'יום', 'ימים',
  'קורה', 'נשמח', 'סבבה', 'אחלה', 'טוב', 'בוקר', 'ערב', 'מחיר', 'כמה', 'עולה', 'זול', 'יקר', 'פיקדון', 'ביטוח', 'סניף', 'סניפים', 'נציג', 'תאונה', 'פנצר', 'תקלה', 'נתקעתי', 'הרצליה', 'ירושלים', 'אביב', 'נתבג',
  'משפחתי', 'קטן', 'גדול', 'יוקרה', 'מקומות', 'אנשים', 'איסוף', 'החזרה', 'לאסוף', 'להחזיר', 'דלק', 'רישיון', 'גיל', 'ליסינג', 'למכירה', 'לקנות', 'אחי', 'דחוף', 'עכשיו', 'רגע', 'אפשר', 'מותר', 'שעות', 'פתוחים',
];

const ENGLISH_WORDS = new Set<string>([
  'i', 'a', 'an', 'the', 'is', 'are', 'am', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'my', 'me', 'you', 'your', 'we', 'it', 'do', 'can', 'need', 'want', 'have', 'has', 'hi', 'hello', 'hey', 'thanks', 'thank', 'please', 'pls',
  'car', 'cars', 'rent', 'rental', 'book', 'booking', 'how', 'what', 'when', 'where', 'why', 'much', 'many', 'price', 'cost', 'deposit', 'insurance', 'branch', 'airport', 'tomorrow', 'today', 'week', 'day', 'days', 'yes', 'no', 'ok', 'okay',
  'accident', 'flat', 'tire', 'tyre', 'broke', 'down', 'start', 'help', 'call', 'back', 'person', 'agent', 'is', 'there', 'with', 'from', 'jeep', 'suv', 'van', 'family', 'cheap', 'small', 'big', 'test', 'good', 'morning',
]);

/** Hebrew customers write in English letters too: "ani tzarich rechev", "ma kore". */
const TRANSLITERATION: Record<string, string> = {
  ani: 'אני', ata: 'אתה', at: 'את', atem: 'אתם', anachnu: 'אנחנו', ma: 'מה', mah: 'מה', eich: 'איך', eix: 'איך', ech: 'איך', kama: 'כמה', lama: 'למה', matai: 'מתי', mataii: 'מתי', eifo: 'איפה', efo: 'איפה', yesh: 'יש', ein: 'אין', li: 'לי', lachem: 'לכם', shelachem: 'שלכם',
  shalom: 'שלום', hey: 'היי', toda: 'תודה', todah: 'תודה', bevakasha: 'בבקשה', bvakasha: 'בבקשה', kore: 'קורה', korea: 'קורה', nishma: 'נשמע', sababa: 'סבבה', achla: 'אחלה', tov: 'טוב', boker: 'בוקר', erev: 'ערב', achi: 'אחי', dachuf: 'דחוף',
  rechev: 'רכב', rehev: 'רכב', rechav: 'רכב', reshev: 'רכב', oto: 'אוטו', auto: 'אוטו', mechonit: 'מכונית', jeep: 'גיפ', tzarich: 'צריך', tsarich: 'צריך', zarich: 'צריך', tzricha: 'צריכה', rotze: 'רוצה', rotzeh: 'רוצה', rotsa: 'רוצה', rotza: 'רוצה', mechapes: 'מחפש',
  lehaskir: 'להשכיר', liskor: 'לשכור', haskara: 'השכרה', lehazmin: 'להזמין', hazmana: 'הזמנה', machar: 'מחר', hayom: 'היום', shavua: 'שבוע', chodesh: 'חודש', sofash: 'סופש', yom: 'יום', yamim: 'ימים', mechir: 'מחיר', ole: 'עולה', zol: 'זול', yakar: 'יקר',
  pikadon: 'פיקדון', bituach: 'ביטוח', snif: 'סניף', snifim: 'סניפים', natzig: 'נציג', nazig: 'נציג', teuna: 'תאונה', pancher: 'פנצר', panchar: 'פנצר', takala: 'תקלה', nitkati: 'נתקעתי', mishpachti: 'משפחתי', katan: 'קטן', gadol: 'גדול', efshar: 'אפשר', mutar: 'מותר',
  leesof: 'לאסוף', lehachzir: 'להחזיר', delek: 'דלק', rishayon: 'רישיון', gil: 'גיל', leasing: 'ליסינג', liknot: 'לקנות', akshav: 'עכשיו', rega: 'רגע', shaot: 'שעות', ptuchim: 'פתוחים', herzliya: 'הרצליה', yerushalayim: 'ירושלים', natbag: 'נתבג', telaviv: 'תל אביב',
};

const words = (text: string) => text.toLowerCase().split(/[^a-z֐-׿0-9;,.'/]+/).filter(Boolean);

const HEBREW_SET = new Set([...HEBREW_WORDS, ...HEBREW_VOCABULARY]);
for (const word of ENGLISH_VOCABULARY) ENGLISH_WORDS.add(word);
/** Known Hebrew, also with a glued prefix ("והרכב", "לנתבג") or one slip of a finger. */
const isHebrewWord = (word: string) => {
  if (HEBREW_SET.has(word)) return true;
  const bare = word.replace(/^(?:וש|וכש|כש|וה|וב|ול|ומ|ה|ב|ל|מ|ו|ש|כ)/, '');
  if (bare.length >= 2 && HEBREW_SET.has(bare)) return true;
  return word.length >= 4 && HEBREW_WORDS.some((known) => known.length >= 4 && closeEnough(word, known));
};

/** "rkb" typed with the keyboard still in English → "רכב". Returns null when the text is real English. */
export function fromWrongLayout(text: string): string | null {
  if (/[֐-׿]/.test(text) || !/[a-z]/i.test(text)) return null;
  // Booking references, codes, emails and links ("SC-482913", "AB12") are kept as typed.
  if (/[a-z][-_]?\d|\d[-_]?[a-z]|@|https?:|www\./i.test(text)) return null;
  const latin = words(text).filter((w) => /[a-z]/.test(w));
  if (!latin.length || latin.some((w) => ENGLISH_WORDS.has(w))) return null;
  const converted = text.toLowerCase().replace(/[a-z;,.]/g, (ch) => LATIN_TO_HEBREW[ch] ?? ch);
  const hebrew = words(converted).filter((w) => /[֐-׿]/.test(w));
  const known = hebrew.filter(isHebrewWord).length;
  return known >= Math.max(1, Math.ceil(hebrew.length / 2)) ? converted.replace(/\s+/g, ' ').trim() : null;
}

/** "שק,ק" typed with the keyboard still in Hebrew → "we,e"; only when the result is real English. */
export function fromWrongHebrewLayout(text: string): string | null {
  if (/[a-z]/i.test(text) || !/[֐-׿]/.test(text)) return null;
  const hebrew = words(text).filter((w) => /[֐-׿]/.test(w));
  if (!hebrew.length || hebrew.some(isHebrewWord)) return null;
  const converted = text.replace(/[֐-׿]/g, (ch) => HEBREW_TO_LATIN[ch] ?? ch);
  const latin = words(converted);
  const known = latin.filter((w) => ENGLISH_WORDS.has(w)).length;
  return known >= Math.max(1, Math.ceil(latin.length / 2)) ? converted : null;
}

/** "ani tzarich rechev mahar" → "אני צריך רכב מחר". Returns null when it is not transliterated Hebrew. */
const PHRASES = Object.entries(TRANSLITERATED_HEBREW).filter(([key]) => key.includes(' ')).sort((a, b) => b[0].length - a[0].length)
  .map(([phrase, hebrew]) => [new RegExp(`(^|[^a-z])${phrase.replace(/ /g, '\\s+')}(?=$|[^a-z])`, 'g'), hebrew, phrase.split(' ')[0]] as const);
const SINGLE: Record<string, string> = { ...Object.fromEntries(Object.entries(TRANSLITERATED_HEBREW).filter(([key]) => !key.includes(' '))), ...TRANSLITERATION };
/** Keys of five letters or more, grouped by first letter, for the near-spelling lookup. */
const SINGLE_KEYS = new Map<string, string[]>();
for (const key of Object.keys(SINGLE)) if (key.length >= 5) SINGLE_KEYS.set(key[0], [...(SINGLE_KEYS.get(key[0]) ?? []), key]);

// Car makes and models stay in English: the catalogue and the sales flow match them as written.
const CAR_NAMES = new Set(['toyota', 'corolla', 'yaris', 'camry', 'rav', 'prius', 'mazda', 'kia', 'picanto', 'sportage', 'niro', 'rio', 'ceed', 'stonic', 'sorento', 'hyundai', 'tucson', 'ioniq', 'kona', 'elantra', 'i', 'skoda', 'octavia', 'fabia', 'superb', 'kodiaq', 'karoq', 'kamiq', 'suzuki', 'swift', 'vitara', 'baleno', 'ignis', 'mitsubishi', 'outlander', 'attrage', 'space', 'star', 'nissan', 'qashqai', 'juke', 'micra', 'chevrolet', 'spark', 'peugeot', 'citroen', 'renault', 'clio', 'captur', 'megane', 'dacia', 'duster', 'sandero', 'volkswagen', 'vw', 'golf', 'polo', 'passat', 'tiguan', 'seat', 'ibiza', 'leon', 'arona', 'ford', 'focus', 'fiesta', 'honda', 'civic', 'jazz', 'subaru', 'audi', 'bmw', 'mercedes', 'tesla', 'model', 'byd', 'atto', 'mg', 'zs', 'geely', 'chery', 'jeep', 'compass', 'renegade', 'lexus', 'volvo', 'opel', 'corsa', 'astra', 'fiat', 'tipo']);

export function fromTransliteration(text: string): string | null {
  if (/[֐-׿]/.test(text)) return null;
  if (words(text).some((w) => CAR_NAMES.has(w) && w.length >= 3)) return null;
  let phraseHits = 0;
  let lowered = text.toLowerCase();
  for (const [pattern, hebrew, first] of PHRASES) {
    if (!lowered.includes(first)) continue;
    lowered = lowered.replace(pattern, (_, lead) => { phraseHits += 1; return `${lead}${hebrew}`; });
  }
  const parts = lowered.split(/(\s+)/);
  let hits = 0;
  let latinWords = 0;
  const out = parts.map((part) => {
    const word = part.replace(/[^a-z]/g, '');
    if (!word) return part;
    latinWords += 1;
    const exact = SINGLE[word];
    const nearKey = exact ? undefined : word.length >= 5 ? SINGLE_KEYS.get(word[0])?.find((key) => Math.abs(key.length - word.length) <= 1 && keyboardDistance(word, key) <= 1) : undefined;
    const near = exact ?? (nearKey ? SINGLE[nearKey] : undefined);
    if (near && !(ENGLISH_WORDS.has(word) && !exact)) { hits += 1; return part.toLowerCase().replace(word, near); }
    return part;
  });
  const englishHits = words(text).filter((w) => ENGLISH_WORDS.has(w) && !SINGLE[w]).length;
  hits += phraseHits * 2;
  latinWords += phraseHits;
  return hits >= 2 && hits >= englishHits * 2 && hits >= Math.ceil(latinWords / 2) ? out.join('') : null;
}

/**
 * The text the bot should read: the customer's message, converted when it
 * was typed with the wrong keyboard language or in transliteration.
 */
export function repairCustomerText(text: string): string {
  return fromWrongLayout(text) ?? fromTransliteration(text) ?? fromWrongHebrewLayout(text) ?? text;
}
