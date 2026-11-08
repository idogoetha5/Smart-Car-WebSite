/** Non-contact proposals only. Validation never changes canonical conversation state. */
export const FACT_FIELDS = ['rentalPickupBranch', 'rentalReturnBranch', 'rentalVehicleCategory', 'rentalPassengers', 'rentalLuggage', 'rentalChildSeats', 'commercialBudget', 'commercialTermMonths', 'commercialAnnualMileageKm', 'commercialVehiclePreference'] as const;
export type FactField = typeof FACT_FIELDS[number];
export type FactBranch = 'herzliya' | 'telaviv' | 'jerusalem' | 'airport';
export type FactCategory = 'compact' | 'family' | 'suv' | 'seven_seat';
export type FactMoney = { amount: number; currency: 'ILS' | 'USD' | 'EUR' | 'unspecified' };
type FactValues = {
  rentalPickupBranch: FactBranch; rentalReturnBranch: FactBranch; rentalVehicleCategory: FactCategory; rentalPassengers: number; rentalLuggage: number; rentalChildSeats: number;
  commercialBudget: FactMoney; commercialTermMonths: number; commercialAnnualMileageKm: number; commercialVehiclePreference: FactCategory;
};
export type FactPatch = { [F in FactField]: { field: F; evidence: string; stance: 'selected' } & ({ operation: 'set'; value: FactValues[F] } | { operation: 'undecided' | 'remove'; value?: never }) }[FactField];

/** Embed as an optional provider-output property; actions and identity fields are absent. */
export const FACT_PATCH_SCHEMA = {
  type: 'array', maxItems: 16, items: {
    type: 'object', additionalProperties: false,
    properties: {
      field: { type: 'string', enum: FACT_FIELDS }, operation: { type: 'string', enum: ['set', 'undecided', 'remove'] },
      stance: { type: 'string', enum: ['selected', 'hypothetical', 'discussion'] }, evidence: { type: 'string', maxLength: 180 },
      // A uniform object avoids an untyped string or provider-dependent union schema.
      value: { type: 'object', additionalProperties: false, properties: {
        branch: { type: 'string', enum: ['herzliya', 'telaviv', 'jerusalem', 'airport'] },
        number: { type: 'number' }, category: { type: 'string', enum: ['compact', 'family', 'suv', 'seven_seat'] },
        currency: { type: 'string', enum: ['ILS', 'USD', 'EUR', 'unspecified'] },
      } },
    }, required: ['field', 'operation', 'stance', 'evidence'],
  },
} as const;

const words: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  אפס: 0, אחד: 1, אחת: 1, שני: 2, שתי: 2, שניים: 2, שתיים: 2, שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4,
  חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10,
  עשרים: 20, שלושים: 30, ארבעים: 40, חמישים: 50, שישים: 60, ששים: 60, שבעים: 70, שמונים: 80, תשעים: 90,
};
const numberWord = Object.keys(words).sort((a, b) => b.length - a.length).join('|');
const numericPattern = new RegExp(`(?<![\\p{L}\\d])(?:\\d{1,3}(?:[, ]\\d{3})+|\\d+(?:\\.\\d+)?|(?:${numberWord})(?:[- ](?:and )?(?:ו)?(?:${numberWord}))?)(?:\\s*(?:thousand|אלף|אלפים|k\\b))?(?![\\p{L}\\d])`, 'giu');

/** Bounded numeric provenance, not a general language-number interpreter. */
export function factEvidenceNumbers(text: string): number[] {
  const result: number[] = [];
  for (const match of text.matchAll(numericPattern)) {
    const scaled = /thousand|אלף|אלפים|k$/iu.test(match[0]);
    const base = match[0].replace(/thousand|אלפים|אלף|k$/giu, '').trim();
    const value = /^\d/u.test(base) ? Number(base.replace(/[, ]/gu, ''))
      : base.toLowerCase().split(/[- ]+/u).filter(x => x !== 'and').reduce((sum, token) => sum + (words[token] ?? words[token.replace(/^ו/u, '')] ?? NaN), 0);
    if (Number.isFinite(value)) result.push(value * (scaled ? 1000 : 1));
  }
  if (/שנתיים/u.test(text)) result.push(2);
  if (/חודשיים/u.test(text)) result.push(2);
  return result;
}

const privateEvidence = /@|\+\d[\d ()-]{7,}|(?<!\d)0[2-9][\d ()-]{7,}|\d{12,}|my name is|קוראים לי|שמי|רחוב|\bstreet\b/iu;
const hypothetical = /\b(?:if|maybe|perhaps|might|would(?!\s+like\b)|could|considering|suppose|hypothetical)\b|(?:^|\s)(?:אם|אולי|ייתכן|יתכן|שוקל|שוקלת|נניח)(?:\s|$)/iu;
const discussion = /\b(?:what about|how about|compare|which is|what is the difference)\b|מה לגבי|מה ההבדל|להשוות/iu;
// Only an actual antecedent scopes the next comma clause. Considering a
// product is a complete tentative statement, not a condition on later facts.
const commaAntecedent = /^\s*(?:(?:and|but)\s+)?(?:if|suppose)\b|^\s*ו?(?:אם|נניח)(?:\s|$)|^\s*(?:maybe|perhaps|אולי)\s*$/iu;
const uncertainty = /\b(?:undecided|unsure|not sure|not decided|haven['’]?t decided|no preference)\b|לא (?:החלטתי|החלטנו|בטוח|בטוחה|סגור|סגורה|יודע|יודעת)|אין לי העדפה/iu;
const negation = /\b(?:not|never|no longer|don['’]?t|do not|won['’]?t|will not|rather than|instead of)\b|(?:^|\s)(?:לא|בלי|ללא|במקום)(?:\s|$)/iu;
const removal = /\b(?:remove|forget|clear|discard|no longer|don['’]?t keep|do not keep)\b|תמחק|מחק|להסיר|אל תשמור|לא לשמור|אין (?:לי|לנו) יותר/iu;
const branchPatterns: Record<FactBranch, RegExp> = { herzliya: /herzliya|הרצליה/iu, telaviv: /tel[ -]?aviv|תל אביב/iu, jerusalem: /jerusalem|ירושלים/iu, airport: /airport|ben gurion|נתב[״"']?ג|נמל התעופה/iu };
const categoryPatterns: Record<FactCategory, RegExp> = {
  compact: /compact|small(?: car)?|קומפקט|קטן|קטנה/iu,
  family: /family(?: car)?|משפחתי|משפחתית/iu,
  suv: /\bsuv\b|רכב פנאי|ג[׳'י]?יפ/iu,
  seven_seat: /seven[- ]seat|7[- ]seat|שבעה מקומות|7\s*מקומות/iu,
};
// Capacity discussion describes the car, not the customer's travelling group.
const capacityQuestion = /\b(?:can|does|will|could|would)\b[^.!?]{0,65}\b(?:fit|seat|hold|accommodate)\b|(?:האם|אפשר)[^.!?]{0,55}(?:נכנס|ייכנס|יכנס|מכיל|להכניס|להסיע)/iu;
function hasVehicleCategoryRole(category: FactCategory, evidence: string, clause: string): boolean {
  const pattern = new RegExp(categoryPatterns[category].source, 'giu');
  let evidenceStart = clause.indexOf(evidence);
  while (evidenceStart >= 0) {
    for (const match of evidence.matchAll(pattern)) {
      const start = evidenceStart + match.index!;
      const before = clause.slice(0, start);
      const after = clause.slice(start + match[0].length);
      // English adjective-before-noun and Hebrew noun-before-adjective agree
      // with luggage/children rather than a vehicle category.
      if (/^\s+(?:travel\s+)?(?:bags?|suitcases?|luggage|children|kids)\b/iu.test(after)
        || /(?:מזווד(?:ה|ות)|תיק(?:ים)?|ילד(?:ה|ים|ות)?)\s*$/u.test(before)) continue;
      return true;
    }
    evidenceStart = clause.indexOf(evidence, evidenceStart + 1);
  }
  return false;
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

/** The surrounding clause matters even when a model quotes only the number.
 * Adversative boundaries allow a later definite correction after a hypothetical.
 * Ambiguous compound clauses are rejected rather than guessed. */
function evidenceContext(message: string, evidence: string, accept: (clause: string) => boolean = () => true): { clause: string; index: number } | undefined {
  const boundaries = /(?<!\d),|,(?!\d)|،|[!?;\n]|\.(?!\d)|\bbut\b|\bactually\b|אבל|בעצם/giu;
  let start = 0;
  let conditionalPrefix = '';
  let found: { clause: string; index: number } | undefined;
  for (const match of [...message.matchAll(boundaries), { index: message.length, 0: '' }]) {
    if (match.index === 0 && match[0]) continue;
    const end = match.index!;
    const clause = message.slice(start, end);
    const index = clause.lastIndexOf(evidence);
    const comma = /^[,،]$/u.test(match[0]);
    // A trailing uncertainty qualifier still qualifies the preceding assertion.
    // A tentative adjustment ('maybe less') does not erase an explicit base fact.
    const following = comma ? message.slice(end + match[0].length).split(/[!?;.\n,،]/u)[0] : '';
    const guardedClause = `${conditionalPrefix}${clause}${uncertainty.test(following) ? `, ${following}` : ''}`;
    if (index >= 0 && accept(guardedClause)) found = { clause: guardedClause, index: start + index };
    conditionalPrefix = comma && (conditionalPrefix || commaAntecedent.test(clause)) ? `${conditionalPrefix}${clause}, ` : '';
    start = end + match[0].length;
  }
  return found;
}
/** Exact current evidence plus its containing clause, for deterministic candidate
 * extractors. False also covers absent/private evidence; use this only for set
 * candidates, never to suppress an explicit undecided/remove operation. */
export function isSelectedFactEvidence(message: string, evidence: string): boolean {
  if (!evidence.trim() || evidence.length > 180 || privateEvidence.test(evidence)) return false;
  return Boolean(evidenceContext(message, evidence, clause => !privateEvidence.test(clause) && !hypothetical.test(clause)
    && !negation.test(clause) && !uncertainty.test(clause) && !discussion.test(clause)));
}

/** A narrower guard for callers separately handling uncertainty and negation. */
export function isHypotheticalFactEvidence(message: string, evidence: string): boolean {
  return !evidenceContext(message, evidence, clause => !hypothetical.test(clause))
    && Boolean(evidenceContext(message, evidence, clause => hypothetical.test(clause)));
}

/** A capacity question is not a declared party or luggage count. This guard is
 * shared with local fallback parsing, which never sends its input externally. */
export function isRentalCapacityQuestionEvidence(message: string, evidence: string): boolean {
  return !evidenceContext(message, evidence, clause => !capacityQuestion.test(clause))
    && Boolean(evidenceContext(message, evidence, clause => capacityQuestion.test(clause)));
}

function supports(field: FactField, text: string): boolean {
  if (field === 'rentalPickupBranch' || field === 'rentalReturnBranch') return Object.values(branchPatterns).some(pattern => pattern.test(text)) || /return there|same (?:place|location|branch)|להחזיר שם|נחזיר שם|אותו מקום/iu.test(text);
  if (field === 'commercialBudget') return /budget|spend|afford|shekel|dollar|euro|\b(?:ILS|NIS|USD|EUR)\b|[₪$€]|תקציב|שקל|ש[״"׳']ח/iu.test(text);
  if (field === 'commercialTermMonths') return /\bmonths?\b|\byears?\b|\bterm\b|duration|תקופה|משך|חודש|שנים|שנה|שנתיים/iu.test(text);
  if (field === 'commercialAnnualMileageKm') return /\b(?:km|kilomet(?:er|re)s?)\b|קילומטר|ק[״"]מ|קמ|annual mileage|קילומטראז/iu.test(text);
  if (field === 'rentalPassengers') return /passenger|people|travell?ers?|adults?|נוסע|אנשים|מבוגרים|נהיה/iu.test(text);
  if (field === 'rentalLuggage') return /bags?|suitcases?|luggage|מזווד|תיק/iu.test(text);
  if (field === 'rentalChildSeats') return /child seats?|car seats?|booster|כיסא|כיסאות|מושב בטיחות/iu.test(text);
  return Object.values(categoryPatterns).some(pattern => pattern.test(text));
}
function currency(text: string): FactMoney['currency'] {
  if (/שקל|ש[״"׳']ח|₪|shekel|\b(?:ILS|NIS)\b/iu.test(text)) return 'ILS';
  if (/dollar|\bUSD\b|\$/iu.test(text)) return 'USD';
  if (/euro|\bEUR\b|€/iu.test(text)) return 'EUR';
  return 'unspecified';
}

/** Accepts only the schema's uniform value objects. Latest supported occurrence
 * wins per field; output order follows the message, never model array order. */
export function validateFactPatches(raw: unknown, message: string): FactPatch[] {
  if (!Array.isArray(raw) || raw.length > 16 || message.length > 4000) return [];
  const accepted = new Map<FactField, { patch: FactPatch; index: number }>();
  for (const item of raw) {
    if (!object(item) || Object.keys(item).some(key => !['field', 'operation', 'stance', 'evidence', 'value'].includes(key))) continue;
    const { field, operation, stance, evidence, value } = item;
    if (!FACT_FIELDS.includes(field as FactField) || stance !== 'selected' || !['set', 'undecided', 'remove'].includes(String(operation))
      || typeof evidence !== 'string' || !evidence.trim() || evidence.length > 180 || privateEvidence.test(evidence)) continue;
    const context = evidenceContext(message, evidence, clause => !hypothetical.test(clause) && !privateEvidence.test(clause)
      && (operation !== 'set' || !negation.test(clause) && !uncertainty.test(clause) && !discussion.test(clause)));
    if (!context || hypothetical.test(context.clause) || privateEvidence.test(context.clause)) continue;
    const name = field as FactField;
    // The evidence itself must name the kind of fact, so an unrelated number
    // elsewhere in a clause cannot support a forged field/value pair.
    if (!supports(name, evidence)) continue;
    let patch: FactPatch | undefined;
    if (operation !== 'set') {
      if (value !== undefined || (operation === 'undecided' ? !uncertainty.test(context.clause) : !removal.test(context.clause))) continue;
      patch = { field: name, operation: operation as 'undecided' | 'remove', stance, evidence };
    } else {
      if (negation.test(context.clause) || uncertainty.test(context.clause) || discussion.test(context.clause) || !object(value)
        || Object.keys(value).some(key => !['number', 'category', 'currency', 'branch'].includes(key))) continue;
      if (['rentalVehicleCategory', 'rentalPassengers', 'rentalLuggage', 'rentalChildSeats'].includes(name) && capacityQuestion.test(context.clause)) continue;
      if (name === 'rentalPickupBranch' || name === 'rentalReturnBranch') {
        if (value.number !== undefined || value.category !== undefined || value.currency !== undefined || typeof value.branch !== 'string' || !Object.hasOwn(branchPatterns, value.branch)) continue;
        const branch = value.branch as FactBranch;
        if (Object.values(branchPatterns).filter(pattern => pattern.test(evidence)).length > 1) continue;
        const pickupRole = /pick[ -]?up|collect|from|איסוף|לאסוף|מהרצליה|מתל אביב|מירושלים|מנתב/iu.test(evidence);
        const returnRole = /return|drop[ -]?off|להחזיר|נחזיר|החזרה/iu.test(evidence);
        const sameReturn = /return there|same (?:place|location|branch)|להחזיר שם|נחזיר שם|אותו מקום/iu.test(evidence);
        const direct = branchPatterns[branch].test(evidence);
        if (name === 'rentalPickupBranch' ? !direct || !pickupRole : !returnRole || !(direct || sameReturn && branchPatterns[branch].test(context.clause) && /from|pick[ -]?up|collect|מהרצליה|מתל אביב|מירושלים|מנתב/iu.test(context.clause))) continue;
        patch = { field: name, operation: 'set', stance, evidence, value: branch };
      } else if (name === 'rentalVehicleCategory' || name === 'commercialVehiclePreference') {
        if (value.branch !== undefined || value.number !== undefined || value.currency !== undefined || typeof value.category !== 'string'
          || !Object.hasOwn(categoryPatterns, value.category) || !hasVehicleCategoryRole(value.category as FactCategory, evidence, context.clause)) continue;
        // A comparison is discussion even when the provider labels it selected.
        if (/\bor\b|\bvs\b|versus|או|מול/iu.test(context.clause)) continue;
        patch = { field: name, operation: 'set', stance, evidence, value: value.category as FactCategory };
      } else {
        const number = value.number;
        const bounds: Record<string, [number, number]> = { commercialBudget: [100, 10000000], commercialTermMonths: [1, 120], commercialAnnualMileageKm: [1, 200000], rentalPassengers: [1, 20], rentalLuggage: [0, 20], rentalChildSeats: [0, 20] };
        if (typeof number !== 'number' || !Number.isFinite(number) || number < bounds[name][0] || number > bounds[name][1]
          || name !== 'commercialBudget' && !Number.isInteger(number) || value.category !== undefined || value.branch !== undefined) continue;
        let stated = factEvidenceNumbers(evidence);
        if (name === 'commercialTermMonths' && /\byears?\b|שנים|שנה|שנתיים/iu.test(evidence)) stated = stated.map(n => n * 12);
        if (stated.length !== 1 || !stated.includes(number)) continue;
        if (name === 'commercialAnnualMileageKm' && !/annual|per year|a year|annually|שנתי|לשנה|בשנה/iu.test(context.clause)) continue;
        if (name === 'commercialBudget') {
          const unit = currency(evidence);
          if (value.currency !== unit) continue;
          patch = { field: name, operation: 'set', stance, evidence, value: { amount: number, currency: unit } };
        } else {
          if (value.currency !== undefined) continue;
          patch = { field: name, operation: 'set', stance, evidence, value: number };
        }
      }
    }
    if (patch && (!accepted.has(name) || context.index >= accepted.get(name)!.index)) accepted.set(name, { patch, index: context.index });
  }
  return [...accepted.values()].sort((a, b) => a.index - b.index).map(item => item.patch);
}
