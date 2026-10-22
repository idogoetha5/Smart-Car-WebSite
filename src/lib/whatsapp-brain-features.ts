/**
 * Text features shared by the brain's classifier and the script that trains it
 * (scripts/whatsapp-eval/build-brain-model.mjs imports this file directly), so
 * training and answering always read a message the same way. No imports here.
 */

/** Lowercase, no niqqud or punctuation, final letters folded, "חחחחח" → "חח", "תודהההה" → "תודהה". */
export function brainNormalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״"׳'`´]/g, '')
    .replace(/[ךםןףץ]/g, (ch) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' } as Record<string, string>)[ch] ?? ch)
    .replace(/([א-תa-z])\1{2,}/g, '$1$1')
    .replace(/[^א-תa-z0-9\s\p{Extended_Pictographic}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "ובשישי" → "שישי": the little Hebrew prefixes (ו, ה, ב, ל, מ, ש, כש…) that glue onto words. */
export function stripPrefix(word: string) {
  return word.replace(/^(?:וכש|וש|כש|וה|וב|ול|ומ|ה|ב|ל|מ|ו|ש)(?=[א-ת]{3,})/, '');
}

/**
 * The features of one message: its words (with and without the Hebrew
 * prefix), pairs of neighbouring words, and three-letter pieces of every word
 * so a typo still shares most of its pieces with the right spelling.
 */
export function brainFeatures(text: string): string[] {
  const words = brainNormalize(text).split(' ').filter(Boolean).slice(0, 30);
  const out = new Set<string>();
  const bare = words.map(stripPrefix);
  for (let i = 0; i < words.length; i += 1) {
    out.add(`w:${words[i]}`);
    out.add(`w:${bare[i]}`);
    if (i > 0) out.add(`b:${bare[i - 1]}_${bare[i]}`);
    const padded = ` ${bare[i]} `;
    if (bare[i].length >= 3 && !/^\d+$/.test(bare[i])) for (let j = 0; j + 3 <= padded.length; j += 1) out.add(`c:${padded.slice(j, j + 3)}`);
  }
  if (/\?/.test(text)) out.add('q:?');
  if (words.length <= 2) out.add('len:short');
  else if (words.length >= 8) out.add('len:long');
  return [...out];
}
