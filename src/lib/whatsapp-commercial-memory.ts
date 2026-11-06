/** Explicit, non-contact commercial facts survive the short conversational window.
 * No raw messages or free-text notes are retained here. Null means undecided. */
export type CommercialMemory = {
  budget?: { amount: number; currency: 'ILS' | 'USD' | 'EUR' | 'unspecified' };
  termMonths?: number | null;
  annualMileageKm?: number | null;
  vehiclePreference?: 'compact' | 'family' | 'suv' | 'seven_seat' | null;
  usage?: Array<'city' | 'family' | 'business' | 'long_distance'>;
  passengers?: number;
  luggage?: number;
  lowMileagePreferred?: boolean;
};

const NUMBER = '(?<!\\d)(\\d{1,3}(?:[, ]\\d{3})+|\\d{1,7}(?:\\.\\d+)?)(?!\\d)';
const amount = (value: string, scale?: string) => Number(value.replace(/[, ]/g, '')) * (scale ? 1000 : 1);

/** Recognisable annual-mileage assertions, including model-written thousands.
 * Deliberately scoped to annual units so published daily/monthly limits remain
 * usable in the same reply. This is not general semantic number validation. */
export function annualMileageMentions(text: string): number[] {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, אחד: 1, שני: 2, שניים: 2, שתי: 2, שלושה: 3, שלושת: 3, ארבעה: 4, ארבעת: 4, חמישה: 5, חמשת: 5, שישה: 6, ששת: 6, שבעה: 7, שבעת: 7, שמונה: 8, שמונת: 8, תשעה: 9, תשעת: 9, עשרה: 10, עשרת: 10, 'אחד עשר': 11, 'שנים עשר': 12, 'שתים עשרה': 12, 'חמישה עשר': 15, עשרים: 20 };
  const wordPattern = Object.keys(words).sort((a, b) => b.length - a.length).join('|');
  const numeric = '(\\d{1,3}(?:[, ]\\d{3})+|\\d{1,7})\\s*(אלף|אלפי|אלפים|thousand|k\\b)?';
  const written = `(${wordPattern})\\s+(אלף|אלפי|אלפים|thousand)`;
  const units = '(?:קילומטר(?:ים)?|ק[״"]מ|קמ|km|kilometres?|kilometers?)\\s*(?:לשנה|בשנה|per year|a year|annually|/\\s*(?:year|yr))';
  const pattern = new RegExp(`(?<![\\p{L}\\d])(?:ל)?(?:${numeric}|${written})\\s*${units}`, 'giu');
  return [...text.matchAll(pattern)].map(match => match[3] ? words[match[3].toLowerCase()] * 1000 : amount(match[1], match[2]));
}
function negatedBefore(text: string, index: number) {
  return /(?:\bnot|\binstead of|\brather than|ולא|לא|במקום)\s*$/i.test(text.slice(Math.max(0, index - 25), index));
}

function termChoicePrefix(text: string, index: number): { chosen: boolean; hypothetical: boolean } {
  const prefix = text.slice(Math.max(0, index - 70), index);
  const verb = '(?:נבחר|בחרתי|בחרנו|החלטתי על|החלטנו על|נלך על|choose|chosen|decided on|make it|go with|settled on)';
  return {
    chosen: new RegExp(`${verb}\\s*$`, 'iu').test(prefix),
    hypothetical: new RegExp(`(?:\\bif\\b|\\bmaybe\\b|\\bnot\\b|don['’]?t|do not|אם|אולי|לא)[^.!?\\n]{0,30}${verb}\\s*$`, 'iu').test(prefix),
  };
}

export function updateCommercialMemory(previous: CommercialMemory | undefined, message: string): CommercialMemory {
  const next: CommercialMemory = structuredClone(previous ?? {});
  // Contact details cannot accidentally become budget, mileage or usage facts.
  const text = message.slice(0, 1000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?<!\d)(?:\+972|0[2-9])[\d ()-]{7,}/g, '');
  const budget = new RegExp(`(?:תקציב|budget)(?:\\s+(?:עכשיו|שלי|הוא|שלנו|של|עד|סביב|ירד|עלה|ל|is|now|of|up to|around|to|reduced|changed))*[ :₪$€־-]*${NUMBER}\\s*(אלף|thousand|k\\b)?`, 'giu');
  for (const match of text.matchAll(budget)) {
    if (negatedBefore(text, match.index!)) continue;
    const value = amount(match[1], match[2]);
    if (value < 100 || value > 10_000_000) continue;
    const nearby = text.slice(match.index!, match.index! + match[0].length + 20);
    const currency = /שקל|ש[״"׳']?ח|₪|shekel|\bILS\b|\bNIS\b/i.test(nearby) ? 'ILS'
      : /\$|dollar|\bUSD\b/i.test(nearby) ? 'USD' : /€|euro|\bEUR\b/i.test(nearby) ? 'EUR' : next.budget?.currency ?? 'unspecified';
    next.budget = { amount: value, currency };
  }
  const ceiling = new RegExp(`(?:עד|up to)\\s*${NUMBER}\\s*(אלף|thousand|k\\b)(?!\\s*(?:קמ|ק[״"]מ|km))`, 'giu');
  for (const match of text.matchAll(ceiling)) {
    if (!negatedBefore(text, match.index!)) next.budget = { amount: amount(match[1], match[2]), currency: next.budget?.currency ?? 'unspecified' };
  }
  // Currency-bearing amounts are also explicit budgets when called a limit or
  // a correction to a previously supplied budget, never arbitrary bare digits.
  if (!/תקציב|budget/i.test(text) && (next.budget || /עד|limit|spend|afford|בסביבות|סביב|בערך|\baround\b|\babout\b|\broughly\b/i.test(text))) {
    const money = new RegExp(`${NUMBER}\\s*(אלף|thousand|k(?=\\b|NIS|ILS|USD|EUR))?\\s*(שקל(?:ים)?|₪|shekels?|ILS|NIS|dollars?|USD|euros?|EUR)`, 'giu');
    for (const match of text.matchAll(money)) {
      const clause = text.slice(0, match.index!).split(/[.!?;]|[,،](?=\s)/u).at(-1) ?? '';
      const following = text.slice(match.index! + match[0].length, match.index! + match[0].length + 25);
      if (negatedBefore(text, match.index!)
        || /מחיר|הצעה|מחשבון|תשלום|\b(?:price|quote|offer|calculator|monthly)\b/i.test(clause)
        || /^\s*(?:לחודש|בחודש|per month|monthly)/i.test(following)) continue;
      const value = amount(match[1], match[2]);
      if (value >= 100 && value <= 10_000_000) next.budget = { amount: value, currency: /dollar|USD/i.test(match[3]) ? 'USD' : /euro|EUR/i.test(match[3]) ? 'EUR' : 'ILS' };
    }
  }

  const termMatches: Array<{ value: number; index: number }> = [];
  for (const match of text.matchAll(/(?:ל)?(שני|שניים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש|שישה|שש)\s+חודשים|(?:ל)?חודשיים/gu)) {
    if (negatedBefore(text, match.index!)) continue;
    const namedMonths: Record<string, number> = { שני: 2, שניים: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5, שישה: 6, שש: 6 };
    termMatches.push({ value: match[1] ? namedMonths[match[1]] : 2, index: match.index! });
  }
  const namedYears = text.match(/(?:ל)?(שלוש|ארבע|חמש)\s+שנים/u);
  if (namedYears && !negatedBefore(text, namedYears.index!)) termMatches.push({ value: ({ שלוש: 3, ארבע: 4, חמש: 5 }[namedYears[1]] ?? 0) * 12, index: namedYears.index! });
  for (const match of text.matchAll(/\b(\d{1,3}|one|two|three|four|five)\s*(months?|years?)\b|(\d{1,3})\s*(חודשים|חודש|שנים|שנה)|שנתיים|לשנה/giu)) {
    if (negatedBefore(text, match.index!) || termChoicePrefix(text, match.index!).hypothetical) continue;
    if (match[0] === 'לשנה' && /(?:קמ|ק[״"]מ|קילומטר(?:ים)?|km)\s*$/i.test(text.slice(Math.max(0, match.index! - 18), match.index!))) continue;
    const wordNumbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const number = match[1] ? wordNumbers[match[1].toLowerCase()] ?? Number(match[1]) : match[3] ? Number(match[3]) : /שנתיים/.test(match[0]) ? 2 : 1;
    const months = /year|שנ/i.test(match[2] ?? match[4] ?? match[0]) ? number * 12 : number;
    if (months >= 1 && months <= 120) termMatches.push({ value: months, index: match.index! });
  }
  const comparesTerms = /(?:\b24\b.{0,25}\b36\b|\b36\b.{0,25}\b24\b)/i.test(text)
    && (/months|חודשים|term|תקופה/i.test(text) || previous?.termMonths !== undefined) && /\bor\b|\bvs\b|\/|compare|between|unsure|undecided|או|מול|מתלבט/i.test(text);
  const termUndecided = /(?:term|תקופה|משך).{0,30}(?:undecided|not decided|not sure|לא החלטתי|לא סגור)|(?:לא החלטתי|לא סגור|not decided).{0,25}(?:term|תקופה)/i.test(text)
    || comparesTerms && /unsure|undecided|not sure|haven'?t decided|changed my mind|מתלבט|לא החלטתי|לא בטוח|שיניתי את דעתי/i.test(text);
  const eligibleTermMatches = termMatches.filter(match => !termChoicePrefix(text, match.index).hypothetical);
  const explicitChoice = eligibleTermMatches.filter(match => termChoicePrefix(text, match.index).chosen).sort((a, b) => a.index - b.index).at(-1);
  const laterUncertainty = explicitChoice && /(?:unsure|undecided|not sure|מתלבט|לא החלטתי)[^.!?\n]{0,45}(?:24[^.!?\n]{0,30}36|36[^.!?\n]{0,30}24|duration|period|תקופה|משך)/i.test(text.slice(explicitChoice.index));
  // An explicit choice wins over an unrelated “or” in a price question.
  if (explicitChoice) next.termMonths = laterUncertainty ? null : explicitChoice.value;
  else if (comparesTerms) {
    if (previous?.termMonths === undefined || termUndecided) next.termMonths = null;
  }
  else if (eligibleTermMatches.length) next.termMonths = eligibleTermMatches.sort((a, b) => a.index - b.index).at(-1)!.value;
  else if (termUndecided) next.termMonths = null;

  const annual = /לשנה|בשנה|שנתי|a year|per year|annually|annual/i.test(text);
  if (annual || previous?.annualMileageKm !== undefined) {
    const mileage = new RegExp(`${NUMBER}\\s*(אלף|thousand|k\\b)?\\s*(?:קילומטר(?:ים)?|ק[״"]מ|קמ|km|kilometres?|kilometers?)`, 'giu');
    for (const match of text.matchAll(mileage)) {
      if (negatedBefore(text, match.index!)) continue;
      const value = amount(match[1], match[2]);
      if (value > 0 && value <= 200000) next.annualMileageKm = value;
    }
    const labelledMileage = new RegExp(`(?:annual mileage|קילומטראז[׳']?\\s+שנתי)(?:\\s+(?:is|now|הוא|עכשיו))*[ :]*${NUMBER}`, 'giu');
    for (const match of text.matchAll(labelledMileage)) {
      if (negatedBefore(text, match.index!)) continue;
      const value = amount(match[1]);
      if (value > 0 && value <= 200000) next.annualMileageKm = value;
    }
  }
  if (/(?:לא יודע|לא בטוח|don't know|do not know|not sure).{0,35}(?:קילומ|קמ|ק״מ|mileage|km)/i.test(text)) next.annualMileageKm = null;

  // A preferred category (family/compact) can be known while the exact model
  // is still undecided. Only category-level uncertainty clears that preference.
  const categoryUncertainty = text
    .replace(/not (?:chosen|decided|sure).{0,30}(?:specific model|car model|vehicle model)/gi, '')
    .replace(/לא (?:בחרתי|בוחר|בוחרת|החלטתי|יודע).{0,20}דגם/gu, '');
  const vehicleUndecided = /לא (?:בחרתי|החלטתי|יודע).{0,25}(?:רכב|סוג)|אין לי העדפה(?!\s+ל?דגם)|not (?:chosen|decided|sure).{0,25}(?:car|vehicle)|no (?:vehicle )?preference|(?:keep|leave).{0,25}(?:car|vehicle).{0,15}open/i.test(categoryUncertainty);
  const comparesVehicles = /(?:קטן|קומפקט|compact|small).{0,40}(?:או|מול|\bor\b|versus|\bvs\b).{0,30}(?:משפחת|family)|(?:משפחת|family).{0,40}(?:או|מול|\bor\b|versus|\bvs\b).{0,30}(?:קטן|קומפקט|compact|small)/i.test(text);
  if (vehicleUndecided || comparesVehicles) next.vehiclePreference = null;
  else {
    const choice = text.match(/(?:מעדיף|בחרתי|החלטתי על|רוצה|מחפש|לקנות|prefer|choose|chosen|decided on|want|looking for|buy|purchase|keep|probably)\s+(?:a |the |את ה|רכב )?(?:משומש\s+)?(קומפקטי|קטן|משפחתי|משפחתית|פנאי|שבעה מקומות|compact(?: car)?|small(?: automatic| car)?|family(?: car)?|SUV|seven[- ]seat(?:er)?)/iu)
      ?? text.match(/(?:^|[,;.]\s*|ל)רכב\s+(?:משומש\s+)?(קומפקטי|קטן|משפחתי|משפחתית|פנאי|שבעה מקומות)/iu)
      ?? text.trim().match(/^(?:a |רכב )?(קומפקטי|קטן|משפחתי|משפחתית|פנאי|שבעה מקומות|compact(?: car)?|small(?: automatic| car)?|family(?: car)?|SUV|seven[- ]seat(?:er)?)[.!\s]*$/iu);
    if (choice && !negatedBefore(text, choice.index!) && !/\bif\b|\bmaybe\b|אולי|מה אם/i.test(text.slice(Math.max(0, choice.index! - 20), choice.index! + choice[0].length))) {
      next.vehiclePreference = /שבעה|seven/i.test(choice[1]) ? 'seven_seat' : /פנאי|SUV/i.test(choice[1]) ? 'suv' : /משפחת|family/i.test(choice[1]) ? 'family' : 'compact';
    }
  }
  const usage = new Set(next.usage ?? []);
  if (/בעיר|עירוני|\bcity\b|\burban\b/i.test(text)) usage.add('city');
  if (/למשפחה|שימוש משפחתי|family (?:use|trips)|with (?:my |our )?(?:kids|children)/i.test(text)) usage.add('family');
  if (/ל[עא]סק|עסקי|business (?:use|leasing)|for work/i.test(text)) usage.add('business');
  if (/נסיעות ארוכות|long.distance|long (?:trips|journeys)/i.test(text)) usage.add('long_distance');
  if (usage.size) next.usage = [...usage].slice(0, 4);
  const lowMileage = text.match(/חשוב(?: לי)? קילומטראז[׳']?\s+נמוך|מעדיף קילומטראז[׳']?\s+נמוך|low mileage (?:matters|is important|preferred)/i);
  if (lowMileage && !negatedBefore(text, lowMileage.index!)) next.lowMileagePreferred = true;
  for (const match of text.matchAll(/(\d{1,2})\s*(נוסעים|אנשים|passengers?|people|מזוודות|תיקים|bags?|suitcases?)/giu)) {
    if (negatedBefore(text, match.index!)) continue;
    const count = Number(match[1]);
    if (count > 0 && count <= 20) next[/נוסעים|אנשים|passenger|people/i.test(match[2]) ? 'passengers' : 'luggage'] = count;
  }
  if (/זוג (?:עם|ו)\s*שני ילדים|two adults and two children|two adults with two children/i.test(text)) next.passengers = 4;
  return next;
}

export function renderCommercialMemory(memory: CommercialMemory | undefined, locale: 'he' | 'en'): string {
  if (!memory) return locale === 'he' ? 'עדיין לא נשמרו העדפות מסחריות.' : 'No commercial preferences have been recorded yet.';
  const he = locale === 'he';
  const parts: string[] = [];
  if (memory.budget) parts.push(`${he ? 'תקציב' : 'Budget'}: ${memory.budget.amount} ${memory.budget.currency === 'unspecified' ? (he ? '(מטבע לא צוין)' : '(currency not stated)') : memory.budget.currency}`);
  if (memory.termMonths !== undefined) parts.push(`${he ? 'תקופה' : 'Term'}: ${memory.termMonths === null ? (he ? 'טרם הוחלט' : 'undecided') : `${memory.termMonths} ${he ? 'חודשים' : 'months'}`}`);
  if (memory.annualMileageKm !== undefined) parts.push(`${he ? 'קילומטראז׳ שנתי' : 'Annual mileage'}: ${memory.annualMileageKm === null ? (he ? 'טרם הוחלט' : 'undecided') : `${memory.annualMileageKm} km`}`);
  const names = he ? { compact: 'קומפקטי', family: 'משפחתי', suv: 'רכב פנאי', seven_seat: 'שבעה מקומות' } : { compact: 'compact', family: 'family', suv: 'SUV', seven_seat: 'seven-seat' };
  if (memory.vehiclePreference !== undefined) parts.push(`${he ? 'העדפת רכב' : 'Vehicle preference'}: ${memory.vehiclePreference === null ? (he ? 'פתוחה' : 'open') : names[memory.vehiclePreference]}`);
  if (memory.passengers !== undefined) parts.push(`${he ? 'נוסעים' : 'Passengers'}: ${memory.passengers}`);
  if (memory.luggage !== undefined) parts.push(`${he ? 'מזוודות' : 'Bags'}: ${memory.luggage}`);
  if (memory.lowMileagePreferred) parts.push(he ? 'העדפה לקילומטראז׳ נמוך' : 'low mileage preferred');
  if (memory.usage?.length) {
    const usageNames = he ? { city: 'עירוני', family: 'משפחתי', business: 'עסקי', long_distance: 'נסיעות ארוכות' } : { city: 'city', family: 'family', business: 'business', long_distance: 'long-distance' };
    parts.push(`${he ? 'שימוש' : 'Use'}: ${memory.usage.map(item => usageNames[item]).join(', ')}`);
  }
  return parts.length ? parts.join('; ') : he ? 'עדיין לא נשמרו העדפות מסחריות.' : 'No commercial preferences have been recorded yet.';
}
