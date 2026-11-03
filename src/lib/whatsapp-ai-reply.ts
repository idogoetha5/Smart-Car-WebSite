/**
 * A bounded check for conversational drafts, not a proof of factual grounding.
 * The model receives approved facts; these checks catch recognizable unsafe
 * output and state conflicts. Only application code may execute actions.
 */
export type ConversationalReplyInput = {
  reply: string;
  input: string;
  locale: 'he' | 'en';
  known: Record<string, string | number | undefined>;
  approvedFacts: string[];
  handoffDeferred: boolean;
  bookingPhase: boolean;
  nextMissingField?: string;
};

function numberTokens(text: string): string[] {
  return (text.match(/\d+(?:[,.]\d+)*/g) ?? []).map(value => value.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/^0+(?=\d)/, ''));
}

function hasAffirmativeMatch(text: string, pattern: RegExp): boolean {
  for (const match of text.matchAll(pattern)) {
    const prefix = text.slice(Math.max(0, match.index! - 55), match.index);
    if (/(?:cannot|can['’]?t|do not|don['’]?t)\s+(?:guarantee|promise|confirm|say)\s+(?:that\s+)?$|whether\s*$|אי אפשר (?:להבטיח|לאשר)\s*(?:ש)?$/i.test(prefix)) continue;
    if (/(?:\bnot|\bnever|\bno|\bcannot|\bcan['’]?t|\bisn['’]?t|\baren['’]?t|לא|אינו|אינה|איננו|אין)\s+(?:(?:be|been|being|already|yet|necessarily|a|the|כבר|עדיין|בהכרח)\s+){0,3}$/i.test(prefix)) continue;
    return true;
  }
  return false;
}

export function validateConversationalReply(args: ConversationalReplyInput): string | null {
  const { input, locale, known, approvedFacts, handoffDeferred } = args;
  const reply = args.reply?.trim();
  if (!reply || reply.length > 650 || (reply.match(/[?؟]/g) ?? []).length > 1) return null;
  if (locale === 'he' && !/[א-ת]/.test(reply) || locale === 'en' && (/[א-ת]/.test(reply) || !/[A-Za-z]/.test(reply))) return null;
  if (/[\u0600-\u06ff]/u.test(reply)) return null;
  if (/@|https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(reply)) return null;
  if (/(?<!\d)(?:\+\d{1,3}[ ()-]*|0[2-9])[\d ()-]{7,}/.test(reply)) return null;
  if (/system prompt|backend|internal (?:workflow|system|process)|language model|Gemini|הנחיות המערכת|תהליך פנימי|המודל|אין לי גישה/i.test(reply)) return null;
  if (/\b(?:taxi|taxis|bus|buses|train|uber|avis|hertz|sixt|eldan)\b|מונית|מוניות|אוטובוס|רכבת|אוויס|הרץ|סיקסט|אלדן/i.test(reply)) return null;
  if (/\b(?:I am|I'm|as)\s+(?:a |an )?(?:bot|AI|artificial intelligence|digital assistant)\b|\b(?:I am|I'm).{0,25}\b(?:bot|AI|digital assistant)\b|אני (?:בוט|רובוט|ה?עוזר ה?דיגיטלי|בינה מלאכותית)/i.test(reply)) return null;

  // Private collection belongs to the controlled intake, never a model draft.
  // Match requests rather than mere mentions, so protective reminders remain useful.
  if (hasAffirmativeMatch(reply, /\b(?:send|provide|share|enter|upload|give|confirm|need|require|collect)\b[^.!?\n]{0,90}\b(?:(?:all |the |your )*passengers?['’]? names?|names? of (?:all |the )?passengers|(?:identity|identification|ID) numbers?|(?:full |complete )?(?:credit |payment )?card (?:number|details)|security code|CVV|CVC|(?:driver['’]?s? |driving )?licen[cs]e (?:copy|copies|photo)|(?:a |your |customer )?email(?: address)?)\b|(?:שלח(?:ו|י)?|ספק(?:ו|י)?|העל(?:ו|י)?|מסור|מסרו|צריך|צריכים|נדרש|לאשר)[^.!?\n]{0,80}(?:שמות (?:כל )?(?:הנוסעים|נוסעים)|מספר(?:י)? (?:תעודת זהות|זהות)|פרטי (?:כרטיס|האשראי)|מספר (?:כרטיס|האשראי)|קוד אבטחה|צילום (?:רישיון|רשיון)|(?:כתובת )?(?:מייל|דוא[״"]?ל))/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:send|provide|share|upload|need|require)\b[^.!?\n]{0,40}\b(?:copy|photo|scan) of (?:your |the |a )?(?:driver['’]?s? |driving )?licen[cs]e\b/gi)) return null;
  if (/\bwhat (?:are|is)\b[^.!?\n]{0,45}\b(?:passengers?['’]? names?|names? of (?:all |the )?passengers|identity number|ID number|card number|security code|CVV|email address)\b|מה(?:ם|י)?[^.!?\n]{0,30}(?:שמות (?:כל )?הנוסעים|מספר תעודת הזהות|מספר האשראי|כתובת המייל)/i.test(reply)) return null;

  const allowedNumbers = new Set(numberTokens([input, ...Object.values(known).filter(value => value !== undefined).map(String), ...approvedFacts].join(' ')));
  if (numberTokens(reply).some(token => !allowedNumbers.has(token))) return null;

  // Negative or conditional discussion is useful advice. Positive assurances
  // about a transaction, stock, personal cover or physical fit are not.
  if (hasAffirmativeMatch(reply, /\b(?:guaranteed|definitely fits?|certainly fits?|fully covered|eligible to rent)\b|מובטח(?:ת)?|בוודאות יתאים|בהחלט ייכנס|מכוסה בוודאות/gi)) return null;
  if (hasAffirmativeMatch(reply, /\byou (?:are (?:covered|insured|eligible|qualified)|qualify|can (?:certainly|definitely) rent|can rent for certain)\b|(?:אתה|את|אתם|אתן) (?:מכוסה|מכוסית|מכוסים|זכאי|זכאים)|בוודאות (?:תוכל|תוכלו) לשכור/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:everything|all (?:the |your )?(?:bags|luggage|equipment)) will fit\b|(?:הכול|כל הציוד|כל המזוודות) ייכנס/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:your|the|these|those)\s+(?:(?:one|two|three|four|five|\d+)\s+)?(?:bags|suitcases|luggage|stroller|child seat|equipment)\s+(?:will|can definitely|will definitely) fit\b|המזוודות (?:שלך |שלכם )?(?:ייכנסו|יתאימו)|העגלה (?:תיכנס|תתאים)/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:car|vehicle|seat) will fit (?:your|the|all)\b|(?:הרכב|הכיסא) יתאים בוודאות/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:we have (?:a |the )?(?:car|vehicle) available|(?:a car|the car|vehicle|it) is available (?:now|for|on)|available for (?:your|the) (?:dates|trip))\b|יש לנו רכב (?:פנוי|זמין)|הרכב (?:פנוי|זמין) (?:עכשיו|לתאריכים)/gi)) return null;
  if (hasAffirmativeMatch(reply, /\bin stock\b|יש במלאי/gi)) return null;

  // Numbers mentioned by a customer are not an approved quote. Published,
  // explicitly indicative policy amounts may be restated from approved facts.
  const priceClaim = /\b(?:price|rate|cost|monthly payment|deposit|excess)\s+(?:is|will be|comes to)\s*[^.!?]{0,15}\d|(?:המחיר|העלות|התשלום החודשי|הפיקדון)\s+(?:הוא|יהיה|יהיו)\s*[^.!?]{0,15}\d/i;
  if (priceClaim.test(reply)) {
    const factNumbers = new Set(numberTokens(approvedFacts.join(' ')));
    if (!/indicative|published|אינדיקטיבי|מפורסם/i.test(reply) || numberTokens(reply).some(token => !factNumbers.has(token))) return null;
  }

  if (hasAffirmativeMatch(reply, /\b(?:confirmed booking|booking is confirmed|car is confirmed|refund (?:has been|is) processed|refund is approved)\b|ההזמנה מאושרת|הרכב אושר|הזיכוי בוצע|ההחזר אושר/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:I|we)\s+(?:(?:have|already|will)\s+){0,2}(?:sent|send|submitted|submit|forwarded|forward|passed|pass|booked|reserved|refunded|cancelled|canceled|call|contact)\b|(?:שלחתי|שלחנו|העברתי|העברנו|הוזמן|שריינתי|ביטלתי|זיכיתי|אזמין|אעביר|נשלח את הפנייה)/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:request|enquiry|booking|refund|reservation) (?:has been|is|was) (?:sent|submitted|forwarded|passed|booked|processed|cancelled|canceled|confirmed|reserved)\b/gi)) return null;
  if (hasAffirmativeMatch(reply, /\b(?:(?:a |the )?representative|our team) will (?:call|contact|follow up)\b|נציג (?:יחזור|יתקשר|יצור קשר)/gi)) return null;

  if (handoffDeferred && /(?:would you like|shall I|can I|should I|תרצ(?:ה|ו)|שאעביר).{0,100}(?:representative|team|pass|send|callback|נציג|צוות|פנייה)[^?؟]*[?؟]/i.test(reply)) return null;
  if (handoffDeferred && /(?:would|should|can) (?:a|our|the) representative.{0,70}(?:call|contact|help)[^?؟]*[?؟]/i.test(reply)) return null;

  const knownValue = (...keys: string[]) => keys.some(key => known[key] !== undefined && known[key] !== '');
  const question = reply.match(/[^.!?؟]*[?؟]/g)?.at(-1) ?? '';
  if (/(?:what time|at what hour).{0,65}(?:pick.?up|return|collect|drop.?off)|(?:pick.?up|return|collection) time|באיז(?:ו|ה) שעה.{0,45}(?:איסוף|לאסוף|החזרה|להחזיר)|שעת (?:ה?איסוף|ה?החזרה)/i.test(question)) return null;
  if (knownValue('pickupDate') && /what (?:is |would be )?(?:the |your )?pick.?up date|when.{0,30}pick.?up|באיזה תאריך.{0,25}לאסוף|תאריך האיסוף/i.test(question)) return null;
  if (knownValue('returnDate') && /what (?:is |would be )?(?:the |your )?return date|when.{0,30}return|באיזה תאריך.{0,25}תחזיר|תאריך ההחזרה/i.test(question)) return null;
  const asksDates = /what dates|which dates|what (?:are )?(?:the |your )?(?:pick.?up|return) dates|באילו תאריכים|לאילו תאריכים|מתי.{0,30}(?:לאסוף|להחזיר)/i.test(question);
  if (asksDates && (knownValue('pickupDate') && knownValue('returnDate') || /(?:do not|don't) know.{0,25}dates|no dates yet|not (?:chosen|decided).{0,20}dates|לא יודע.{0,15}תאריכ|אין.{0,15}תאריכ|undecided/i.test(`${input} ${known.datePreference ?? ''}`))) return null;
  if (knownValue('pickupLocation') && /where.{0,35}pick.?up|מאיפה.{0,30}לאסוף|איפה.{0,30}לאסוף/i.test(question)) return null;
  if (knownValue('returnLocation') && /where.{0,35}(?:return|drop.?off)|איפה.{0,30}להחזיר/i.test(question)) return null;
  if (knownValue('passengers') && /how many (?:people|passengers|travellers)|כמה (?:אנשים|נוסעים)/i.test(question)) return null;
  if (knownValue('luggage') && /how many (?:bags|suitcases)|כמה מזוודות/i.test(question)) return null;
  if (knownValue('driverAgeRange') && /what.{0,25}age group|what.{0,25}driver.{0,10}age|how old|קבוצת הגיל|גיל הנהג|בן כמה/i.test(question)) return null;
  if (knownValue('customerName') && /what name|your name|על איזה שם|מה שמך/i.test(question)) return null;
  if (knownValue('vehicleNeed', 'vehiclePreference', 'commercialVehiclePreference') && /what (?:kind|type) of (?:car|vehicle).{0,35}(?:need|want|like)|איזה סוג רכב.{0,30}(?:תרצ|צריך|רוצים)/i.test(question)) return null;
  if (knownValue('commercialTermMonths', 'termMonths') && /how long.{0,35}(?:need|lease|term)|what term|לכמה זמן|מה התקופה/i.test(question)) return null;
  if (knownValue('commercialAnnualMileageKm', 'annualMileageKm') && /how many.{0,25}(?:kilometres|kilometers|km)|annual mileage|כמה.{0,15}(?:קילומטר|קמ|ק״מ)/i.test(question)) return null;
  if (args.bookingPhase && args.nextMissingField && /shall we start|would you like to start|שנתחיל בקשה|נתחיל בקשה/i.test(question)) return null;
  return reply;
}
