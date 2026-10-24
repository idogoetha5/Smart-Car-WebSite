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
  VAN: { he: 'רכב 7 מקומות נותן יותר מושבים, אבל כשכולם בשימוש נפח המטען עלול להיות מוגבל. צריך להתאים את הדגם גם למזוודות.', en: 'a 7-seater provides more seats, but luggage space may be limited with every seat in use. The specific model must also fit the bags.' },
  SUV: { he: 'ג׳יפון מציע לרוב ישיבה גבוהה יותר. מספר המושבים, מרחב המטען וצריכת הדלק תלויים בדגם, ולא בשם הקטגוריה.', en: 'an SUV usually offers a higher seating position. Seating, luggage space and fuel use depend on the model, not the category name.' },
  SEDAN: { he: 'רכב משפחתי יכול להתאים לנסיעות עם נוסעים ומטען; כדאי לבדוק את נפח תא המטען והתאמתו לציוד שלך בדגם המסוים.', en: 'a family car can suit passenger trips with luggage; check the actual boot space and whether your equipment fits the specific model.' },
  ECONOMY_COMPACT: { he: 'רכב קטן עשוי להתאים לעיר ולמעט מטען. את החיסכון בדלק צריך לבדוק לפי הדגם וסוג ההנעה.', en: 'a small car may suit city driving with light luggage. Fuel economy still needs checking by model and powertrain.' },
  LUXURY: { he: 'קטגוריית יוקרה מתמקדת בחוויית הנסיעה והאבזור, אבל אין להסיק ממנה אבזור מסוים לפני בדיקת הדגם.', en: 'a luxury category focuses on comfort and equipment, but specific features must be checked for the actual model.' },
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
      ? `ל־${people} אנשים${bags ? ` עם ${bags} מזוודות` : ''}${stroller ? ' ועגלה' : ''} כדאי לבדוק רכב עם מספיק מושבים וגם מקום למטען כשהמושבים בשימוש. 7 מקומות לא מבטיחים שהמזוודות ייכנסו; צריך להתאים דגם ומספר מושבים לצורך.`
      : `For ${people} people${bags ? ` with ${bags} suitcases` : ''}${stroller ? ' and a stroller' : ''}, check both seating and boot space with those seats in use. A 7-seater does not guarantee enough luggage space; the actual model and seating capacity must fit the group.`;
  }
  if (people >= 4 || bags >= 3 || hills) {
    return he
      ? `${people ? `ל־${people} אנשים` : 'לנסיעה כזאת'} אפשר להשוות משפחתית וג׳יפון לפי מקום לנוסעים ולמטען. ישיבה גבוהה לא מבטיחה ביצועים טובים יותר בעליות, וצריכת הדלק תלויה בדגם ובהנעה.`
      : `${people ? `For ${people} people` : 'For a trip like this'}, compare a family car and an SUV by passenger and luggage space. A higher seating position does not guarantee better hill performance, and fuel use depends on the model and powertrain.`;
  }
  if (people && people <= 2) {
    return he ? 'לשניים עם מעט מטען אפשר להתחיל מרכב קטן. אם יש מזוודות גדולות או ציוד, כדאי לוודא שהוא נכנס לפני שבוחרים קטגוריה.' : 'For two with light luggage, a small car is a reasonable starting point. With large bags or equipment, check that everything fits before choosing a category.';
  }
  return null;
}

/** Explicit research is not consent to start collecting a booking. */
export function isExploringRental(text: string): boolean {
  return /מתלבט|מתלבטים|רק מתעניין|רק מתעניינת|לפני שמחליט|מה חשוב לבדוק|עוד לא להזמין|(?:עוד |עדיין )?לא (?:רוצים|רוצה|מוכנים|מוכן) להזמין|בלי להזמין|before deciding|not ready|no booking yet|just exploring|what should I check/i.test(text);
}

const RENT_OR_NOT = /שווה (?:בכלל )?לשכור|כדאי (?:בכלל )?לשכור|(?:או|לעומת) (?:לקחת |לנסוע ב)?מוניות|או מונית|או תחבורה ציבורית|בכלל צריך רכב|worth renting|(?:or|vs) (?:take |taking )?(?:taxis|a taxi|cabs|uber)|need a car at all/i;
const PARKING = /חני(?:ה|יה)|חנייה|לחנות|parking|park the car/i;

/** Advice for a question about which car fits, or how car types compare. Null when the message is not that. */
export function carAdvice(text: string, needs: Needs & { vehiclePreference?: string }, locale: AdvisorLocale): string | null {
  const he = locale === 'he';
  // Explain the requested comparison rather than treating a keyword as a sales slot.
  if (/(?:פיקדון|deposit)/i.test(text) && /השתתפות עצמית|excess|deductible/i.test(text)
    && /הבדל|לעומת|difference|versus|compare|\bvs\b/i.test(text)) {
    return he
      ? 'פיקדון הוא סכום שנחסם או נגבה כבטוחה לפי ההסכם. השתתפות עצמית היא החלק שהשוכר עשוי לשאת בו במקרה שמכוסה בתנאי הכיסוי. אלה לא אותו דבר: הפיקדון אינו בהכרח תקרת האחריות, והשתתפות עצמית לא מבטיחה שכל נזק מכוסה. כדי להשוות הצעות, בדוק את סכום הבטוחה, תנאי השחרור, הכיסוי, החריגים והאחריות בכל מקרה.'
      : 'A deposit is security held or collected under the agreement. An excess is the amount the renter may be responsible for in a case covered by the agreed cover. They are different: the deposit is not necessarily the liability limit, and an excess does not mean every type of damage is covered. Compare the security amount, release terms, cover, exclusions and liability in each case.';
  }
  if (isExploringRental(text) && /כיסא בטיחות|כסא בטיחות|child seat|car seat/i.test(text)
    && /משלנו|שלנו|own|already have/i.test(text)) {
    return he
      ? 'אם אתם מביאים כיסא משלכם, כדאי להשוות לפי התאמת הכיסא וההתקנה לרכב המסוים, מקום לעגלה ולציוד, ונוחות הכנסת התינוק. אפשר לצמצם כיוון לפי הצרכים האלה בלי לבחור דגם או להתחיל הזמנה. בהמשך צריך לאמת את ההתאמה בפועל, ולא להסתמך רק על שם הקטגוריה.'
      : 'With your own child seat, compare compatibility and installation in the actual car, room for the stroller and bags, and ease of getting the baby in. You can narrow the options without selecting a model or starting a booking. Actual compatibility still needs checking; the category name alone is not enough.';
  }
  if (isExploringRental(text) && /licen[cs]e|Canadian|tourist|visiting|רישיון זר|תייר/i.test(text)) {
    return he
      ? 'לפני שמחליטים, כדאי לבדוק את תנאי הרישיון והוותק לנהג בפועל, המסמכים הנדרשים, אמצעי התשלום והפיקדון. בהצעה חשוב לבדוק גם כיסוי, השתתפות עצמית, קילומטרים והחזרה. רישיון זר לבדו לא מספיק כדי לאשר זכאות; התנאים תלויים במסמכים ובספק.'
      : 'Before deciding, check the licence and driving-experience requirements for the actual driver, required documents, payment method and deposit. Compare cover, excess, mileage and return terms too. A Canadian licence alone does not establish eligibility; the documents and supplier requirements still need checking.';
  }
  // A comparison is advice, not evidence that either category was selected.
  const familyAndSuv = /משפחתי|sedan|family car/i.test(text) && /ג[׳']?יפון|ג[׳']?יפ|suv|קרוסאובר/i.test(text);
  if (familyAndSuv && /מתלבט|עדיף|הבדל|לעומת|compare|between|better|difference|versus|\bvs\b/i.test(text)) {
    const hasBaby = /תינוק|תינוקת|baby|infant/i.test(text);
    const hasStroller = /עגלה|עגלת|stroller|pram/i.test(text);
    return he
      ? `${hasBaby ? 'עם תינוק' : 'בבחירה הזאת'}${hasStroller ? ' ועגלה' : ''}, משפחתית יכולה להספיק; ג׳יפון מציע לרוב ישיבה גבוהה יותר. המקום למטען וצריכת הדלק תלויים בדגם, ולכן לא כדאי לבחור רק לפי הקטגוריה.${hasStroller ? ' כדאי לוודא שהעגלה והציוד נכנסים יחד לתא המטען.' : ''}`
      : `A family car may be enough${hasBaby ? ' with a baby' : ''}; an SUV usually offers a higher seating position. Luggage space and fuel use depend on the actual model, so category alone is not enough.${hasStroller ? ' Check that the stroller and luggage fit together.' : ''}`;
  }
  // "לא בטוח אם בכלל שווה לשכור או לקחת מוניות": honest advice, not a booking form.
  if (RENT_OR_NOT.test(text) || /מתלבט(?:ים)? אם בכלל לשכור/i.test(text)) {
    return he
      ? 'כדאי להשוות את העלות הכוללת של השכרה — כולל כיסוי, דלק וחניה — מול חלופות שמתאימות לכם. עם תינוק חשוב לבדוק גם מושב בטיחות מתאים בכל חלופה, ועם עגלה לוודא שיש מקום לציוד. בלי המחירים והסידורים האלה אי אפשר לקבוע מה משתלם יותר.'
      : 'Compare the full rental cost, including cover, fuel and parking, with alternatives that fit your journeys. With a baby, check a suitable child seat in every option; with a stroller, check luggage space too. Without those costs and arrangements, I cannot say which option is better value.';
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
        ? 'צריכת הדלק תלויה בדגם, בסוג המנוע ובנסיעה. רכב קטן עשוי להיות חסכוני, אבל אי אפשר לקבוע שמשפחתית תמיד חסכונית יותר מג׳יפון — למשל כשמשווים הנעות שונות. בין אילו דגמים אתה מתלבט?'
        : 'Fuel use depends on the model, powertrain and journey. A small car may be economical, but a family car is not always more efficient than an SUV, especially with different powertrains. Which models are you comparing?';
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
      ? needs.passengers ? 'כמה מזוודות תביאו?' : 'כמה נוסעים תהיו?'
      : needs.passengers ? 'How many suitcases will you bring?' : 'How many passengers will there be?';
  }
  return null;
}
