/**
 * Car advice without Gemini: "מה מומלץ למשפחה של 5 עם 4 מזוודות?",
 * "מה ההבדל בין ג׳יפון לרכב 7 מקומות?", "מה יותר חסכוני בדלק?".
 *
 * Plain, general guidance about car categories (never a price, a model's
 * availability or a promise); the booking question follows as usual.
 */

export type AdvisorLocale = 'he' | 'en';
type Needs = { passengers?: number; luggage?: number; childSeats?: number; tripNeeds?: string };

const ASKS_ADVICE = /מה (?:מומלץ|מתאים|כדאי|הכי טוב|אתה ממליץ|תמליץ)|איזה (?:רכב|אוטו|סוג)(?: הכי)? (?:מתאים|כדאי|מומלץ|עדיף)|מה עדיף|תמליץ|תמליצו|תייעץ|ממליץ לי|what (?:do you|would you) (?:recommend|suggest)|which (?:car|one|type)(?: is| would be)? (?:best|better|suit|right)|what car (?:should|would)|recommend/i;
const COMPARES = /ההבדל(?: \S+){0,2} בין|הבדל(?: \S+){0,2} בין|לעומת|מה יותר (?:נוח|מרווח|חסכוני|טוב)|מה (?:יותר )?חסכוני|מה צורך פחות|difference between|vs\.?|versus|which is (?:roomier|bigger|cheaper to run|more economical|better)|more economical|better on fuel/i;

const CATEGORY_WORDS: Array<[RegExp, string]> = [
  [/7 מקומות|שבעה|ואן|מיניואן|7.?seater|minivan|van/i, 'VAN'],
  [/ג[׳']?יפון|ג[׳']?יפ|suv|קרוסאובר|crossover/i, 'SUV'],
  [/משפחתי|סדאן|sedan|family car/i, 'SEDAN'],
  [/קטן|מיני|חסכוני|small|economy|compact/i, 'ECONOMY_COMPACT'],
  [/יוקרה|luxury|premium/i, 'LUXURY'],
];

const ABOUT: Record<string, { he: string; en: string }> = {
  VAN: { he: 'רכב 7 מקומות — שלוש שורות ישיבה, הכי מרווח, ותא מטען גדול כשהשורה השלישית מקופלת. צורך יותר דלק מרכב רגיל.', en: 'a 7-seater — three rows, the roomiest, with a big boot when the third row is folded. It uses more fuel than a regular car.' },
  SUV: { he: 'ג׳יפון — 5 מקומות, ישיבה גבוהה ונוחה, תא מטען בינוני־גדול, נעים לנסיעות ארוכות ולעליות.', en: 'an SUV — 5 seats, a high comfortable seating position, a medium-to-large boot, pleasant for long drives and hills.' },
  SEDAN: { he: 'רכב משפחתי — 5 מקומות, נוח וחסכוני יחסית, תא מטען טוב לכמה מזוודות.', en: 'a family car — 5 seats, comfortable and fairly economical, with room for a few suitcases.' },
  ECONOMY_COMPACT: { he: 'רכב קטן — הכי חסכוני בדלק והכי קל לחנייה בעיר, מתאים לשניים־שלושה עם מעט מטען.', en: 'a small car — the most economical and easiest to park in town, right for two or three people with little luggage.' },
  LUXURY: { he: 'רכב יוקרה — הכי מפנק ושקט, לאירוע או לנסיעה מיוחדת.', en: 'a luxury car — the most comfortable and quiet, for an occasion or a special trip.' },
};

/** The category that fits the group and their luggage best, with the reason in a few words. */
function recommend(needs: Needs, text: string, locale: AdvisorLocale) {
  const people = needs.passengers ?? 0;
  const bags = needs.luggage ?? 0;
  const stroller = /עגלה|עגלת|stroller|pram|buggy/i.test(text) || /stroller/i.test(needs.tripNeeds ?? '');
  const hills = /צפון|גליל|גולן|רמת הגולן|ים המלח|מדבר|נגב|אילת|north|galilee|golan|dead sea|desert/i.test(text);
  const he = locale === 'he';
  if (people >= 6 || (people >= 5 && (bags >= 3 || stroller))) {
    return he
      ? `ל־${people} אנשים${bags ? ` עם ${bags} מזוודות` : ''}${stroller ? ' ועגלה' : ''} הייתי הולך על רכב 7 מקומות — יש מקום לכולם וגם תא מטען אמיתי. ג׳יפון יכול להספיק רק אם המטען קטן.`
      : `For ${people} people${bags ? ` with ${bags} suitcases` : ''}${stroller ? ' and a stroller' : ''} I'd go for a 7-seater — room for everyone plus a real boot. An SUV only works if the luggage is light.`;
  }
  if (people >= 4 || bags >= 3 || hills) {
    return he
      ? `${people ? `ל־${people} אנשים` : 'לנסיעה כזאת'}${hills ? ' ולדרכים של הצפון' : ''} ג׳יפון או רכב משפחתי יהיו הכי נוחים. ג׳יפון גבוה ונעים יותר בעליות; משפחתי חסכוני יותר בדלק.`
      : `${people ? `For ${people} people` : 'For a trip like this'}${hills ? ' and hilly roads' : ''}, an SUV or a family car is the most comfortable. The SUV sits higher and handles hills more pleasantly; the family car is lighter on fuel.`;
  }
  if (people && people <= 2) {
    return he ? 'לשניים רכב קטן מספיק לגמרי — הכי חסכוני וקל לחנייה. אם יש הרבה מזוודות, משפחתי ייתן יותר מקום.' : 'For two, a small car is plenty — the most economical and easy to park. With a lot of luggage, a family car gives more room.';
  }
  return null;
}

const RENT_OR_NOT = /שווה (?:בכלל )?לשכור|כדאי (?:בכלל )?לשכור|(?:או|לעומת) (?:לקחת |לנסוע ב)?מוניות|או מונית|או תחבורה ציבורית|בכלל צריך רכב|worth renting|(?:or|vs) (?:take |taking )?(?:taxis|a taxi|cabs|uber)|need a car at all/i;
const PARKING = /חני(?:ה|יה)|חנייה|לחנות|parking|park the car/i;

/** Advice for a question about which car fits, or how car types compare. Null when the message is not that. */
export function carAdvice(text: string, needs: Needs & { vehiclePreference?: string }, locale: AdvisorLocale): string | null {
  const he = locale === 'he';
  // "לא בטוח אם בכלל שווה לשכור או לקחת מוניות": honest advice, not a booking form.
  if (RENT_OR_NOT.test(text)) {
    return he
      ? 'תלוי בתוכנית: אם רוב הזמן אתה בתוך העיר, מוניות ותחבורה ציבורית בדרך כלל נוחות יותר — החנייה בתל אביב יקרה ולא תמיד קל למצוא. רכב משתלם כשיש נסיעות מחוץ לעיר, ואפשר גם לשכור רק ליום אחד לנסיעה כזאת. יש נסיעה כזאת בתוכנית?'
      : "It depends on the plan: if you're mostly in the city, taxis and public transport are usually easier — parking in Tel Aviv is expensive and hard to find. A car pays off for trips out of town, and you can rent for just one day for that. Is there a trip like that in the plan?";
  }
  // "ואם אני רוצה רק יום אחד לנסוע לים המלח?"
  if (/(?:רק |ל)?יום אחד|ליום (?:אחד|בודד)|just (?:for )?(?:one|a) day|for (?:one|a single) day|only one day/i.test(text) && /[?？]|אפשר|can i|possible/i.test(text)) {
    return he
      ? 'בטח, אפשר לשכור גם ליום אחד 🙂 לנסיעת יום כזאת רכב משפחתי או ג׳יפון יהיו הכי נוחים. לאיזה יום?'
      : 'Sure, you can rent for a single day too 🙂 For a day trip like that a family car or an SUV is the most comfortable. Which day?';
  }
  if (PARKING.test(text) && /[?？]/.test(text)) {
    return he
      ? 'בתל אביב ובמרכז הערים החנייה יקרה ולא תמיד זמינה; כדאי לבדוק אם במלון או במקום האירוע יש חנייה. מחוץ למרכז זה הרבה יותר פשוט.'
      : 'In Tel Aviv and city centres parking is expensive and not always available; check whether your hotel or venue has parking. Outside the centre it is much easier.';
  }
  // "יש לנו 4 מזוודות ועגלה": new luggage details before a car was chosen update the suggestion.
  if (!needs.vehiclePreference && /מזווד|עגלה|עגלת|suitcase|luggage|bags|stroller|pram/i.test(text) && !/[?？]/.test(text)) {
    const advice = recommend(needs, text, locale);
    if (advice) return he ? `רשמתי. ${advice}` : `Noted. ${advice}`;
  }
  if (COMPARES.test(text)) {
    const mentioned = CATEGORY_WORDS.filter(([pattern]) => pattern.test(text)).map(([, category]) => category);
    if (/חסכוני|דלק|צורך|economical|fuel|cheaper to run/i.test(text) && mentioned.length < 2) {
      return he
        ? 'הכי חסכוני בדלק זה רכב קטן, ואחריו משפחתי. ג׳יפון ו־7 מקומות צורכים יותר, וההבדל מורגש בנסיעות ארוכות. אצלנו המדיניות היא מלא־מלא — מקבלים מלא ומחזירים מלא.'
        : 'The most economical is a small car, then a family car. SUVs and 7-seaters use more, and it shows on long drives. Our policy is full-to-full — you get it full and return it full.';
    }
    if (mentioned.length >= 2) {
      const [a, b] = mentioned;
      return he ? `${ABOUT[a].he}\n${ABOUT[b].he}` : `${ABOUT[a].en[0].toUpperCase()}${ABOUT[a].en.slice(1)}\n${ABOUT[b].en[0].toUpperCase()}${ABOUT[b].en.slice(1)}`;
    }
  }
  if (ASKS_ADVICE.test(text)) {
    const advice = recommend(needs, text, locale);
    if (advice) return advice;
    return he
      ? 'בשמחה. כמה תהיו, וכמה מזוודות בערך? ככה אמליץ על הרכב שהכי יתאים.'
      : 'Happy to. How many of you will there be, and roughly how many suitcases? Then I can suggest the right car.';
  }
  return null;
}
