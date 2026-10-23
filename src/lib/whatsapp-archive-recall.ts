/** Bounded retrieval from retained customer quotes, not a replacement for the archive. */
import { redactForgottenHistoryText, type EditableFact } from '@/lib/whatsapp-conversation-control';
type Entry = { from: 'customer' | 'bot'; text: string; step?: string };
export type RecalledCustomerQuote = { position: number; text: string };

const TOPICS = [
  /קילומטר|קילומטרא|ק[״"]?מ|mileage|kilomet|annual distance/i,
  /תקציב|אומדן|מחשבון|budget|estimate|calculator/i,
  /עגלה|מזווד|מטען|כלי נגינה|stroller|luggage|bags?|cargo|instruments?/i,
  /נגיש|כיסא גלגלים|כסא גלגלים|wheelchair|accessib|mobility/i,
  /חשמל|טעינה|electric|charging/i,
  /גיר|ידני|אוטומט|transmission|manual|automatic/i,
  /נוסעים|תינוק|ילד|passengers|baby|child|children/i,
  /פיקדון|מסגרת|אשראי|deposit|credit|hold/i,
  /גמישות|יציאה|התחייבות|flexib|exit|commitment/i,
  /איסוף|החזרה|סניף|pickup|dropoff|branch/i,
  /תאריך|מועד|תאריכ|dates?|arrival|departure/i,
];
const normalize = (text: string) => text.toLowerCase().replace(/[\u0591-\u05c7]/g, '').replace(/[ךםןףץ]/g, c => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]!);
const STOP = new Set('what did say said tell told remember recall earlier previously beginning before about please just only again remind me my the and for that this with from have you your was were איך מה אני לי שלי כבר קודם אמרתי כתבתי תזכיר זוכר בבקשה לגבי רק את של על עם היה היתה הזה זאת בלי'.split(' ').map(normalize));
const tokens = (text: string) => [...new Set(normalize(text).match(/[a-zא-ת]{3,}/g) ?? [])].filter(t => !STOP.has(t));

export function recallArchivedCustomerQuotes(message: string, history: Entry[], privateValues: Array<string | undefined> = [], forgottenBefore?: Partial<Record<EditableFact, number>>): RecalledCustomerQuote[] {
  if (!Array.isArray(history)) return [];
  if (!/[?？]|תזכיר|זוכר|אמרתי|כתבתי|סיכמנו|בהתחלה|remember|remind|recall|earlier|previous|beginning/i.test(message)) return [];
  const query = tokens(message);
  const topics = TOPICS.filter(pattern => pattern.test(message));
  const beginning = /בתחילת|בהתחלה|beginning|first message/i.test(message);
  const older = history.slice(0, Math.max(0, history.length - 24));
  const contacts = privateValues.filter((v): v is string => typeof v === 'string' && Boolean(v.trim())).map(normalize);
  const candidates = older.flatMap((entry, index) => {
    if (!entry || entry.from !== 'customer' || typeof entry.text !== 'string' || ['rental_name', 'rental_email', 'rental_confirm'].includes(entry.step ?? '')) return [];
    const text = redactForgottenHistoryText(entry.text.trim(), index + 1, forgottenBefore);
    const normalized = normalize(text);
    if (!text || /@|(?:\+\d{1,3}|0)[\d\s()-]{8,}/.test(text) || contacts.some(value => normalized.includes(value))) return [];
    const words = new Set(tokens(text));
    const matches = query.filter(word => words.has(word)).length;
    const score = matches * 4 + topics.filter(pattern => pattern.test(text)).length * 3;
    if (!score && !beginning) return [];
    return [{ position: index + 1, text: text.slice(0, 400), score, rank: beginning ? -index : score + index / Math.max(1, history.length) }];
  });
  const selected = candidates.sort((a, b) => b.rank - a.rank).slice(0, 8).sort((a, b) => a.position - b.position);
  return selected.map(({ position, text }) => ({ position, text }));
}
