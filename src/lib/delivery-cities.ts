/**
 * Delivery-only landing pages: cities and regions SmartCar reaches through
 * its existing door-to-door delivery service (already advertised site-wide
 * as available "בכל הארץ" / "across Israel"), but where there is no
 * physical branch.
 *
 * These are not a substitute for the branch pages in @/lib/branches — no
 * new location, address or service is being introduced here, only a
 * dedicated URL per city/region so each can be found on its own for
 * "השכרת רכב <place>" searches. Nearest-branch data lets each page point to
 * a real pickup option instead of implying a branch that doesn't exist.
 *
 * Deliberately bounded, not exhaustive: Google's spam policy treats large
 * numbers of near-identical, keyword-swapped city pages as "doorway pages,"
 * a pattern that can trigger a manual action against the whole site. This
 * list stays at a size where every entry gets genuinely distinct body copy
 * (real distance/logistics detail, not template variables) and two of the
 * wider-reach searches ("הצפון" / "הדרום") are covered as single regional
 * pages instead of one entry per town — full country coverage without
 * mass-producing lookalike pages. Kept off primary navigation on purpose
 * (see the small link on /branches); indexed via sitemap.ts only.
 */

import { type BranchId } from '@/lib/branches';

export type DeliveryCitySlug =
  | 'netanya'
  | 'raanana'
  | 'petah-tikva'
  | 'rishon-lezion'
  | 'holon'
  | 'kfar-saba'
  | 'ashdod'
  | 'modiin'
  | 'haifa'
  | 'beer-sheva'
  | 'center'
  | 'north'
  | 'south';

export interface DeliveryCity {
  slug: DeliveryCitySlug;
  nameHe: string;
  nameEn: string;
  nearestBranch: BranchId;
  bodyHe: string;
  bodyEn: string;
}

export const DELIVERY_CITIES: DeliveryCity[] = [
  {
    slug: 'netanya',
    nameHe: 'נתניה',
    nameEn: 'Netanya',
    nearestBranch: 'herzliya',
    bodyHe:
      'תושבים ואורחים בנתניה יכולים להזמין רכב מ-SmartCar בלי לצאת מהעיר: מתאמים כתובת ושעה, והרכב מגיע ומוחזר במקום, בכפוף לתיאום מראש וזמינות.',
    bodyEn:
      'Residents and visitors in Netanya can book a car from SmartCar without leaving the city: coordinate an address and time, and the vehicle is delivered and collected right there, subject to advance arrangement and availability.',
  },
  {
    slug: 'raanana',
    nameHe: 'רעננה',
    nameEn: "Ra'anana",
    nearestBranch: 'herzliya',
    bodyHe:
      'ברעננה אפשר לתאם מסירה עד הבית או המשרד בלי לנסוע לאסוף רכב, בתיאום מראש מול נציג. השירות מתאים גם למי שמגיע לפגישות עסקים באזור וגם למשפחות שצריכות רכב לכמה ימים.',
    bodyEn:
      "In Ra'anana, a car can be delivered straight to your home or office without a trip to collect it, by prior arrangement with a representative. The service works well for business visitors to the area and for families who need a car for a few days.",
  },
  {
    slug: 'petah-tikva',
    nameHe: 'פתח תקווה',
    nameEn: 'Petah Tikva',
    nearestBranch: 'herzliya',
    bodyHe:
      'בפתח תקווה ובאזור התעשייה שלה אפשר לתאם מסירה עד הכתובת, ולא צריך לנסוע לסניף. ההחזרה בסיום ההשכרה מתואמת באותו אופן.',
    bodyEn:
      "In Petah Tikva and its industrial zone, delivery can be arranged straight to your address, with no need to visit a branch. Return at the end of the rental is arranged the same way.",
  },
  {
    slug: 'rishon-lezion',
    nameHe: 'ראשון לציון',
    nameEn: 'Rishon LeZion',
    nearestBranch: 'herzliya',
    bodyHe:
      'תושבי ראשון לציון יכולים לקבל רכב עד הבית בתיאום מראש, מבלי להגיע לסניף. זמינות מדויקת נבדקת מול נציג בעת ההזמנה.',
    bodyEn:
      "Rishon LeZion residents can have a car delivered to their door by prior arrangement, without visiting a branch. Exact availability is confirmed by a representative at booking.",
  },
  {
    slug: 'holon',
    nameHe: 'חולון',
    nameEn: 'Holon',
    nearestBranch: 'herzliya',
    bodyHe:
      'בחולון ניתן לתאם מסירה והחזרה של רכב מ-SmartCar בכתובת הביתית או העסקית, בתיאום מראש. מתאים במיוחד למי שצריך רכב לכמה ימים בלי להתעסק עם תור בסוכנות.',
    bodyEn:
      "In Holon, a SmartCar delivery and return can be arranged at a home or business address, by prior arrangement. It's a good fit for anyone who needs a car for a few days without waiting in line at an agency.",
  },
  {
    slug: 'kfar-saba',
    nameHe: 'כפר סבא',
    nameEn: 'Kfar Saba',
    nearestBranch: 'herzliya',
    bodyHe:
      'בכפר סבא אפשר לתאם מסירה עד הבית או המשרד, בלי לצאת מהעיר כדי לאסוף רכב. הצי הרחב של SmartCar זמין גם כאן, מקומפקטי ועד יוקרה.',
    bodyEn:
      "In Kfar Saba, delivery can be arranged straight to your home or office, without leaving the city to collect a vehicle. SmartCar's full fleet, from compact to luxury, is available here too.",
  },
  {
    slug: 'ashdod',
    nameHe: 'אשדוד',
    nameEn: 'Ashdod',
    nearestBranch: 'herzliya',
    bodyHe:
      'באשדוד ניתן לתאם מסירה והחזרה של רכב מ-SmartCar בכתובת הבית או העבודה, בתיאום מראש. השירות מתאים לתושבי העיר, לעובדים בנמל ובאזורי התעשייה, ולמי שיוצא מכאן לטיול לדרום.',
    bodyEn:
      "In Ashdod, delivery and return can be arranged at a home or work address, by prior arrangement. It suits city residents, workers at the port and industrial zones, and anyone heading south from here.",
  },
  {
    slug: 'modiin',
    nameHe: 'מודיעין',
    nameEn: 'Modiin',
    nearestBranch: 'herzliya',
    bodyHe:
      'במודיעין, בדיוק באמצע הדרך בין תל אביב לירושלים, ניתן לתאם מסירה עד הבית בתיאום מראש. נוח למי שצריך רכב לימים בודדים בלי לנסוע לאסוף אותו.',
    bodyEn:
      "In Modiin, roughly halfway between Tel Aviv and Jerusalem, delivery to your door can be arranged by prior agreement. Convenient for anyone who needs a car for a few days without a trip to collect it.",
  },
  {
    slug: 'haifa',
    nameHe: 'חיפה',
    nameEn: 'Haifa',
    nearestBranch: 'herzliya',
    bodyHe:
      'בחיפה ובקריות ניתן לתאם מסירה והחזרה של רכב מ-SmartCar בכתובת שתבחרו. מומלץ לתאם מראש עם נציג את השעה המדויקת והזמינות.',
    bodyEn:
      "In Haifa and the Krayot area, a SmartCar delivery and return can be arranged at an address of your choice. It's best to confirm the exact time and availability with a representative in advance.",
  },
  {
    slug: 'beer-sheva',
    nameHe: 'באר שבע',
    nameEn: 'Beer Sheva',
    nearestBranch: 'herzliya',
    bodyHe:
      'בבאר שבע ובנגב הצפוני ניתן לתאם מסירה של רכב מ-SmartCar עד כתובתכם, בתיאום מול נציג מראש. כדאי לקבוע זמינות ושעה מדויקת בעת ההזמנה.',
    bodyEn:
      "In Beer Sheva and the northern Negev, a SmartCar delivery to your address can be arranged with a representative in advance. It's best to confirm exact availability and timing when booking.",
  },
  {
    slug: 'center',
    nameHe: 'מרכז הארץ',
    nameEn: 'Central Israel',
    nearestBranch: 'herzliya',
    bodyHe:
      'במרכז הארץ — תל אביב, רמת גן, גבעתיים, בני ברק, לוד ורמלה ועוד — SmartCar מציעה מסירת רכב עד הכתובת שלכם, בתיאום מראש מול נציג.',
    bodyEn:
      "In central Israel — Tel Aviv, Ramat Gan, Givatayim, Bnei Brak, Lod, Ramla and more — SmartCar offers delivery to your address, coordinated with a representative in advance.",
  },
  {
    slug: 'north',
    nameHe: 'הצפון',
    nameEn: 'Northern Israel',
    nearestBranch: 'herzliya',
    bodyHe:
      'לנוסעים לצפון הארץ — חיפה, עכו, נהריה, כרמיאל, טבריה והכנרת — SmartCar מציעה מסירת רכב עד הכתובת שלכם, בתיאום מראש מול נציג. כדאי לתאם את השעה והזמינות מוקדם ככל האפשר.',
    bodyEn:
      "For trips to northern Israel — Haifa, Acre, Nahariya, Karmiel, Tiberias and the Sea of Galilee — SmartCar offers delivery to your address, coordinated with a representative in advance. It's worth confirming timing and availability as early as possible.",
  },
  {
    slug: 'south',
    nameHe: 'הדרום',
    nameEn: 'Southern Israel',
    nearestBranch: 'herzliya',
    bodyHe:
      'לנוסעים לדרום הארץ — באר שבע, אשקלון, אילת והנגב — SmartCar מציעה מסירת רכב עד הכתובת שלכם, בתיאום מראש מול נציג. מומלץ לתאם זמינות ושעה מדויקת מבעוד מועד, בהתאם למרחק מהיעד.',
    bodyEn:
      "For trips to southern Israel — Beer Sheva, Ashkelon, Eilat and the Negev — SmartCar offers delivery to your address, coordinated in advance with a representative. It's best to confirm exact availability and timing ahead of time, depending on the distance to your destination.",
  },
];

export function getDeliveryCity(slug: string): DeliveryCity | undefined {
  return DELIVERY_CITIES.find((c) => c.slug === slug);
}

/**
 * Prefixes a Hebrew place name with ל ("to") or ב ("in"), dropping a
 * leading ה (definite article) as standard orthography requires —
 * "ל" + "הדרום" is written "לדרום", never "להדרום". Names that don't start
 * with ה (עיר names, or a construct phrase like "מרכז הארץ") are untouched
 * beyond prepending the letter.
 */
export function hePrefix(prefix: 'ל' | 'ב', nameHe: string): string {
  return prefix + (nameHe.startsWith('ה') ? nameHe.slice(1) : nameHe);
}
