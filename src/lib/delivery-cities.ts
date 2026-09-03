/**
 * Delivery-only landing pages: cities SmartCar reaches through its existing
 * door-to-door delivery service (already advertised site-wide as available
 * "בכל הארץ" / "across Israel"), but where there is no physical branch.
 *
 * These are not a substitute for the branch pages in @/lib/branches — no
 * new location, address or service is being introduced here, only a
 * dedicated URL per city so each can be found on its own for
 * "השכרת רכב <city>" searches. Nearest-branch data lets each page point to
 * a real pickup option instead of implying a branch that doesn't exist.
 */

import { type BranchId } from '@/lib/branches';

export type DeliveryCitySlug =
  | 'netanya'
  | 'raanana'
  | 'petah-tikva'
  | 'rishon-lezion'
  | 'holon'
  | 'kfar-saba';

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
      'תושבים ואורחים בנתניה יכולים להזמין רכב מ-SmartCar בלי לצאת מהעיר: מתאמים כתובת ושעה, והרכב מגיע ומוחזר במקום. הסניף הקרוב ביותר יושב בהרצליה, כמה דקות נסיעה דרומה על כביש החוף, כך שהזמינות והמענה מהירים.',
    bodyEn:
      'Residents and visitors in Netanya can book a car from SmartCar without leaving the city: coordinate an address and time, and the vehicle is delivered and collected right there. The nearest branch is in Herzliya, a short drive south along the coastal highway, keeping availability and response times quick.',
  },
  {
    slug: 'raanana',
    nameHe: 'רעננה',
    nameEn: "Ra'anana",
    nearestBranch: 'herzliya',
    bodyHe:
      'ברעננה, קרובה כפי שהיא לסניף הרצליה, אפשר לתאם מסירה עד הבית או המשרד בלי לנסוע לאסוף רכב. השירות מתאים גם למי שמגיע לפגישות עסקים באזור וגם למשפחות שצריכות רכב לכמה ימים.',
    bodyEn:
      "Ra'anana sits close to the Herzliya branch, so a car can be delivered straight to your home or office without a trip to collect it. The service works well for business visitors to the area and for families who need a car for a few days.",
  },
  {
    slug: 'petah-tikva',
    nameHe: 'פתח תקווה',
    nameEn: 'Petah Tikva',
    nearestBranch: 'telaviv',
    bodyHe:
      'בפתח תקווה ובאזור התעשייה שלה מתאמים מסירה עד הכתובת בלי לנסוע למרכז תל אביב. הרכב מגיע מהסניף בתל אביב, קרוב יחסית, וחוזר באותו אופן בסיום ההשכרה.',
    bodyEn:
      "In Petah Tikva and its industrial zone, delivery can be arranged straight to your address without a trip into central Tel Aviv. The vehicle comes from the relatively nearby Tel Aviv branch and is collected the same way when the rental ends.",
  },
  {
    slug: 'rishon-lezion',
    nameHe: 'ראשון לציון',
    nameEn: 'Rishon LeZion',
    nearestBranch: 'telaviv',
    bodyHe:
      'תושבי ראשון לציון יכולים לקבל רכב עד הבית בתיאום מראש, מבלי להגיע לסניף. המסירה וההחזרה מתבצעות מהסניף בתל אביב, וזמינות מדויקת נבדקת מול נציג בעת ההזמנה.',
    bodyEn:
      "Rishon LeZion residents can have a car delivered to their door by prior arrangement, without visiting a branch. Delivery and return are handled from the Tel Aviv branch, with exact availability confirmed by a representative at booking.",
  },
  {
    slug: 'holon',
    nameHe: 'חולון',
    nameEn: 'Holon',
    nearestBranch: 'telaviv',
    bodyHe:
      'בחולון, סמוך לתל אביב, ניתן לתאם מסירה והחזרה של רכב מ-SmartCar בכתובת הביתית או העסקית, מהסניף בתל אביב. מתאים במיוחד למי שצריך רכב לכמה ימים בלי להתעסק עם תור בסוכנות.',
    bodyEn:
      "In Holon, near Tel Aviv, a SmartCar delivery and return can be arranged at a home or business address from the Tel Aviv branch. It's a good fit for anyone who needs a car for a few days without waiting in line at an agency.",
  },
  {
    slug: 'kfar-saba',
    nameHe: 'כפר סבא',
    nameEn: 'Kfar Saba',
    nearestBranch: 'herzliya',
    bodyHe:
      'בכפר סבא אפשר לתאם מסירה עד הבית או המשרד מהסניף בהרצליה, בלי לצאת מהעיר כדי לאסוף רכב. הצי הרחב של SmartCar זמין גם כאן, מקומפקטי ועד יוקרה.',
    bodyEn:
      "In Kfar Saba, delivery can be arranged from the Herzliya branch straight to your home or office, without leaving the city to collect a vehicle. SmartCar's full fleet, from compact to luxury, is available here too.",
  },
];

export function getDeliveryCity(slug: string): DeliveryCity | undefined {
  return DELIVERY_CITIES.find((c) => c.slug === slug);
}
