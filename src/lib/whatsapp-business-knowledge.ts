import { BRANCHES } from '@/lib/branches';
import { DELIVERY_CITIES } from '@/lib/delivery-cities';
import { LEASING_DURATIONS, MILEAGE_PACKAGES, OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { brainQuestionTopic } from '@/lib/whatsapp-brain';
import { withoutNegated } from '@/lib/whatsapp-context';

type Locale = 'he' | 'en';

export type BusinessAnswer = { topic: string; reply: string; href: string; linkLabel: string };
type Entry = { topic: string; pattern: RegExp; he: string; en: string; href: string };

/** Source: published SmartCar pages. No industry assumptions or customer records. */
export const BUSINESS_KNOWLEDGE: Entry[] = [
  { topic: 'contact', pattern: /טלפון|מספר שלכם|להתקשר אליכם|אימייל|מייל שלכם|כתובת מייל|phone|telephone|email|e-mail|contact (?:you|details)|call you/i, href: '/contact',
    he: `אפשר ליצור קשר עם משרד SmartCar בטלפון ${OFFICE_PHONE} או במייל ${OFFICE_EMAIL}.`,
    en: `You can reach the SmartCar office on ${OFFICE_PHONE} or at ${OFFICE_EMAIL}.` },
  { topic: 'cdw', pattern: /cdw|damage waiver|ביטול השתתפות|הפחתת השתתפות/i, href: '/insurance',
    he: 'באתר מוצגת אפשרות לביטול השתתפות עצמית (CDW) בתוספת אינדיקטיבית של ₪45 ליום, לנזקי Type A בלבד ובכפוף לחוזה. אין בכך כיסוי לכל נזק: בין החריגים נזק מכוון, נהיגה תחת השפעה, נהג שלא נרשם ונזק לצמיגים, מראות, גג ותחתית ללא שדרוג מתאים. המחיר והתנאים הסופיים יאושרו בהצעה ובחוזה.',
    en: 'The website lists optional CDW at an indicative ₪45 per day for Type A damage, subject to the agreement. This is not cover for every kind of damage: exclusions include intentional damage, impaired driving, unlisted drivers, and tyres, mirrors, roof and underbody without the appropriate upgrade. Final price and conditions are confirmed in the quote and agreement.' },
  { topic: 'insurance_exclusions', pattern: /חריג|לא מכוסה|אינו מכוסה|צמיגים|מראות|תחתית|exclusions?|not covered|tyres|tires|mirrors|underbody/i, href: '/insurance',
    he: 'עמוד הביטוח מפרט חריגים, ובהם נהג שלא נרשם בחוזה, נהיגה תחת השפעה, שימוש מסחרי להסעת נוסעים בשכר, נסיעה בשטח לא סלול ויציאה מישראל ללא אישור כתוב מראש. גם CDW אינו מבטל את כל החריגים; צמיגים, גלגלים, מראות, גג ותחתית דורשים בדיקה של הכיסוי הספציפי בחוזה.',
    en: 'The insurance page lists exclusions including an unlisted driver, impaired driving, paid passenger transport, off-road driving and leaving Israel without advance written approval. CDW does not remove every exclusion; check the specific agreement for tyres, wheels, mirrors, roof and underbody.' },
  { topic: 'smoking', pattern: /עישון|לעשן|סיגרי|smok|cigarette/i, href: '/terms',
    he: 'אסור לעשן ברכב. לפי תנאי ההשכרה, ריח או נזק מעישון עשויים לגרור דמי ניקוי בסך ₪500 לפחות. חיוב במקרה מסוים ייבדק על ידי המשרד, ולא נקבע בשיחה הזו.',
    en: 'Smoking in the vehicle is prohibited. The rental terms specify a minimum ₪500 cleaning charge for smoke contamination. The office reviews any individual charge; this chat does not determine it.' },
  { topic: 'cross_border', pattern: /ירדן|מצרים|טאבה|מחוץ לישראל|גבול|jordan|egypt|taba|border|outside israel|abroad/i, href: '/terms',
    he: 'אין לצאת עם הרכב מישראל ללא אישור מפורש בכתב מראש. יציאה ללא אישור מבטלת את הכיסוי הביטוחי. המשרד צריך לבדוק את היעד, ההרשאות והפוליסה המתאימה; אין כאן אישור לחציית גבול.',
    en: 'Do not take the vehicle outside Israel without explicit advance written approval. Unauthorised cross-border driving voids insurance cover. The office must check the destination, permissions and appropriate policy; this chat does not authorise a border crossing.' },
  { topic: 'commercial_use', pattern: /uber|bolt|מונית|מוניות|הסעה בשכר|taxi|ride.hailing/i, href: '/terms',
    he: 'לפי תנאי ההשכרה, אסור להשתמש ברכב להסעת נוסעים בתשלום, לרבות מונית, Uber או Bolt. שירות עסקי או רכב מסחרי הם נושאים אחרים, שניתן לבדוק מול המשרד.',
    en: 'The rental terms prohibit paid passenger transport, including taxi, Uber or Bolt use. Business rental and commercial vehicles are separate services that the office can discuss.' },
  { topic: 'off_road', pattern: /שטח לא סלול|נסיע[הת] שטח|off.?road|unsurfaced|towing|נגרר|לגרור/i, href: '/insurance',
    he: 'עמוד הביטוח מחריג נסיעה בשטח לא סלול, גם ברכב SUV. גרירת נגרר או ציוד דורשת אישור מפורש בכתב מראש. אין להסיק מסוג הרכב שהשימוש הזה מותר או מכוסה.',
    en: 'The insurance page excludes off-road or unsurfaced driving, including in an SUV. Towing requires explicit advance written approval. The vehicle category alone does not make these uses permitted or covered.' },
  { topic: 'fines', pattern: /דוחות|דו[״"]?ח|קנסות|קנס חניה|fines?|parking ticket|speeding ticket/i, href: '/terms',
    he: 'דוחות וקנסות שנוצרו בתקופת ההשכרה חלים על השוכר. לפי התנאים, דוחות חניה ומהירות שהגיעו לאחר ההחזרה יועברו לשוכר בדואר רשום. בירור חיוב או דוח מסוים דורש בדיקה של המשרד.',
    en: 'Fines incurred during the rental are the renter’s responsibility. The terms say parking and speeding tickets received after return are forwarded by registered mail. The office must review any individual ticket or disputed charge.' },
  { topic: 'payment', pattern: /מתי משלמים|איך משלמים|תשלום|מזומן|payment|pay(?:ing)?|cash/i, href: '/terms',
    he: 'לפי התנאים, דמי השכירות משולמים במלואם לפני מסירת הרכב. לפיקדון נדרש כרטיס אשראי תקף על שם השוכר; דביט אינו מתקבל. אמצעי תשלום אחרים, מקדמה וחיובים מיוחדים דורשים אישור משרד. לא מוסרים פרטי אשראי בשיחה.',
    en: 'The terms require full rental payment before handover. The deposit requires a valid credit card in the renter’s name; debit cards are not accepted. Other payment methods, deposits paid in advance and special charges need office confirmation. Do not send card details in chat.' },
  { topic: 'airport_service', pattern: /(?:איך|כיצד).*נתב|(?:how).*airport|שאטל|טרמינל|shuttle|terminal/i, href: '/branches/airport',
    he: 'בנתב״ג מוצע שירות מסירה והחזרה 24/7 בתיאום מראש: הרכב מגיע לטרמינל, ללא צורך בשאטל לסניף חיצוני. נקודת המפגש, מועד המסירה והמחיר מתואמים עם הצוות; אין בכך אישור זמינות.',
    en: 'Ben Gurion Airport delivery and collection run 24/7 by prior arrangement. The vehicle is brought to the terminal, without a shuttle to an off-site branch. The team coordinates the meeting point, timing and price; availability is not confirmed here.' },
  { topic: 'leasing_terms', pattern: /לכמה זמן.*ליסינג|תקופ.*ליסינג|חודשי.*ליסינג|ליסינג.*(?:כולל|מסלול|תקופ|חודש|קילומ)|leas(?:e|ing).*(?:term|month|period|include|mileage)|how long.*leas/i, href: '/leasing',
    he: `מסלולי הליסינג באתר מוצעים לתקופות של ${LEASING_DURATIONS.join(', ')} חודשים, עם חבילות שנתיות של ${MILEAGE_PACKAGES.join(', ')} ק״מ. יש ליסינג פרטי ועסקי; המחיר, הרכב, הטיפולים, הביטוח והתנאים המדויקים נקבעים בהצעה ובהסכם אישי. זו אינה הצעה מאושרת.`,
    en: `The site offers leasing terms of ${LEASING_DURATIONS.join(', ')} months and annual mileage packages of ${MILEAGE_PACKAGES.join(', ')} km. Private and business leasing are available; vehicle, price, maintenance, insurance and exact conditions are set in the individual quote and agreement. This is not an approved offer.` },
  { topic: 'leasing_types', pattern: /תפעולי|מימוני|סוגי ליסינג|איזה סוג ליסינג|ההבדל.*ליסינג|ליסינג.*ההבדל|operational leas|financial leas|types? of leas|difference.*leas/i, href: '/leasing',
    he: 'בתפעולי הדגש הוא שימוש ברכב ושירותים לפי ההסכם; במימוני הדגש הוא הסדר המימון ואפשרות הבעלות לפי ההסכם. ב־SmartCar מוצעים ליסינג פרטי ועסקי. מה כלול בתחזוקה ובביטוח, תנאי ההחזרה ואפשרות רכישה נקבעים בהצעה המסוימת — לא בשם המסלול בלבד.',
    en: 'Operational leasing focuses on using the vehicle with services defined in the agreement; financial leasing focuses on financing and any ownership option defined in the agreement. SmartCar offers private and business leasing. Maintenance, insurance, return terms and any purchase option depend on the specific offer, not the label alone.' },
  { topic: 'leasing_vs_buying', pattern: /ליסינג.*(?:לעומת|או|משתלם|כדאי|שווה).*(?:לקנות|קני|רכישה|לרכוש)|(?:לקנות|קני|רכישה|לרכוש).*(?:או|לעומת).*ליסינג|משתלם.*ליסינג|ליסינג.*משתלם|leas.*(?:vs|or|worth|better).*buy|buy.*(?:or|vs).*leas|is leasing worth/i, href: '/leasing',
    he: 'כדי להשוות ליסינג ורכישה צריך להביא בחשבון את משך השימוש, הקילומטראז׳, התשלום הראשוני והחודשי, התחזוקה, הביטוח ותנאי הסיום או המכירה. אי אפשר לקבוע מה משתלם יותר בלי נתונים והצעות בני השוואה. לכמה זמן אתה מתכנן להשתמש ברכב?',
    en: 'Compare the intended period and mileage, upfront and monthly payments, maintenance, insurance and end-of-term or resale arrangements. Neither option is automatically cheaper without comparable figures and offers. How long do you plan to use the vehicle?' },
  { topic: 'leasing_exit', pattern: /ביטול.*ליסינג|ליסינג.*ביטול|יציאה מוקדמת|early termination|cancel.*leas|leas.*cancel/i, href: '/terms',
    he: 'לפי הנוסח העברי של התנאים, הסכם ליסינג הוא ל־12 חודשים לפחות, וביטול מוקדם גורר פיצוי לפי החוזה הספציפי, שלא יפחת משלושה תשלומים חודשיים. בירור או שינוי הסכם קיים מטופלים במשרד לפי ההסכם החתום.',
    en: 'The Hebrew terms specify a minimum 12-month leasing agreement and early-termination compensation under the specific agreement, of at least three monthly payments. The office handles an existing agreement according to the signed contract.' },
  { topic: 'force_majeure', pattern: /כוח עליון|מלחמה|מגפה|force majeure|war|pandemic/i, href: '/terms',
    he: 'לפי התנאים שפורסמו באתר, ביטול עקב כוח עליון מזכה בזיכוי לשימוש עתידי ולא בהחזר כספי. המשרד צריך לבדוק את נסיבות המקרה וההסכם; השיחה הזו אינה קובעת זכאות אישית.',
    en: 'The published terms provide a future-use credit, rather than a cash refund, for cancellation due to force majeure. The office must review the circumstances and agreement; this chat does not determine individual entitlement.' },
  { topic: 'booking_process', pattern: /איך מזמינים|מתי.*מאושר|אישור הזמנה|הבקשה מאושרת|how.*book|booking process|is.*confirmed/i, href: '/rental',
    he: 'אפשר להכין כאן בקשת השכרה עם תאריכים, מקומות איסוף והחזרה וסוג רכב. נציג בודק זמינות ומחיר ומאשר בכתב. שליחת בקשה או הצגת מחיר מהקטלוג אינן אישור הזמנה ואינן שומרות רכב.',
    en: 'We can prepare a rental request here with dates, pickup and return locations and a car category. A representative checks availability and price and confirms in writing. Sending a request or viewing catalogue pricing does not confirm a booking or reserve a car.' },
  { topic: 'prices', pattern: /מה המחיר|כמה עולה|מחירים|תערי[ףפ]|how much|prices?|rates?|cost/i, href: '/catalog',
    he: 'המחיר תלוי ברכב, בתאריכים, בעונה ובתוספות. אפשר לאסוף את פרטי הבקשה ולהציג הערכה ממנוע המחירים של האתר; מחיר סופי וזמינות מאושרים בכתב על ידי נציג. אין מחיר קבוע שמתאים לכל השכרה.',
    en: 'Pricing depends on the vehicle, dates, season and extras. We can collect your rental details and show an estimate from the website’s pricing engine; a representative confirms final price and availability in writing. There is no single rate for every rental.' },
  { topic: 'child_seats', pattern: /כיסא|כסא|בוסטר|סלקל|סל קל|child seat|baby seat|booster/i, href: '/rental',
    he: 'אפשר לציין בבקשת ההשכרה צורך בכיסא ילד או בבוסטר. חשוב למסור את גיל הילד ואת מספר המושבים הדרושים; סוג הציוד, ההתאמה, המחיר והזמינות יאושרו מול הצוות לפני ההשכרה.',
    en: 'You can include a child-seat or booster request with your rental. Share the child’s age and the number of seats needed; the team must confirm equipment type, suitability, price and availability before the rental.' },
  { topic: 'company', pattern: /מי אתם|מי הקים|מתי הוקמה|אודות|החברה שלכם|about (?:you|smartcar)|who (?:are you|founded)|when.*founded|since when/i, href: '/about',
    he: 'SmartCar מספקת השכרת רכב, ליסינג ומכירת רכבים בישראל. לפי עמוד אודות, החברה הוקמה ב־2003 על ידי ליליאנה נרדאה. יש סניפים בהרצליה, תל אביב וירושלים, ושירות מסירה בנתב״ג ובכתובות בארץ בתיאום מראש.',
    en: 'SmartCar provides car rental, leasing and vehicle sales in Israel. The About page says it was founded in 2003 by Liliana Nardea. Branches are in Herzliya, Tel Aviv and Jerusalem, with coordinated delivery at Ben Gurion Airport and addresses across Israel.' },
  { topic: 'privacy', pattern: /פרטיות|מידע אישי|שמירת מידע|privacy|personal data|data protection/i, href: '/privacy',
    he: 'מדיניות הפרטיות באתר מפרטת את הטיפול במידע האישי. לבירור, בקשת עיון או בקשה הקשורה למידע שלכם, פנו למשרד. אין לשלוח כאן מספרי אשראי, צילום דרכון או פרטים רגישים.',
    en: 'The website’s Privacy Policy explains how personal information is handled. Contact the office for questions or requests concerning your information. Do not send card numbers, passport images or sensitive details here.' },
  { topic: 'accessibility', pattern: /נגישות|נגיש|accessib|wheelchair/i, href: '/accessibility',
    he: 'הצהרת הנגישות זמינה באתר. אם דרושה התאמה ברכב או בשירות, כתבו מה נדרש והצוות יבדוק התאמה וזמינות ספציפיות — אין להסיק שהרכב מותאם לפני אישור.',
    en: 'The Accessibility Statement is available on the website. If you need a vehicle or service accommodation, tell us what is required so the team can check specific suitability and availability. Do not assume a vehicle is adapted before confirmation.' },
];

/** More specific subtopics win over broad terms such as insurance/payment. */
export function getBusinessKnowledgeAnswer(input: string, locale: Locale): BusinessAnswer | null {
  const text = input.toLowerCase().replace(/ביטוחח/g, 'ביטוח').replace(/פיקדוון/g, 'פיקדון');
  const label = locale === 'he' ? 'לפרטים באתר' : 'Website details';
  // Branch addresses/phones always come from the site's shared source, not copied prose.
  const city = DELIVERY_CITIES.find((c) => text.includes(c.nameHe) || text.includes(c.nameEn.toLowerCase()));
  if (city && /משלוח|מסירה|מגיעים|סניף|deliver|branch/i.test(text)) return {
    topic: 'delivery', href: `/delivery/${city.slug}`, linkLabel: label,
    reply: (locale === 'he' ? 'זהו אזור משלוחים, ולא סניף פיזי. ' : 'This is a delivery area, not a physical branch. ') + (locale === 'he' ? city.bodyHe : city.bodyEn),
  };
  if (/סניפ|כתובת|איפה אתם|היכן אתם|branch|address|where are you located/i.test(text)
    && !/מייל|אימייל|email|e-mail|שעות|פתוח|hours|open/i.test(text)) {
    const named = BRANCHES.filter((b) => [b.cityHe, b.nameEn.toLowerCase(), b.id].some((name) => text.includes(name)));
    const list = named.length ? named : BRANCHES;
    return { topic: 'branches', href: '/branches', linkLabel: label,
      reply: (locale === 'he' ? 'הסניפים ושירות המסירה שלנו:\n' : 'Our branches and airport delivery service:\n') + list.map((b) => locale === 'he' ? `${b.nameHe}: ${b.streetHe}, ${b.cityHe}. טלפון: ${b.phone}.` : `${b.nameEn}: ${b.streetEn}, ${b.cityEn}. Phone: ${b.phone}.`).join('\n')
        + (locale === 'he' ? '\nנתב״ג הוא שירות מסירה בתיאום מראש; בערים אחרות ניתן לבדוק משלוח, ולא בהכרח קיים סניף.' : '\nThe airport is a coordinated delivery service; other cities may be served by delivery, not a physical branch.') };
  }
  // Avoid converting an actual theft/accident into an informational FAQ.
  const entries = BUSINESS_KNOWLEDGE.filter((entry) => entry.pattern.test(text));
  const priority = ['leasing_exit', 'leasing_vs_buying', 'leasing_types', 'force_majeure', 'cdw', 'insurance_exclusions', 'cross_border'];
  entries.sort((a, b) => (priority.includes(a.topic) ? priority.indexOf(a.topic) : 99) - (priority.includes(b.topic) ? priority.indexOf(b.topic) : 99));
  const entry = entries[0];
  // Existing precisely sourced deposit/driver/fuel rules take precedence over generic prices/payment.
  const service = getSmartCarServiceAnswer(text, locale);
  if (service && (!entry || ['prices', 'payment', 'child_seats'].includes(entry.topic))) return service;
  return entry ? { topic: entry.topic, reply: entry[locale], href: entry.href, linkLabel: label } : service;
}

/** In a leasing conversation, "אני נוסע 20 אלף בשנה" and "כמה זה לחודש?" are about leasing, not rental. */
function leasingFollowUp(input: string, locale: Locale, previousTopic?: string): BusinessAnswer | null {
  if (previousTopic?.startsWith('leasing')) {
    const link = { href: '/leasing', linkLabel: locale === 'he' ? 'ליסינג באתר' : 'Leasing' };
    // "ואם אני רוצה לצאת מהעסקה באמצע?"
    if (/לצאת|לבטל|ביטול|יציאה|באמצע|להפסיק|early|cancel|get out|terminate|exit/i.test(input)) {
      const exit = BUSINESS_KNOWLEDGE.find((entry) => entry.topic === 'leasing_exit');
      if (exit) return { topic: 'leasing_exit', href: exit.href, linkLabel: link.linkLabel, reply: exit[locale] };
    }
    // "יש לכם משהו חשמלי?" in a leasing conversation: the leasing offer, not the rental fleet.
    if (/חשמל|היבריד|electric|hybrid|\bev\b|איזה רכבים|אילו רכבים|דגמים|which cars|what cars|models/i.test(input)) {
      return { topic: 'leasing_terms', ...link, reply: locale === 'he'
        ? 'דגם מסוים בליסינג, כולל חשמלי או היברידי, דורש בדיקת התאמה וזמינות להצעה המסוימת. עצם הופעת הדגם באתר לא מאשרת שהוא זמין בליסינג לתקופה המבוקשת.'
        : 'A specific leasing model, including an electric or hybrid, needs suitability and availability verification for the particular offer. A website listing does not confirm leasing availability for the requested term.' };
    }
    const yearly = input.match(/(\d{1,3})\s*(?:אלף|k|,000|000)\s*(?:ק[״"]?מ|קמ|קילומטר\S*|km|kilomet\S*)?\s*(?:ב?שנה|לשנה|a year|per year|yearly|annually)/i);
    if (yearly) {
      const km = Number(yearly[1]) * 1000;
      const fit = MILEAGE_PACKAGES.find((pack) => pack >= km);
      return { topic: 'leasing_terms', href: '/leasing', linkLabel: locale === 'he' ? 'ליסינג באתר' : 'Leasing',
        reply: locale === 'he'
          ? `${km.toLocaleString('he-IL')} ק״מ בשנה הם בסיס להשוואה${fit ? ` מול חבילת ${fit.toLocaleString('he-IL')} ק״מ שמופיעה באתר` : ', מעבר לחבילות שמופיעות באתר'}. יש לבדוק בהצעה את מכסת הק״מ, עלות החריגה ותנאי היציאה. תחזוקה וביטוח נקבעים בהסכם המסוים, לא בשם המסלול.`
          : `${km.toLocaleString('en-US')} km a year is a basis for comparison${fit ? ` with the published ${fit.toLocaleString('en-US')} km package` : ', beyond the published packages'}. Check the offer’s mileage allowance, excess-mileage rate and exit terms. Maintenance and insurance depend on the specific agreement, not the plan label.` };
    }
    if (/כמה (?:זה )?(?:יוצא|עולה|יעלה)|מחיר|לחודש|חודשי|how much|price|per month|monthly/i.test(input)) {
      return { topic: 'leasing_terms', href: '/leasing', linkLabel: locale === 'he' ? 'ליסינג באתר' : 'Leasing',
        reply: locale === 'he'
          ? 'התשלום החודשי בליסינג תלוי בדגם, בתקופה ובחבילת הקילומטרים. המחיר, השירותים הכלולים ותנאי היציאה נקבעים בהצעה המסוימת; לא נוצרה או נשלחה כאן הצעת מחיר.'
          : 'The monthly leasing payment depends on the model, term and mileage package. Price, included services and exit terms are set in the individual offer; no quotation has been created or sent here.' };
    }
  }
  return null;
}

/** Answer independent parts locally too, without duplicating the same topic. */
export function getBusinessKnowledgeResponse(input: string, locale: Locale, previousTopic?: string): BusinessAnswer | null {
  const leasing = leasingFollowUp(input, locale, previousTopic);
  if (leasing) return leasing;
  const parts = input.split(/[?？;\n]+|\s+(?:וגם|ומה לגבי|and also|also|and what about)\s+/i).filter(Boolean);
  const answers = parts.map((part) => getBusinessKnowledgeAnswer(part, locale)).filter((a): a is BusinessAnswer => Boolean(a));
  const unique = [...new Map(answers.map((a) => [a.topic, a])).values()].slice(0, 4);
  if (!unique.length) {
    // "ובשישי?" right after the opening hours: answer just that day, not the whole list again.
    if (previousTopic === 'opening_hours' && /שישי|ערב חג|friday|eve/i.test(input)) return { topic: 'opening_hours', href: '/contact', reply: locale === 'en' ? 'On Fridays and holiday eves we’re open 08:30–14:00 🙂 At the airport, delivery is available 24/7 by arrangement.' : 'בשישי ובערבי חג אנחנו פתוחים 08:30–14:00 🙂 בנתב״ג אפשר מסירה גם מחוץ לשעות, בתיאום מראש.', linkLabel: locale === 'en' ? 'Opening hours' : 'שעות פתיחה באתר' } as BusinessAnswer;
    if (previousTopic === 'opening_hours' && /שבת|saturday|shabbat/i.test(input)) return { topic: 'opening_hours', href: '/contact', reply: locale === 'en' ? 'On Saturdays the branches are closed, but airport delivery can be arranged in advance 24/7.' : 'בשבת הסניפים סגורים, אבל בנתב״ג אפשר לתאם מסירה מראש גם בשבת.', linkLabel: locale === 'en' ? 'Opening hours' : 'שעות פתיחה באתר' } as BusinessAnswer;
    if (previousTopic === 'opening_hours' && /חג|holiday/i.test(input)) return getSmartCarServiceAnswer('opening hours', locale);
    if (/^(?:לא|no|nope)[\s,.!]*$/i.test(input.trim())) return null;
    return getBusinessKnowledgeAnswer(input, locale) ?? classifiedAnswer(input, locale);
  }
  return { ...unique[0], reply: unique.map((a) => a.reply).join('\n\n') };
}

/**
 * The published answer for a question asked in words no rule above knows
 * ("מה הסיפור עם הטנק", "אפשר להביא את הכלב?"): the brain's trained models
 * name the topic, and the topic's own question fetches the same answer.
 * Damage stays with the rules above, since a real accident must reach a person.
 */
const TOPIC_QUESTION: Record<string, string> = {
  branches: 'איפה הסניפים שלכם', addresses: 'מה הכתובות של הסניפים', contact: 'מה הטלפון שלכם', hours: 'מה שעות הפתיחה',
  age: 'מה הגיל המינימלי', new_driver: 'נהג חדש עם ותק רישיון קצר', deposit: 'כמה הפיקדון', payment: 'איך משלמים',
  insurance: 'מה כולל הביטוח', cancellation: 'מה מדיניות הביטול', fuel: 'מה מדיניות הדלק', mileage: 'כמה קילומטרים כלולים',
  smoking_pets: 'מותר לעשן ברכב', abroad: 'אפשר לנסוע לירדן', rideshare_towing: 'אפשר לעבוד במונית עם הרכב', documents: 'אילו מסמכים צריך',
  tourist: 'אילו מסמכים צריך', additional_driver: 'אפשר נהג נוסף', one_way: 'אפשר להחזיר במקום אחר', fines_tolls: 'מי משלם דוחות חניה',
  child_seat_extras: 'יש כיסא בטיחות לילד', unavailable_car: 'מה קורה אם אין רכב זמין', company_trust: 'מי אתם', price_general: 'כמה עולה',
  airport: 'איך זה עובד בנתבג',
  // "מה מכוסה אם קורה משהו?" is a question about cover; a real accident is caught by the rules first.
  damage_hypothetical: 'מה כולל הביטוח',
};

const NEEDS_WORDS: Record<string, RegExp> = {
  abroad: /חו[״"]?ל|לחו|ירדן|מצרים|טאבה|סיני|גבול|מחוץ ל|abroad|border|jordan|egypt|sinai|taba|outside israel|another country/i,
  smoking_pets: /עישון|לעשן|סיגר|כלב|חתול|חיות|חיה|בעלי חיים|smok|cigar|dog|cat|pet|animal/i,
  rideshare_towing: /אובר|uber|וולט|wolt|בולט|bolt|מונית|הסע|גרר|לגרור|tow|taxi|deliver/i,
  cancellation: /ביטול|לבטל|מבטל|cancel|refund|החזר/i,
};

function classifiedAnswer(input: string, locale: Locale): BusinessAnswer | null {
  // The whole message first, then each clause of what was not said "no" to:
  // "not looking to rent right now, what are your hours?" → "what are your hours?".
  const clauses = [input, ...withoutNegated(input).split(/[,.;]|\s(?:אבל|רק|but|just)\s/i).map((part) => part.trim()).filter((part) => part.split(' ').length >= 2)];
  for (const clause of clauses) {
    const guessed = brainQuestionTopic(clause.endsWith('?') || clause === input || !/\?/.test(input) ? clause : `${clause}?`);
    // A few topics are never guessed without their own words: "ים המלח" is not abroad.
    const topic = guessed && (!NEEDS_WORDS[guessed] || NEEDS_WORDS[guessed].test(clause)) ? guessed : null;
    const question = topic ? TOPIC_QUESTION[topic] : undefined;
    const answer = question ? getBusinessKnowledgeAnswer(question, locale) : null;
    if (answer) return answer;
  }
  return null;
}
