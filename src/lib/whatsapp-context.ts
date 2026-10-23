/**
 * Reading the words around a trigger word, so one word does not decide alone:
 *
 *   "לא צריך נציג, רק תגיד לי כמה הפיקדון"  → not a request for a person
 *   "not an SUV, something small"            → a small car
 *   "מחר אני לא יכול, אולי בעוד שלושה ימים"  → not tomorrow
 *   "הרכב שלי במוסך אחרי תאונה, צריך רכב חלופי" → a rental, not an emergency with our car
 *   "הנציג שלכם היה מעולה בפעם הקודמת"      → praise, not a request
 *   "אני גר בהרצליה אבל צריך לאסוף בתל אביב" → pickup in Tel Aviv
 *
 * Used only for the decisions a single word used to make on its own (who to
 * hand over to, whether to start a booking, which place/car/date was meant).
 * A failure such as "הרכב לא מניע" is never "negated" here: emergencies keep
 * their own rules and only drop out for someone else's car or the past.
 */

const NEGATORS = new Set(['לא', 'בלי', 'ללא', 'אין', 'אל', 'אינני', 'איני', 'not', 'no', "don't", 'dont', 'do not', "doesn't", 'doesnt', 'never', 'without', "isn't", 'isnt', "won't", 'wont', 'nor']);
// Words that end what a "not" covers: "לא מחר, מחרתיים", "not an SUV but something small".
const BOUNDARIES = new Set(['אבל', 'רק', 'אלא', 'אולי', 'אז', 'כי', 'ו', 'but', 'just', 'only', 'rather', 'instead', 'maybe', 'so', 'because', 'please']);
// "מחר אני לא יכול": the "not" is about the words before it.
const CANNOT = /^(?:יכול|יכולה|יכולים|מתאים|מתאימה|נוח|מסתדר|מסתדרת|טוב|עובד|good|work|works|possible|ok|okay|suit|suits)$/i;
// Kept even after "לא": "לא בטוח" or "not sure" are a state of mind, not a negated choice.
const KEEP_AFTER_NOT = /^(?:בטוח|בטוחה|יודע|יודעת|sure|certain)$/i;

function tokens(text: string) {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

const bare = (token: string) => token.toLowerCase().replace(/[.,!?;:()"״׳']+$/g, '').replace(/^["(]+/, '');
const endsClause = (token: string) => /[.,!?;:]$/.test(token);

/** The message without what it says "no" to. */
export function withoutNegated(text: string): string {
  const words = tokens(text);
  const keep = words.map(() => true);
  for (let i = 0; i < words.length; i += 1) {
    let word = bare(words[i]);
    // Hebrew attaches the conjunction to the negator: "ובלי להעביר לנציג".
    // Strip it only for an actual negator, not arbitrary words beginning ו.
    if (word.startsWith('ו') && NEGATORS.has(word.slice(1))) word = word.slice(1);
    // "don't", "won't" as one token; "do not" as two.
    if (word === 'do' && bare(words[i + 1] ?? '') === 'not') { keep[i] = false; i += 1; word = 'not'; }
    if (!NEGATORS.has(word) || endsClause(words[i])) continue;
    const next = bare(words[i + 1] ?? '');
    if (KEEP_AFTER_NOT.test(next)) continue;
    keep[i] = false;
    // "מחר אני לא יכול" → drop "מחר אני" too, back to the start of the clause.
    if (CANNOT.test(next)) {
      for (let j = i - 1, steps = 0; j >= 0 && steps < 4 && !endsClause(words[j]); j -= 1, steps += 1) keep[j] = false;
    }
    // Forward: up to four words, until a comma, a full stop or "אבל / רק / but / just".
    for (let j = i + 1, steps = 0; j < words.length && steps < 4; j += 1, steps += 1) {
      if (BOUNDARIES.has(bare(words[j]))) break;
      keep[j] = false;
      if (endsClause(words[j])) break;
    }
  }
  return words.filter((_, i) => keep[i]).join(' ').replace(/^[,.\s]+/, '').trim();
}

/** "אני גר בהרצליה", "I live in Haifa": where the customer lives is not where they pick up. */
export function withoutResidence(text: string): string {
  return text
    .replace(/(?:אני\s+)?(?:גר|גרה|גרים|מתגורר|מתגוררת)\s+(?:ב|ליד|באזור)\S*(?:\s+\S+)?(?=\s*(?:,|\.|אבל|ו|$))/g, '')
    .replace(/\bi\s+(?:live|am living|stay|am staying)\s+(?:in|near)\s+\S+(?:\s+\S+)?(?=\s*(?:,|\.|but|and|$))/gi, '')
    // "אני מירושלים אבל אאסוף בהרצליה", "I'm from Haifa but…": where they are from, then where they pick up.
    .replace(/(?:^|\s)(?:אני|אנחנו)\s+מ\S+(?:\s+\S+)?(?=\s*(?:,\s*)?(?:אבל|רק)\s)/g, ' ')
    .replace(/\bi'?m\s+from\s+\S+(?:\s+\S+)?(?=\s*,?\s*but\s)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words a booking detail is read from: no negated parts, no home address. */
export function bookingScope(text: string): string {
  const scoped = withoutNegated(withoutResidence(text));
  // "not tomorrow, the day after" / "לא מחר, יום אחרי": the day after tomorrow.
  if (/(?:not|no|לא)\s+(?:tomorrow|מחר)/i.test(text)) return scoped.replace(/(?:^|\s)(?:the )?day after(?! tomorrow)/i, ' the day after tomorrow').replace(/(?:^|\s)יום אחרי(?! מחר)/, ' מחרתיים').trim();
  return scoped;
}

const PERSON = /נציג|נציגה|אנושי|בן ?אדם|בנאדם|מישהו אמיתי|יחזור|יחזרו|שיחזרו|תחזרו|יתקשר|יתקשרו|שיתקשרו|תתקשרו|representative|human|a person|real person|agent|someone real|call me|call back|callback/i;
const ASKS = /רוצה|רוצים|אפשר|תעביר|תעבירו|להעביר|לדבר|לדבר עם|תן לי|תני לי|תנו לי|צריך|צריכה|מבקש|מבקשת|תחבר|שיחזור|שיתקשר|תתקשרו|want|talk|speak|connect|transfer|put me|get me|need|can i|could i|call me/i;
const PAST_OR_PRAISE = /(?:היה|הייתה|היו|עזר|עזרה|טיפל|טיפלה|שירת|דיבר|דיברה|דיברו|was|were|helped|handled|served|talked|spoke)(?:\s|$|[,.!])|בפעם הקודמת|בפעם שעברה|אתמול|תודה ל|תודה רבה ל|last time|yesterday|thanks to|thank (?:you to )?the/i;

/**
 * True when the message asks for a person: "אני רוצה לדבר עם נציג", "נציג!".
 * False for "לא צריך נציג, רק…" (negated) and "הנציג שלכם היה מעולה" (about one, not asking).
 */
export function asksForPerson(text: string): boolean {
  if (!PERSON.test(text)) return false;
  // "אתה בכלל בן אדם?", "are you a real person?": a question about the bot, not a request.
  if (isBotQuestion(text)) return false;
  const scoped = withoutNegated(text);
  if (!PERSON.test(scoped)) return false;
  const words = tokens(scoped);
  if (words.length <= 3) return true;
  if (PAST_OR_PRAISE.test(scoped) && !ASKS.test(scoped)) return false;
  return true;
}

/** "אתה בוט?", "אתה בכלל בן אדם?", "are you human?" */
export function isBotQuestion(text: string): boolean {
  return /^(?:\S+\s+)?(?:אתה|את|זה)\s+(?:\S+\s+)?(?:בוט|רובוט|בן ?אדם|בנאדם|אמיתי|אמיתית|אנושי|מחשב)\s*\??$|are you (?:a |an )?(?:bot|robot|real|human|person|ai|real person)\??$|is this (?:a )?(?:bot|robot|real person|human)\??$/i.test(text.trim());
}

/** True when a person word appears but the message does not ask for one. */
export function mentionsPersonWithoutAsking(text: string): boolean {
  return PERSON.test(text) && !asksForPerson(text);
}

/** The message without the person words (for checking the rest: a complaint still counts). */
export function withoutPersonWords(text: string): string {
  return text.replace(new RegExp(PERSON.source, 'gi'), ' ').replace(/\s+/g, ' ').trim();
}

const OUR_CAR = /ששכרתי|השכור|השכורה|שלכם|שקיבלתי מכם|שלקחתי מכם|הרכב מ(?:סמארט|smart)|rental car|rented car|the car you|you gave me|i rented|your car|the rental/i;
const OTHER_CAR_OR_PAST = /הרכב שלי|האוטו שלי|המכונית שלי|הרכב שלנו|האוטו שלנו|הרכב הפרטי|אשתי|בעלי|הבן שלי|הבת שלי|our car|my wife|my husband|my son|my daughter|של(?:ו|ה|הם)(?:\s|$|[,.])|אחי|אחותי|אבא שלי|אמא שלי|חבר שלי|לפני (?:שנה|שנתיים|חודש|שבוע|כמה)|בעבר|אחרי (?:ה)?תאונה|במוסך|my car|my own car|his car|her car|their car|last (?:week|month|year)|ago|in the past|after (?:an|the|my) (?:accident|crash)|at the garage|in the shop/i;
const NEEDS_CAR = /רכב חלופי|רכב תחליפי|צריך (?:רכב|אוטו|משהו)|צריכה (?:רכב|אוטו|משהו)|צריכים (?:רכב|אוטו|משהו)|רוצה רכב|לשכור|need something|replacement car|need (?:a )?(?:car|rental)|rent a car|a rental|to rent/i;

/**
 * "הרכב שלי במוסך אחרי תאונה, צריך רכב חלופי", "my own car broke down last week so I need a rental":
 * the accident or breakdown is someone else's car or in the past, and the customer wants to rent.
 */
export function emergencyIsElsewhere(text: string): boolean {
  if (OUR_CAR.test(text)) return false;
  return NEEDS_CAR.test(text) && OTHER_CAR_OR_PAST.test(text);
}

const PAST_EVENT = /(?:^|\s)(?:לפני (?:שנה|שנתיים|כמה|חודש|חודשיים|שבוע|שבועיים|\d+)|בעבר|פעם(?:\s|$)|הייתה לי פעם|היה לי פעם|years? ago|months? ago|ago(?:\s|$|[,.?])|in the past|once|last (?:year|month|week))/i;
const HAPPENING_NOW = /עכשיו|כרגע|הרגע|ממש עכשיו|היום|right now|just now|currently|now(?:\s|$|[,.!?])|today/i;

/**
 * An accident or breakdown that is not happening to our car now: someone else's car while
 * renting ("הרכב שלי במוסך, צריך רכב חלופי"), or the past ("הייתה לי פעם תאונה, זה משנה?").
 */
export function notOurEmergencyNow(text: string): boolean {
  if (OUR_CAR.test(text) && HAPPENING_NOW.test(text)) return false;
  return emergencyIsElsewhere(text) || (PAST_EVENT.test(text) && !HAPPENING_NOW.test(text) && !OUR_CAR.test(text));
}

/** "החבר שלי אמר ש…", "I heard that…": a reported opinion, usually followed by a question. */
export function isReportedSpeech(text: string): boolean {
  return /(?:אמר|אמרה|אמרו|שמעתי|קראתי|ראיתי|טוענים|כתבו)\s+ש|(?:said|told me|heard|read|people say)\s+(?:that\s+)?/i.test(text);
}
