/**
 * A bounded check for conversational drafts, not a proof of factual grounding.
 * The model receives approved facts; these checks catch recognizable unsafe
 * output and state conflicts. Only application code may execute actions.
 */
import { annualMileageMentions } from '@/lib/whatsapp-commercial-memory';
export type ConversationalReplyInput = {
  reply: string;
  input: string;
  locale: 'he' | 'en';
  known: Record<string, string | number | undefined>;
  approvedFacts: string[];
  handoffDeferred: boolean;
  bookingPhase: boolean;
  nextMissingField?: string;
  onReject?: (reason: string) => void;
};

/** Explicit eligibility questions, not an age merely supplied during intake. */
export function asksRentalAgeTerms(input: string): boolean {
  return /[?؟]|אפשר|האם|can I|may I|what|are .*terms/i.test(input)
    && /(?:rent|hire).{0,30}(?:at my age|age \d)|young[- ]driver|minimum age|age (?:limit|requirement)|(?:גיל|בן|בת)\s*\d.{0,65}(?:לשכור|ביטוח|פיקדון)|נהג צעיר|ותק (?:ה)?רישיון/i.test(input);
}

export function hasUndecidedRentalDates(input: string): boolean {
  return /(?:haven['’]?t|have not|has not|not yet)\s+(?:yet\s+)?(?:decided(?: on)?|chosen|picked|settled on)[^.!?\n]{0,70}\bdates?\b|(?:do not|don['’]?t|not sure)[^.!?\n]{0,55}\b(?:know[^.!?\n]{0,15})?dates?\b|\bno dates? yet\b|\bdates?[^.!?\n]{0,25}(?:undecided|still open|not (?:set|decided|chosen))|(?:לא יודע(?:ת)?|לא בטוח(?:ה)?|לא סגרנו|לא החלטתי|אין לי(?: עדיין)?)[^.!?\n]{0,45}תאריכ|תאריכ[^.!?\n]{0,25}(?:פתוחים|עוד לא|עדיין לא|לא סופיים)/i.test(input);
}

function numberTokens(text: string): string[] {
  return (text.match(/\d+(?:[,.]\d+)*/g) ?? []).map(value => value.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/^0+(?=\d)/, ''));
}

function hasAffirmativeMatch(text: string, pattern: RegExp, unverifiedPrefix?: RegExp): boolean {
  for (const match of text.matchAll(pattern)) {
    const prefix = text.slice(Math.max(0, match.index! - 55), match.index);
    if (unverifiedPrefix?.test(prefix)) continue;
    if (/(?:cannot|can['’]?t|do not|don['’]?t)\s+(?:guarantee|promise|confirm|say)\s+(?:that\s+)?$|whether\s*$|אי אפשר (?:להבטיח|לאשר)\s*(?:ש)?$/i.test(prefix)) continue;
    if (/(?:\bnot|\bnever|\bno|\bcannot|\bcan['’]?t|\bisn['’]?t|\baren['’]?t|לא|אינו|אינה|איננו|אין)\s+(?:(?:be|been|being|already|yet|necessarily|a|the|כבר|עדיין|בהכרח)\s+){0,3}$/i.test(prefix)) continue;
    return true;
  }
  return false;
}

/** A weekday written next to a date ("יום רביעי 19.11", "Wed 19 Nov") must be that date's weekday. */
function wrongWeekday(reply: string, today = new Date()): boolean {
  const he: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6 };
  const en: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12 };
  const check = (weekday: number, day: number, month: number, year?: number) => {
    if (!day || !month || month > 12 || day > 31) return false;
    let y = year ?? today.getUTCFullYear();
    if (!year && Date.UTC(y, month - 1, day) < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 86400000) y += 1;
    const date = new Date(Date.UTC(y, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDay() !== weekday;
  };
  for (const m of reply.matchAll(/(?:יום\s+)?(?:ה)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)[,\s]+(?:ה|ה-|ה־)?(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?/gu)) {
    if (check(he[m[1]], Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : undefined)) return true;
  }
  for (const m of reply.matchAll(/(?:יום\s+)?(?:ה)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)[,\s]+(?:ה[־-]?)?(\d{1,2})\s+(?:ב)?(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/gu)) {
    if (check(he[m[1]], Number(m[2]), months[m[3]])) return true;
  }
  for (const m of reply.matchAll(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+(?:(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})[./](\d{1,2}))/giu)) {
    const wd = en[m[1].toLowerCase()];
    const day = Number(m[2] ?? m[5] ?? m[6]);
    const month = m[3] ? months[m[3].toLowerCase()] : m[4] ? months[m[4].toLowerCase()] : Number(m[7]);
    if (check(wd, day, month)) return true;
  }
  return false;
}

export function validateConversationalReply(args: ConversationalReplyInput): string | null {
  const { input, locale, known, approvedFacts, handoffDeferred } = args;
  const reject = (reason: string): null => { args.onReject?.(reason); return null; };
  const reply = args.reply?.trim();
  if (!reply) return reject('empty');
  if (asksRentalAgeTerms(input) && !/\bage\b|\b21\b|young[- ]driver|licen[cs]e|גיל|רישיון|נהג צעיר/i.test(reply)) return reject('unanswered_age_terms');
  if (asksRentalAgeTerms(input) && /deposit|פיקדון/i.test(input) && !/deposit|card hold|פיקדון/i.test(reply)) return reject('unanswered_deposit');
  if (reply.length > 650) return reject('too_long');
  if (wrongWeekday(reply)) return reject('wrong_weekday');
  // The airport surcharge is a fixed published amount; the model may not invent that it varies.
  if (/(?:נתב.?ג|airport|surcharge|תוספת)/iu.test(reply) && /(?:שהוא|שהיא|הסכום|התוספת|הוא|היא)\s+(?:משתנה|משתנים|לא קבוע)|\b(?:it|the (?:amount|surcharge|fee)) (?:varies|changes|is not fixed)\b/iu.test(reply)) return reject('invented_reason');
  // Refund timing is not published (only the deposit release window is).
  if (!/deposit|פיקדון/iu.test(reply) && /(?:refund|זיכוי|החזר(?: הכספי| הכסף)?)[^.!?\n]{0,90}(?:\d+\s*)?(?:(?:a few|several|few)\s+)?(?:business days|working days|days|weeks|ימי עסקים|ימים|שבועות)/iu.test(reply)) return reject('refund_timing');
  // Invoices/receipts in a company name are confirmed by a representative, not promised in chat.
  if (hasAffirmativeMatch(reply, /\b(?:we|I) (?:can|will|'ll) (?:issue|provide|send|prepare|make out) (?:you )?(?:an? |the )?(?:invoice|receipt)|\byes,? (?:we|you) can (?:get|have|receive) (?:an? )?(?:invoice|receipt)|(?:נוציא|נשלח|נכין|אפשר להוציא|ניתן להוציא|נפיק)\s+(?:לכם\s+)?(?:חשבונית|קבלה)/giu)) return reject('invoice_claim');
  // Liability for damage is decided by SmartCar after review, never in chat.
  if (hasAffirmativeMatch(reply, /\byes,? (?:you|the renter) (?:will |would )?(?:have to|need to|must)? ?pay\b|\b(?:are|is) the renter['’]?s responsibility\b|\byou (?:will|would) (?:have to )?pay (?:for (?:it|the damage|the repair)|up to)\b|(?:כן,?\s+)?(?:תצטרכו|תצטרך|תשלמו|אתם משלמים|באחריותכם)\s+(?:לשלם\s+)?(?:על\s+)?(?:הנזק|התיקון|ההשתתפות)/giu)) return reject('liability_claim');
  // Financing is not published; only a representative can say what is available.
  if (hasAffirmativeMatch(reply, /\b(?:yes,? )?we (?:offer|provide|have|arrange) (?:car )?(?:financing|finance|loans?|payment plans?)\b|\bfinancing (?:is|are) available\b|(?:יש לנו|אנחנו מציעים|נציע|ניתן לקבל)\s+(?:מסלולי\s+|אפשרויות\s+)?(?:מימון|הלוואה|הלוואות)/giu)) return reject('financing_claim');
  // Instruction text leaking into the reply ("רק אם הלקוח שואל…", "if the customer asks").
  if (/(?:^|[\s:,(])(?:ה)?לקוח(?:ה|ות)?\s+(?:שואל|שואלת|שאל|שאלה|מבקש|מבקשת|לא שאל)|רק אם הלקוח|\b(?:if|when|only if) the customer (?:asks|asked|wants|did not)\b|\bthe customer (?:asks|asked)\b|approvedFacts|\bfact\b:/iu.test(reply)) return reject('instruction_leak');
  // "תודה רציתי לשאול," — names reach the model redacted, so a salutation with a name-like
  // word other than the known customer name is the model inventing one.
  const salutation = reply.match(/^(?:תודה|היי|שלום|אהלן|hi|hello|thanks)\s*,?\s+([\p{L}'-]{2,20}(?:\s+[\p{L}'-]{2,20})?)\s*[,!]/iu)?.[1];
  if (salutation && !/^(?:רבה|לך|לכם|על|מאוד|שוב|שפניתם|שפנית|ששאלתם|ששאלת|ושלום|you|so|for|again|there|everyone|all)(?:\s|$)/iu.test(salutation)
    && !String(known.customerName ?? '').includes(salutation.split(/\s+/u)[0])) return reject('unknown_name');
  // A thousands figure cut to "20, לשנה" reads as broken; fall back instead.
  if (/\d,\s+(?:לשנה|בשנה|לחודש|ק["״]?מ)|\d,\s+(?:per|a)\s+(?:year|month)\b/u.test(reply)) return reject('broken_number');
  if ((reply.match(/[?؟]/g) ?? []).length > 1) return reject('multiple_questions');
  const unrestrictedExit = /\b(?:cancel|end|terminate|return|swap|replace|switch)\b[^.!?\n]{0,65}\b(?:anytime|at any (?:time|stage|point)|whenever you (?:want|need))\b|(?:לסיים|סיום|לבטל|ביטול|להחליף|החלפה|להחזיר|החזרה)[^.!?\n]{0,55}(?:בכל (?:שלב|עת|זמן)|מתי שתרצ)/giu;
  for (const match of reply.matchAll(unrestrictedExit)) {
    const sentence = reply.slice(Math.max(0, match.index! - 60), match.index! + match[0].length + 100).split(/[.!?\n]/).find(part => part.includes(match[0])) ?? match[0];
    if (hasAffirmativeMatch(reply, new RegExp(match[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'))
      && !/subject to|depends? on|not (?:necessarily|guaranteed)|no guarantee|cannot assume|does not|בכפוף|תלוי|אין להסיק|לא בהכרח|אין הבטחה|לפי (?:ההסכם|החוזה)/i.test(sentence)) return reject('unrestricted_exit');
  }
  if (locale === 'he' && !/[א-ת]/.test(reply) || locale === 'en' && (/[א-ת]/.test(reply) || !/[A-Za-z]/.test(reply))) return reject('language');
  if (/[\u0600-\u06ff]/u.test(reply)) return reject('language');
  if (/@|https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(reply)) return reject('contact_or_link');
  if (/(?<!\d)(?:\+\d{1,3}[ ()-]*|0[2-9])[\d ()-]{7,}/.test(reply)) return reject('contact_or_link');
  if (/system prompt|backend|internal (?:workflow|system|process)|language model|Gemini|הנחיות המערכת|תהליך פנימי|המודל|אין לי גישה/i.test(reply)) return reject('internal_details');
  if (/\b(?:taxi|taxis|bus|buses|train|uber|avis|hertz|sixt|eldan)\b|מונית|מוניות|אוטובוס|רכבת|אוויס|הרץ|סיקסט|אלדן/i.test(reply)) return reject('outside_business');
  if (/\b(?:I am|I'm|as)\s+(?:a |an )?(?:bot|AI|artificial intelligence|digital assistant)\b|\b(?:I am|I'm).{0,25}\b(?:bot|AI|digital assistant)\b|אני (?:בוט|רובוט|ה?עוזר ה?דיגיטלי|בינה מלאכותית)/i.test(reply)) return reject('identity');

  // Private collection belongs to the controlled intake, never a model draft.
  // Match requests rather than mere mentions, so protective reminders remain useful.
  if (hasAffirmativeMatch(reply, /\b(?:send|provide|share|enter|upload|give|confirm|need|require|collect)\b[^.!?\n]{0,90}\b(?:(?:all |the |your )*passengers?['’]? names?|names? of (?:all |the )?passengers|(?:identity|identification|ID) numbers?|(?:full |complete )?(?:credit |payment )?card (?:number|details)|security code|CVV|CVC|(?:driver['’]?s? |driving )?licen[cs]e (?:copy|copies|photo)|(?:a |your |customer )?email(?: address)?)\b|(?:שלח(?:ו|י)?|ספק(?:ו|י)?|העל(?:ו|י)?|מסור|מסרו|צריך|צריכים|נדרש|לאשר)[^.!?\n]{0,80}(?:שמות (?:כל )?(?:הנוסעים|נוסעים)|מספר(?:י)? (?:תעודת זהות|זהות)|פרטי (?:כרטיס|האשראי)|מספר (?:כרטיס|האשראי)|קוד אבטחה|צילום (?:רישיון|רשיון)|(?:כתובת )?(?:מייל|דוא[״"]?ל))/gi)) return reject('private_collection');
  if (hasAffirmativeMatch(reply, /\b(?:send|provide|share|upload|need|require)\b[^.!?\n]{0,40}\b(?:copy|photo|scan) of (?:your |the |a )?(?:driver['’]?s? |driving )?licen[cs]e\b/gi)) return reject('private_collection');
  if (/\bwhat (?:are|is)\b[^.!?\n]{0,45}\b(?:passengers?['’]? names?|names? of (?:all |the )?passengers|identity number|ID number|card number|security code|CVV|email address)\b|מה(?:ם|י)?[^.!?\n]{0,30}(?:שמות (?:כל )?הנוסעים|מספר תעודת הזהות|מספר האשראי|כתובת המייל)/i.test(reply)) return reject('private_collection');

  if (known.childSeats === 0 && hasAffirmativeMatch(reply,
    /\b(?:the|your) child[- ]seat (?:is (?:a )?request|request (?:is|remains|has been) (?:noted|included|saved|pending|recorded))\b|\b(?:your|the) (?:request|draft|summary) (?:still )?(?:includes?|contains?) (?:one|a|\d+) (?:child|car) seats?\b|בקשת כיסא(?:ות)? הבטיחות (?:נשמרה|כלולה|רשומה)|כיסא הבטיחות הוא בקשה|כיסא(?:ות)? הבטיחות (?:כלול|רשום|נשמר)(?:ה|ים|ות)? (?:בבקשה|בטיוטה|בסיכום)/gi,
  )) return reject('seat_request_conflict');

  const allowedNumbers = new Set(numberTokens([input, ...Object.values(known).filter(value => value !== undefined).map(String), ...approvedFacts].join(' ')));
  if (numberTokens(reply).some(token => !allowedNumbers.has(token))) return reject('unsupported_number');

  // Negative or conditional discussion is useful advice. Positive assurances
  // about a transaction, stock, personal cover or physical fit are not.
  if (hasAffirmativeMatch(reply, /\b(?:guaranteed|definitely fits?|certainly fits?|fully covered|eligible to rent)\b|מובטח(?:ת)?|בוודאות יתאים|בהחלט ייכנס|מכוסה בוודאות/gi)) return reject('assurance');
  if (/היסטורי|בדיקה עצמאית|history|independent inspection/i.test(input)) {
    if (hasAffirmativeMatch(reply, /(?:תמיד)[^.!?\n]{0,30}(?:אפשרי|אפשר|ניתן)|\balways\b[^.!?\n]{0,25}\b(?:possible|available|provided)\b/gi)) return reject('inspection_assurance');
    if (hasAffirmativeMatch(reply, /(?:נספק|מספקים|לספק|תקבלו?)[^.!?\n]{0,45}היסטורי[^.!?\n]{0,30}מלאה|\b(?:provide|supply|receive)\b[^.!?\n]{0,25}\b(?:full|complete)\b[^.!?\n]{0,20}\bhistory\b/gi)) return reject('history_assurance');
  }
  if (hasAffirmativeMatch(reply, /\byou (?:are (?:covered|insured|eligible|qualified)|qualify|can (?:certainly|definitely) rent|can rent for certain)\b|(?:אתה|את|אתם|אתן) (?:מכוסה|מכוסית|מכוסים|זכאי|זכאים)|בוודאות (?:תוכל|תוכלו) לשכור/gi)) return reject('eligibility');
  // Age itself is not approval: eligibility depends on the insurance cover and
  // vehicle group and is confirmed before booking (approved age_licence fact).
  if (hasAffirmativeMatch(reply, /(?:גיל|בגיל)\s*\d{2}\s*(?:הוא|זה)?\s*(?:מצוין|לגמרי בסדר|בסדר גמור|בסדר|תקין|לא בעיה|ממש לא בעיה)|אין (?:שום )?בעיה (?:עם|בגלל) (?:ה)?גיל|אין (?:הגבלת|מגבלת) גיל(?: עליונה| מקסימלית)?|\bno (?:upper|maximum|max) age(?: limit)?\b|\bthere is no (?:upper |maximum )?age limit\b|(?:אפשר|ניתן) לשכור כל עוד יש רישיון|\bage \d{2} is (?:fine|perfectly fine|no problem|not a problem|ok(?:ay)?)\b|\b(?:no|not a) problem (?:with|at) (?:that|his|her|your) age\b|\bcan rent as long as (?:he|she|you|they) (?:has|have) a valid licen[cs]e\b/gi)) return reject('eligibility');
  if (/licen[cs]e|international permit|\bIDP\b|רישיון|רשיון|בינלאומי/i.test(input)) {
    const licenceAssurance = [...reply.matchAll(/licen[cs]e[^.!?\n]{0,90}(?:accepted|sufficient|enough|fine|valid here|no problem|ok(?:ay)?\b|works)|רישיון[^.!?\n]{0,60}(?:מספיק|מתקבל|בסדר|תקין|מתאים|אין בעיה)/gi)];
    if (licenceAssurance.some(match => !/\bnot\b|cannot|can['’]?t|may not|whether|must be|needs to be|לא|האם|עשוי/i.test(match[0])
      && !/cannot confirm|can['’]?t confirm|do not confirm|whether|אין אישור|אי אפשר לאשר|לא ניתן לאשר/i.test(reply.slice(Math.max(0, match.index! - 60), match.index!)))) return reject('foreign_licence_assurance');
    const weakenedRequirements = [...reply.matchAll(/(?:\bIDP\b|international (?:driving )?permit|(?:official )?translation)[^.!?\n]{0,60}(?:helpful|useful|optional)|(?:היתר בינלאומי|רישיון בינלאומי|תרגום)[^.!?\n]{0,45}(?:יכול לעזור|כדאי|לא חובה)/gi)];
    if (weakenedRequirements.some(match => !/not\s+(?:(?:merely|just)\s+)?(?:helpful|useful|optional)|isn['’]?t optional|אינו רק|לא רק/i.test(match[0]))) return reject('foreign_document_requirement');
  }
  if (hasAffirmativeMatch(reply, /\b(?:everything|all (?:the |your )?(?:bags|luggage|equipment)) will fit\b|(?:הכול|כל הציוד|כל המזוודות) ייכנס/gi)) return reject('fit_assurance');
  if (hasAffirmativeMatch(reply, /\b(?:your|the|these|those)\s+(?:(?:one|two|three|four|five|\d+)\s+)?(?:bags|suitcases|luggage|stroller|child seat|equipment)\s+(?:will|can definitely|will definitely) fit\b|המזוודות (?:שלך |שלכם )?(?:ייכנסו|יתאימו)|העגלה (?:תיכנס|תתאים)/gi)) return reject('fit_assurance');
  if (hasAffirmativeMatch(reply, /\b(?:car|vehicle|seat) will fit (?:your|the|all)\b|(?:הרכב|הכיסא) יתאים בוודאות/gi)) return reject('fit_assurance');
  if (hasAffirmativeMatch(reply, /\b(?:we have (?:a |the )?(?:car|vehicle) available|(?:a car|the car|vehicle|it) is available (?:now|for|on)|available for (?:your|the) (?:dates|trip))\b|יש לנו רכב (?:פנוי|זמין)|הרכב (?:פנוי|זמין) (?:עכשיו|לתאריכים)/gi)) return reject('stock_assurance');
  // Published fees (airport surcharge, Shabbat) may not be denied.
  if (hasAffirmativeMatch(reply, /\bno (?:separate |extra |additional )?(?:public )?(?:branch |airport )?(?:fee|charge|surcharge)s?\b|\bfree of charge\b|\bat no (?:extra )?cost\b|(?:אין|ללא|בלי) (?:תוספת|עמלה|חיוב נוסף|תשלום נוסף)/giu)) return reject('fee_denial');
  if (hasAffirmativeMatch(reply, /\bin stock\b|יש במלאי|יש לנו (?:מבחר|מגוון|כמה|הרבה|רכבים)|\bwe (?:have|carry|offer) (?:a (?:wide |great |good )?(?:range|selection|variety)|several|plenty|many) (?:of )?(?:cars|vehicles|models|options)\b/giu)) return reject('stock_assurance');
  // The assistant can prepare a request for review, never reserve a car or
  // update a request that does not exist yet.
  // Owner rule: no rental price talk in model wording (amounts, ranges, cheaper/pricier claims).
  if (/(?:₪|ש["״]?ח|\bNIS\b|\bILS\b|shekels?)/iu.test(reply) && !/פיקדון|deposit|השתתפות|excess|budget|תקציב/iu.test(reply)) return reject('price_talk');
  if (hasAffirmativeMatch(reply, /(?:זול|יקר)(?:ה|ים|ות)? יותר|(?:יוצא|ייצא|יעלה)\s+(?:בערך|כ[־-]?|בסביבות)|\b(?:cheaper|more expensive|costs? (?:around|about|roughly))\b|\bper day (?:from|starting)\b/giu)) return reject('price_talk');
  if (/\bper day\b|ליום/u.test(reply) && /\d/.test(reply) && !/פיקדון|deposit|קילומטר|km/iu.test(reply)) return reject('price_talk');
  // Price is set in the quote; wording must not promise it in advance.
  if (hasAffirmativeMatch(reply, /(?:בלי|ללא) הפתעות|(?:ב|לפי )?(?:ה)?תעריף המקורי|אותו מחיר(?: ליום)?|המחיר (?:לא|אינו) ישתנה|\bno (?:price )?surprises\b|\b(?:the )?same (?:daily )?(?:rate|price)\b|\b(?:the )?original (?:daily )?rate\b|\bprice (?:will not|won['’]?t) change\b/giu)) return reject('price_assurance');
  // No booking exists in this chat; wording cannot say one was recorded or made.
  // Only application code hands off; a model promise that someone will call back is not a handoff.
  if (hasAffirmativeMatch(reply, /\bwill (?:finali[sz]e|complete|process|confirm) (?:the|your) (?:request|booking|reservation)\b|(?:ישלים|יסגור|יאשר) (?:את )?(?:ה)?(?:בקשה|הזמנה)/giu)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /(?<![\p{L}])ו?(?:יחזור|יחזרו|נחזור)\s+(?:אליכם|אליך|אלייך)\s+(?:עם|בהקדם|לגבי|בהמשך)|\b(?:will|'ll) (?:get back to you|be in touch) with\b/giu)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /(?<![\p{L}])(?:נעדכן|עדכנו|עדכנתי|שינינו|שיניתי|הזזנו|הזזתי)\s+(?:לכם\s+|לך\s+)?(?:את\s+)?(?:ה)?(?:בקשה|הזמנה|תאריכים|מועד)|\b(?:I(?:'ve| have)?|we(?:'ve| have)?|we'll|I'll) (?:updated?|changed?|moved?) (?:the|your) (?:request|booking|dates?)\b/giu)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /(?:רשמתי|רשמנו)\s+(?:לכם\s+|לך\s+)?(?:את\s+)?(?:ה)?(?:בקשה|הזמנה)|פתחנו את הבקשה|פתחתי (?:לך |לכם )?(?:את )?(?:ה)?בקשה|הבקשה נפתחה|\b(?:I(?:'ve| have)?|we(?:'ve| have)?) opened (?:a|the|your) request\b|רשמתי את ההזמנה|ההזמנה (?:נרשמה|נקלטה|בוצעה)|הזמנתי (?:לכם|לך)|\b(?:I(?:'ve| have)?|we(?:'ve| have)?) (?:booked|recorded (?:the|your) booking)\b|\byour booking (?:is|has been) (?:made|recorded|placed)\b/giu)) return reject('action_claim');
  // Only application code passes a case to a person; wording cannot announce it.
  if (hasAffirmativeMatch(reply, /(?:המערכת|הבוט)\s+(?:תעביר|יעביר|תשלח|ישלח)|(?<![\p{L}])(?:נעביר|אעביר|נשלח|אשלח)\s+את\s+(?:הבקשה|הפנייה|הפניה|הפרטים)|נציג\s+(?:יחזור|יתקשר)\s+(?:אליך|אליכם|אלייך)\s+(?:מחר|היום|בבוקר|בערב|תוך)|\b(?:the system|I|we)\s+will\s+(?:pass|forward|send)\b|\b(?:will|is going to) call you (?:back )?(?:tomorrow|today|this (?:morning|evening)|in the morning)\b/giu)) return reject('action_claim');
  if (/נשריין|לשריין|שנשריין|\b(?:reserve|hold) (?:the|a|your) car\b/iu.test(reply)) return reject('reservation_wording');
  // Whether a damaged rental can be driven is never a model judgement, and a
  // replacement car or tow is never arranged by wording alone.
  if (hasAffirmativeMatch(reply, /(?<!אי )(?<!לא )(?:אפשר|ניתן|מותר|תוכל(?:ו)?)\s+(?:להמשיך\s+)?(?:לנסוע|לנהוג)(?:\s+(?:בו|איתו|בזהירות|כרגיל))?|אין חובה (?:ל)?גרר|לא צריך גרר|\b(?:it['’]?s|it is) (?:safe|fine|ok(?:ay)?) to (?:drive|keep driving|continue)\b|\byou can (?:keep|continue|carry on) driving\b|\byou can (?:still )?drive (?:it|the car)\b|\bno (?:need for|need to call) a tow\b/gi)) return reject('driving_safety_assurance');
  if (hasAffirmativeMatch(reply, /(?:נתאם|נדאג|נספק|נשלח|נזמין)[^.!?\n]{0,40}(?:רכב חלופי|החלפת רכב|גרר)|\b(?:we(?:'ll| will)|let us)\s+(?:arrange|send|provide|organi[sz]e)\b[^.!?\n]{0,40}\b(?:replacement (?:car|vehicle)|tow)\b/gi)) return reject('arrangement_claim');

  // Numbers mentioned by a customer are not an approved quote. Published,
  // explicitly indicative policy amounts may be restated from approved facts.
  const priceClaim = /\b(?:price|rate|cost|monthly payment|deposit|excess)\s+(?:is|will be|comes to)\s*[^.!?]{0,15}\d|(?:המחיר|העלות|התשלום החודשי|הפיקדון)\s+(?:הוא|יהיה|יהיו)\s*[^.!?]{0,15}\d/i;
  if (priceClaim.test(reply)) {
    const factNumbers = new Set(numberTokens(approvedFacts.join(' ')));
    if (!/indicative|published|אינדיקטיבי|מפורסם/i.test(reply) || numberTokens(reply).some(token => !factNumbers.has(token))) return reject('price_assurance');
  }

  if (hasAffirmativeMatch(reply,
    /\b(?:(?:your|the|this)\s+)?(?:booking|reservation|rental)\s+(?:(?:is|was|has been|remains|stays|will remain|will stay)\s+)(?:(?:still|already|currently)\s+)?(?:active|valid|in effect|cancelled|canceled|extended)\b|ההזמנה(?:\s+(?:שלך|שלכם|הקיימת))?\s+(?:(?:עדיין|נשארת|נותרת|תישאר|היא)\s+){0,2}(?:פעילה|בתוקף|תקפה|מבוטלת|הוארכה|בוטלה)/gi,
    /\b(?:if|whether)\s*$|(?:לא ניתן|אי אפשר)\s+לאשר\s*(?:ש)?$|לא (?:ידוע|ברור)\s*(?:אם|ש)?$|(?:אם|האם)\s*$/i,
  )) return reject('transaction_status');
  if (hasAffirmativeMatch(reply, /\b(?:confirmed booking|booking is confirmed|car is confirmed|refund (?:has been|is) processed|refund is approved)\b|ההזמנה מאושרת|הרכב אושר|הזיכוי בוצע|ההחזר אושר/gi)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /\b(?:I|we)\s+(?:(?:have|already|will)\s+){0,2}(?:sent|send|submitted|submit|forwarded|forward|passed|pass|booked|reserved|refunded|cancelled|canceled|call|contact)\b|(?:שלחתי|שלחנו|העברתי|העברנו|הוזמן|שריינתי|ביטלתי|זיכיתי|אזמין|אעביר|נשלח את הפנייה)/gi)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /\b(?:request|enquiry|booking|refund|reservation) (?:has been|is|was) (?:sent|submitted|forwarded|passed|booked|processed|cancelled|canceled|confirmed|reserved)\b/gi)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /\b(?:request|enquiry|details|information)\s+will\s+be\s+(?:forwarded|sent|submitted|passed|processed|reviewed|changed|cancelled|canceled)\b|(?:הפרטים|הבקשה|הפנייה|הפניה)\s+(?:יועברו|תועבר|יישלחו|ישלחו|תישלח|תטופל)/gi)) return reject('action_claim');
  if (hasAffirmativeMatch(reply, /\b(?:(?:(?:a|the|our)\s+)?(?:SmartCar\s+)?representative(?:\s+(?:from|at)\s+SmartCar)?|our team) will (?:call|contact|follow up)\b|נציג(?:\s+(?:של\s+)?SmartCar|\s+שלנו)?\s+(?:יחזור|יתקשר|יצור קשר|ישמח לחזור)/gi)) return reject('action_claim');

  if (handoffDeferred && /(?:would you like|shall I|can I|should I|תרצ(?:ה|ו)|שאעביר).{0,100}(?:representative|team|pass|send|callback|נציג|צוות|פנייה)[^?؟]*[?؟]/i.test(reply)) return reject('handoff_deferred');
  if (handoffDeferred && /(?:would|should|can) (?:a|our|the) representative.{0,70}(?:call|contact|help)[^?؟]*[?؟]/i.test(reply)) return reject('handoff_deferred');

  const knownValue = (...keys: string[]) => keys.some(key => known[key] !== undefined && known[key] !== '');
  const savedAnnualMileage = Number(known.commercialAnnualMileageKm ?? known.annualMileageKm);
  // Wording may not claim a route or dates were recorded when application
  // state did not record them (observed: "Pickup and return … are set").
  const claimsRecorded = /\b(?:are|is) (?:now )?(?:set|saved|noted|recorded|booked|selected)\b|\b(?:I(?:'ve| have)?|we(?:'ve| have)?) (?:noted|saved|recorded|set|selected|chose|picked)\b|רשמתי|רשמנו|בחרנו|בחרתי|נרשמ(?:ו|ה)?|נשמר(?:ו|ה)?|קבענו|עדכנתי/iu;
  const mentionsRoute = /pick.?up|return|drop.?off|איסוף|לאסוף|החזרה|להחזיר/iu;
  const mentionsDates = /\bdates?\b|תאריכ/iu;
  for (const sentence of reply.split(/(?<=[.!?؟])\s+/u)) {
    if (!claimsRecorded.test(sentence) || /\bnot\b|לא |טרם|עדיין לא/iu.test(sentence)) continue;
    if (mentionsRoute.test(sentence) && !mentionsDates.test(sentence) && !knownValue('pickupLocation') && !knownValue('returnLocation')) return reject('unsaved_claim');
    if (/החזרה|להחזיר|\breturn\b|drop.?off/iu.test(sentence) && !knownValue('returnLocation') && !knownValue('returnDate')) return reject('unsaved_claim');
    if (/קבוצ|רכב משפחתי|משפחתית|קומפקט|SUV|רכב פנאי|vehicle|car group|family car|compact/iu.test(sentence) && /בחרנו|בחרתי|chose|selected|picked|רשמנו|רשמתי|noted|saved/iu.test(sentence) && !knownValue('vehicleNeed')) return reject('unsaved_claim');
    if (/איסוף|לאסוף|pick.?up/iu.test(sentence) && !knownValue('pickupLocation') && !knownValue('pickupDate')) return reject('unsaved_claim');
    if (mentionsDates.test(sentence) && !knownValue('pickupDate') && !knownValue('returnDate')) return reject('unsaved_claim');
  }
  const comparedMileage = /\bcompare|\bversus|\bvs\b|להשוות|השוואה|לעומת|מול/i.test(input) ? annualMileageMentions(input) : [];
  if (Number.isFinite(savedAnnualMileage) && savedAnnualMileage > 0
    && annualMileageMentions(reply).some(value => value !== savedAnnualMileage && !comparedMileage.includes(value))) return reject('mileage_conflict');
  const question = reply.match(/[^.!?؟]*[?؟]/g)?.at(-1) ?? '';
  if (/(?:what time|at what hour).{0,65}(?:pick.?up|return|collect|drop.?off)|(?:pick.?up|return|collection) time|באיז(?:ו|ה) שעה.{0,45}(?:איסוף|לאסוף|החזרה|להחזיר)|שעת (?:ה?איסוף|ה?החזרה)/i.test(question)) return reject('unneeded_time');
  if (knownValue('pickupDate') && /what (?:is |would be )?(?:the |your )?pick.?up date|when.{0,30}pick.?up|(?:what|which).{0,25}date.{0,40}(?:pick.?up|collect)|(?:באיזה|לאיזה|איזה).{0,15}תאריך.{0,45}(?:איסוף|לאסוף)|תאריך האיסוף/i.test(question)) return reject('known_pickup_date');
  if (knownValue('returnDate') && /what (?:is |would be )?(?:the |your )?return date|when.{0,30}return|(?:what|which).{0,25}date.{0,40}(?:return|drop.?off)|(?:באיזה|לאיזה|איזה).{0,15}תאריך.{0,45}(?:החזרה|להחזיר|תחזיר)|תאריך ההחזרה/i.test(question)) return reject('known_return_date');
  const asksDates = /what dates|which dates|(?:check|choose|pick|select|decide|settle)(?:[^.!?\n]{0,35})\bdates?\b|(?:what|which|specific) week|plan[^.!?\n]{0,35}(?:a |specific )?week|what (?:are )?(?:the |your )?(?:pick.?up|return) dates|באילו תאריכים|לאילו תאריכים|באיזה שבוע|(?:לבדוק|נבדוק|לבחור|נבחר|לקבוע|נקבע|לסגור|נסגור).{0,30}תאריכ|מתי.{0,30}(?:לאסוף|להחזיר)/i.test(question);
  if (asksDates && (knownValue('pickupDate') && knownValue('returnDate') || hasUndecidedRentalDates(input) || /undecided/i.test(String(known.datePreference ?? '')) || hasUndecidedRentalDates(String(known.datePreference ?? '')))) return reject('known_or_undecided_dates');
  if (knownValue('pickupLocation') && /where.{0,35}pick(?:\s+(?:it|the car))?[\s-]*up|which branch.{0,40}pick|מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף|(?:באיזה|איזה|מאיזה)\s+סניף.{0,45}(?:לאסוף|תאסוף|איסוף)/i.test(question)) return reject('known_pickup_location');
  if (knownValue('returnLocation') && /where.{0,35}(?:return|drop.?off)|איפה.{0,30}להחזיר/i.test(question)) return reject('known_return_location');
  if (knownValue('passengers') && /how many (?:people|passengers|travellers)|כמה (?:אנשים|נוסעים)/i.test(question)) return reject('known_passengers');
  if (knownValue('luggage') && /how many (?:bags|suitcases)|כמה מזוודות/i.test(question)) return reject('known_luggage');
  if (knownValue('driverAgeRange') && /what.{0,25}age group|what.{0,25}driver.{0,10}age|how old|קבוצת הגיל|טווח (?:ה)?גיל(?:אים|ים)?|גיל הנהג|בן כמה/i.test(question)) return reject('known_age');
  if (knownValue('customerName', 'customerNameProvided') && /what name|your name|על איזה שם|מה שמך|להוסיף.{0,15}(?:שם|שמך)|(?:לוודא|למסור|לציין|לאשר).{0,20}(?:שמך|שם מלא)|(?:provide|confirm|verify).{0,20}name/i.test(question)) return reject('known_name');
  if (knownValue('vehicleNeed', 'vehiclePreference', 'commercialVehiclePreference') && /what (?:kind|type) of (?:car|vehicle).{0,35}(?:need|want|like)|איזה סוג רכב.{0,30}(?:תרצ|צריך|רוצים)/i.test(question)) return reject('known_vehicle');
  const asksCommercialTerm = /how long.{0,35}(?:need|lease|term|use)|what.{0,25}(?:term|duration|period)|לכמה זמן|(?:מה|איזו?|כמה).{0,15}(?:תקופ|משך)/i.test(question);
  if (knownValue('commercialTermMonths', 'termMonths') && asksCommercialTerm) return reject('known_term');
  if (known.commercialInterest === 'sale' && asksCommercialTerm) return reject('sale_term');
  if (knownValue('commercialBudget') && /what.{0,35}budget|budget.{0,25}(?:range|prefer|consider)|איזה תקציב|מה.{0,20}(?:התקציב|מסגרת התקציב)|טווח תקציב/i.test(question)) return reject('known_budget');
  if (knownValue('commercialAnnualMileageKm', 'annualMileageKm') && /how many.{0,25}(?:kilometres|kilometers|km)|annual mileage|כמה.{0,15}(?:קילומטר|קמ|ק״מ)/i.test(question)) return reject('known_mileage');
  if (args.bookingPhase && args.nextMissingField && /shall we start|would you like to start|שנתחיל בקשה|נתחיל בקשה/i.test(question)) return reject('repeat_proceed');
  if (args.bookingPhase && args.nextMissingField && /(?:would you like|do you want|shall we|should we|can we|ready to)[^.!?\n]{0,65}(?:proceed|continue|set(?:ting)? up|open|start)[^.!?\n]{0,75}(?:request|booking|reservation)|(?:תרצ(?:ה|ו)|רוצ(?:ה|ים)|אפשר|האם|שנמשיך|שנתקדם)[^.!?\n]{0,55}(?:להתקדם|נתקדם|להמשיך|לפתוח|להתחיל)[^.!?\n]{0,55}(?:בקשה|הזמנה)|(?:נתקדם|נמשיך|נפתח)[^.!?\n]{0,35}(?:בקשה|הזמנה)/i.test(question)) return reject('repeat_proceed');
  return reply;
}
