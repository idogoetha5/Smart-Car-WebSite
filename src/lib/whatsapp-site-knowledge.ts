import { BRANCHES } from '@/lib/branches';
import { LEASING_DURATIONS, MILEAGE_PACKAGES, OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';
import { DELIVERY_CITIES } from '@/lib/delivery-cities';
import { FAQ_HE } from '@/lib/faq-data';
import { ANSWERS } from '@/lib/smartcar-service-knowledge';

/**
 * Everything the WhatsApp bot may say about SmartCar.
 *
 * The approved structured sources (branches, FAQ, service answers) are always
 * included. On top of them the published Hebrew pages are read from the live
 * site and cached, so whatever the website says, the bot knows, and an edit to
 * a page reaches the bot without a code change.
 */

const PAGES = [
  '/he', '/he/terms', '/he/insurance', '/he/leasing', '/he/about', '/he/guide', '/he/contact', '/he/branches', '/he/cars-for-sale', '/he/rental',
  ...['business', 'new-driver', 'leasing', 'hourly', 'commercial', 'daily', 'monthly', 'sale'].map((type) => `/he/services/${type}`),
];
const PAGE_LIMIT = 14000;
const CACHE_MS = 30 * 60_000;

let cache: { text: string; at: number } | null = null;
let pending: Promise<string> | null = null;

function staticKnowledge() {
  const branches = BRANCHES.map((b) => `- ${b.nameHe}: ${b.streetHe}, ${b.cityHe}. טלפון ${b.phone}.`).join('\n');
  const faq = FAQ_HE.map((item) => `ש: ${item.q}\nת: ${item.a}`).join('\n\n');
  const answers = Object.values(ANSWERS).map((answer) => `- ${answer.he}`).join('\n');
  const delivery = DELIVERY_CITIES.map((city) => `- ${city.nameHe}: ${city.bodyHe}`).join('\n');
  return `# פרטי קשר
טלפון המשרד: ${OFFICE_PHONE}. מייל: ${OFFICE_EMAIL}. אתר: https://www.smartcar.co.il

# סניפים
${branches}

# שאלות נפוצות
${faq}

# תשובות שירות מאושרות
${answers}

# מסירה עד הבית (ערים ואזורים ללא סניף)
${delivery}

# ליסינג
תקופות ליסינג אפשריות (בחודשים): ${LEASING_DURATIONS.join(', ')}. חבילות קילומטראז׳ שנתיות: ${MILEAGE_PACKAGES.map((km) => km.toLocaleString('en-US')).join(', ')} ק״מ.

# קטגוריות רכב להשכרה
רכב קטן וחסכוני, רכב משפחתי, קרוסאובר / SUV, 7 מקומות ומעלה (ואן), רכב יוקרתי, רכב חשמלי, קבריולט.`;
}

/** Reads the visible text of a page's <main>, without markup, scripts or styles. */
export function pageText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return main
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, PAGE_LIMIT);
}

async function livePages(): Promise<string> {
  const base = (process.env.WHATSAPP_KNOWLEDGE_BASE_URL || 'https://www.smartcar.co.il').replace(/\/$/, '');
  const pages = await Promise.all(PAGES.map(async (path) => {
    try {
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'SmartCar-WhatsApp-Knowledge' } });
      if (!response.ok) return '';
      const text = pageText(await response.text());
      return text ? `# עמוד באתר ${path}\n${text}` : '';
    } catch {
      return '';
    }
  }));
  return pages.filter(Boolean).join('\n\n');
}

/** The full knowledge text. Never throws; falls back to the approved static sources. */
export async function getSiteKnowledge(): Promise<string> {
  const fixed = staticKnowledge();
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return fixed;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.text;
  pending ??= livePages()
    .then((live) => {
      const text = live ? `${fixed}\n\n${live}` : fixed;
      // Do not hold on to a failed read for half an hour.
      if (live) cache = { text, at: Date.now() };
      return text;
    })
    .finally(() => { pending = null; });
  return pending;
}

// ---------------------------------------------------------------------------
// Retrieval: send Gemini only the parts of the site that matter for this
// message. The whole site on every message used up the model's per-minute
// token allowance after a dozen messages; a focused extract keeps answers
// precise and the bot available.

const CORE_HEADINGS = ['# פרטי קשר', '# סניפים'];
const HE_PREFIXES = /^(?:וכש|שכ|וב|ול|וה|ומ|כש|ב|ל|ה|ו|מ|ש|כ)(?=[֐-׿]{3,})/;
const STOP = new Set(['של', 'את', 'עם', 'על', 'יש', 'אם', 'גם', 'או', 'זה', 'זו', 'אני', 'אתם', 'לכם', 'שלכם', 'מה', 'איך', 'כמה', 'האם', 'אפשר', 'רוצה', 'צריך', 'תודה', 'בבקשה', 'היי', 'שלום', 'the', 'a', 'an', 'is', 'are', 'do', 'you', 'i', 'to', 'of', 'and', 'can', 'my', 'for', 'in', 'what', 'how']);

/** Same-meaning words customers use for the site's own terms. */
const SYNONYMS: Record<string, string[]> = {
  סניף: ['סניפים', 'כתובת', 'ממוקם', 'branch'], גיל: ['21', 'צעיר', 'צעירים'], חדש: ['ותק', 'שנתיים'],
  פיקדון: ['בטחון', 'ערבון', 'deposit'], דביט: ['אשראי', 'כרטיס'], מזומן: ['אשראי', 'תשלום'],
  ביטוח: ['השתתפות', 'כיסוי'], ביטול: ['לבטל', 'ביטולים', 'החזר'], לבטל: ['ביטול'], לשנות: ['שינוי', 'תאריכים'],
  דלק: ['מיכל', 'מלא'], מיכל: ['דלק'], קילומטר: ['ק״מ', 'ק"מ', 'קילומטראז׳'], קילומטרים: ['ק״מ', 'ק"מ'],
  לעשן: ['עישון'], עישון: ['לעשן'], ירדן: ['גבול', 'מחוץ'], 'חו״ל': ['גבול', 'מחוץ'], טאבה: ['גבול'],
  תייר: ['בינלאומי', 'תושב חוץ'], מסמכים: ['רישיון', 'דרכון', 'תעודת'], נהג: ['נוסף'],
  משלוח: ['מסירה', 'הבית'], הבית: ['מסירה'], אובר: ['uber', 'מוניות', 'שכר'], וולט: ['bolt', 'שכר'],
  דוח: ['דוחות', 'קנס', 'קנסות'], דוחות: ['קנסות'], שעות: ['פעילות', '08:00'], פתוחים: ['פעילות', 'שעות'],
  ליסינג: ['חודשים', 'קילומטראז׳'], למכירה: ['מכירה', 'מכירת'], חברה: ['2003', 'סיפור'], קיימים: ['2003'],
  // English questions against the Hebrew site.
  branch: ['סניף', 'סניפים'], branches: ['סניפים'], address: ['כתובת'], phone: ['טלפון'], email: ['מייל'], hours: ['שעות', 'פעילות'], open: ['שעות', 'פעילות'],
  age: ['גיל', '21'], young: ['צעירים', 'גיל'], new: ['ותק'], driver: ['נהג'], licence: ['רישיון'], license: ['רישיון'], tourist: ['תייר', 'בינלאומי'], foreign: ['בינלאומי', 'תושב חוץ'],
  deposit: ['פיקדון'], debit: ['דביט'], credit: ['אשראי'], card: ['כרטיס', 'אשראי'], cash: ['אשראי', 'תשלום'], pay: ['תשלום', 'אשראי'],
  insurance: ['ביטוח'], excess: ['השתתפות'], cancel: ['ביטול'], cancellation: ['ביטול'], change: ['שינוי'], dates: ['תאריכים'],
  fuel: ['דלק', 'מיכל'], tank: ['מיכל'], mileage: ['ק״מ', 'ק"מ', 'קילומטראז׳'], kilometres: ['ק״מ', 'ק"מ'], kilometers: ['ק״מ', 'ק"מ'], km: ['ק״מ', 'ק"מ'],
  smoke: ['עישון'], smoking: ['עישון'], abroad: ['גבול', 'מחוץ'], jordan: ['גבול'], documents: ['רישיון', 'דרכון'], bring: ['רישיון', 'דרכון'],
  deliver: ['מסירה'], delivery: ['מסירה'], home: ['הבית', 'מסירה'], leasing: ['ליסינג'], lease: ['ליסינג'], sale: ['מכירה'], sell: ['מכירה'],
  uber: ['שכר', 'מוניות'], fines: ['דוחות', 'קנסות'], tickets: ['דוחות'], parking: ['חניה', 'דוחות'],
};

function tokens(text: string): string[] {
  return text.toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{L}\p{N}״"'׳:]+/gu, ' ')
    .split(' ')
    .map((word) => word.replace(/^["'׳״]+|["'׳״]+$/g, ''))
    .filter((word) => word.length > 1 && !STOP.has(word))
    .flatMap((word) => {
      const bare = word.replace(HE_PREFIXES, '');
      return bare !== word ? [word, bare] : [word];
    });
}

/** Splits the knowledge into small passages, each labelled with its section heading. */
export function knowledgeChunks(text: string): string[] {
  const chunks: string[] = [];
  let heading = '';
  let current: string[] = [];
  const flush = () => {
    if (current.length) chunks.push(`${heading}\n${current.join('\n')}`.trim());
    current = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('# ')) { flush(); heading = line; continue; }
    if (!line.trim()) { if (current.join('\n').length > 300) flush(); continue; }
    current.push(line);
    if (current.join('\n').length > 700) flush();
  }
  flush();
  return chunks;
}

/** The core contact details plus the passages that best match the message. */
export function relevantKnowledge(text: string, message: string, budget = 7000): string {
  const chunks = knowledgeChunks(text);
  const core = chunks.filter((chunk) => CORE_HEADINGS.some((heading) => chunk.startsWith(heading)));
  const words = tokens(message);
  const wanted = new Set(words.flatMap((word) => [word, ...(SYNONYMS[word] ?? [])].flatMap((w) => tokens(w))));
  const scored = chunks
    .filter((chunk) => !core.includes(chunk))
    .map((chunk) => {
      const own = new Set(tokens(chunk));
      let score = 0;
      for (const word of wanted) if (own.has(word)) score += word.length > 3 ? 2 : 1;
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const picked = [...core];
  let size = picked.join('\n\n').length;
  for (const { chunk } of scored) {
    if (size + chunk.length > budget) continue;
    picked.push(chunk);
    size += chunk.length;
  }
  return picked.join('\n\n');
}
