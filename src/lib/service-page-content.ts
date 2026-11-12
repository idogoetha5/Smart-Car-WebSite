import type { Vehicle } from '@/types';

// Extra content for /services/<type>: questions people search for before
// renting, matching fleet models and related pages. Answers repeat only facts
// already published elsewhere on the site (faq-data.ts, terms, insurance,
// branch pages). Do not add prices, guarantees or plan contents here.

type L = { he: string; en: string };
export type ServiceQuestion = { q: L; a: L; href?: string };

const DOCUMENTS: ServiceQuestion = {
  q: { he: 'אילו מסמכים צריך להציג באיסוף הרכב?', en: 'Which documents do I need when collecting the car?' },
  a: {
    he: 'תעודת זהות או דרכון, רישיון נהיגה מקורי בתוקף וכרטיס אשראי על שם השוכר לצורך הפיקדון. כל נהג נוסף צריך להציג רישיון ולהירשם בחוזה לפני הנהיגה.',
    en: 'An ID card or passport, a valid original driving licence and a credit card in the renter\'s name for the deposit. Every additional driver must show a licence and be added to the agreement before driving.',
  },
};
const DELIVERY: ServiceQuestion = {
  q: { he: 'אפשר לקבל את הרכב בכתובת שלי ולהחזיר אותו במקום אחר?', en: 'Can the car be delivered to my address and returned elsewhere?' },
  a: {
    he: 'כן. אפשר לקבל ולהחזיר את הרכב בסניפים או בכתובות שונות בארץ, בתיאום מראש ובכפוף לזמינות. המחיר נקבע לפי הכתובות והשעות ומאושר על ידי נציג.',
    en: 'Yes. The car can be delivered and returned at branches or other addresses in Israel, arranged in advance and subject to availability. The price depends on the addresses and times and is confirmed by a representative.',
  },
  href: 'branches',
};
const CANCELLATION: ServiceQuestion = {
  q: { he: 'מה מדיניות הביטול?', en: 'What is the cancellation policy?' },
  a: {
    he: 'ביטול יותר מ־72 שעות לפני האיסוף – החזר מלא; 72–48 שעות – 25% מדמי השכירות הבסיסיים; 48–24 שעות – 50%; פחות מ־24 שעות – 100%. שינוי תאריכים ללא חיוב אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות.',
    en: 'Cancel more than 72 hours before collection for a full refund; 72–48 hours – 25% of the base rental; 48–24 hours – 50%; under 24 hours – 100%. Dates can be changed free of charge up to 48 hours before collection, subject to availability.',
  },
  href: 'terms',
};
const AGE: ServiceQuestion = {
  q: { he: 'מאיזה גיל אפשר לשכור רכב?', en: 'What is the minimum age to rent a car?' },
  a: {
    he: 'מגיל 21, גם לנהגים חדשים. נדרש רישיון בתוקף ורישום של כל נהג בחוזה. התנאים, התוספת האפשרית וקבוצות הרכב המתאימות נקבעים לפי גיל הנהג וותק הרישיון.',
    en: 'From age 21, including new drivers. A valid licence is required and every driver must be on the agreement. Terms, any surcharge and suitable car groups depend on the driver\'s age and licence history.',
  },
};
const INSURANCE: ServiceQuestion = {
  q: { he: 'האם ביטוח כלול במחיר?', en: 'Is insurance included in the price?' },
  a: {
    he: 'כל השכרה כוללת את הכיסוי הביטוחי הבסיסי שמפורט בהצעה ובחוזה. אפשר להוסיף הפחתה או ביטול של ההשתתפות העצמית, בכפוף לתנאים. לנהג חדש או צעיר עשויה לחול תוספת.',
    en: 'Every rental includes the basic cover set out in the quote and agreement. You can add a reduction or waiver of the excess, subject to the terms. A surcharge may apply to new or young drivers.',
  },
  href: 'insurance',
};
const RENT_VS_LEASE: ServiceQuestion = {
  q: { he: 'מה ההבדל בין השכרה חודשית לליסינג?', en: 'What is the difference between monthly rental and leasing?' },
  a: {
    he: 'השכרה מתאימה לתקופה קצרה או בינונית, עם התחייבות מינימלית וגמישות בתאריכים. ליסינג הוא מסלול לטווח ארוך, בדרך כלל במחיר חודשי קבוע, למי שצריך רכב לתקופה ממושכת בלי לרכוש אותו. מה כלול בכל מסלול מפורט בהצעה הכתובה.',
    en: 'Rental suits a short or medium period with minimal commitment and flexible dates. Leasing is a long-term plan, usually at a fixed monthly price, for those who need a car for a long time without buying one. What each plan includes is set out in the written quote.',
  },
  href: 'leasing',
};
const AIRPORT: ServiceQuestion = {
  q: { he: 'אפשר לקבל או להחזיר את הרכב בנתב״ג?', en: 'Can I collect or return the car at Ben Gurion Airport?' },
  a: {
    he: 'כן. נציג SmartCar פוגש אתכם עם הרכב בנמל התעופה בן גוריון ומקבל אותו בחזרה, בתיאום מראש 24/7. שירות נתב״ג כרוך בתוספת של 150 ₪.',
    en: 'Yes. A SmartCar representative meets you with the car at Ben Gurion Airport and collects it on your return, arranged in advance 24/7. The airport service carries a ₪150 surcharge.',
  },
  href: 'branches/airport',
};

export const SERVICE_QUESTIONS: Record<string, ServiceQuestion[]> = {
  commercial: [
    {
      q: { he: 'איזה רישיון צריך כדי לשכור רכב מסחרי?', en: 'Which licence do I need to rent a commercial vehicle?' },
      a: {
        he: 'רכבי המסחר הקלים מיועדים לנהיגה ברישיון B, שמתיר נהיגה ברכב במשקל כולל של עד 3.5 טון. ציינו בבקשה את סוג הרישיון של כל נהג, ונציג יאשר שהרכב מתאים לו.',
        en: 'Light commercial vehicles are driven on a category B licence, which covers vehicles up to 3.5 tonnes gross weight. State each driver\'s licence type in your request and a representative will confirm the vehicle suits it.',
      },
    },
    {
      q: { he: 'לכמה זמן אפשר לשכור רכב מסחרי?', en: 'How long can I rent a commercial vehicle for?' },
      a: {
        he: 'ליום אחד להובלה, לכמה ימים לפרויקט או לחודש ויותר לעבודה שוטפת. לתקופה ארוכה כדאי לבקש הצעה להשכרה חודשית.',
        en: 'For a single day for a move, a few days for a project, or a month or more for ongoing work. For longer periods, ask for a monthly rental quote.',
      },
      href: 'services/monthly',
    },
    DELIVERY,
    DOCUMENTS,
  ],
  'new-driver': [AGE, INSURANCE, DOCUMENTS, CANCELLATION],
  monthly: [RENT_VS_LEASE, DELIVERY, DOCUMENTS, CANCELLATION],
  daily: [CANCELLATION, DELIVERY, AIRPORT, DOCUMENTS],
  hourly: [
    {
      q: { he: 'אפשר לשכור רכב לכמה שעות בלבד?', en: 'Can I rent a car for just a few hours?' },
      a: {
        he: 'כן, בתיאום מראש ובכפוף לזמינות. שלחו את המיקום ואת שעות האיסוף וההחזרה, והמחיר יאושר לפני ההשכרה.',
        en: 'Yes, arranged in advance and subject to availability. Send the location and the collection and return times, and the price is confirmed before the rental.',
      },
    },
    DELIVERY,
    DOCUMENTS,
    AGE,
  ],
  business: [
    {
      q: { he: 'אפשר לשכור כמה רכבים לעסק?', en: 'Can a business rent several cars?' },
      a: {
        he: 'כן. אפשר לשכור רכב בודד לעובד או כמה רכבים לפעילות השוטפת, ליום, לחודש או בליסינג. ספרו לנו כמה רכבים, לאיזו תקופה ולאילו נהגים, ונחזור עם הצעה.',
        en: 'Yes. A business can rent a single car for an employee or several cars for daily work, by the day, by the month or on a lease. Tell us how many cars, for how long and for which drivers, and we will send a quote.',
      },
    },
    RENT_VS_LEASE,
    DELIVERY,
    DOCUMENTS,
  ],
  leasing: [RENT_VS_LEASE, AGE, DOCUMENTS],
  sale: [
    {
      q: { he: 'אפשר לקבל פרטים ומסמכים על רכב לפני הקנייה?', en: 'Can I get details and documents before buying?' },
      a: {
        he: 'כן. לכל רכב שמוצע למכירה נציג את הנתונים והמסמכים הזמינים לגביו, ואפשר לפנות אלינו בכל שאלה לפני ההחלטה.',
        en: 'Yes. For each car on sale we show its details and the documents available for it, and you can ask us anything before deciding.',
      },
      href: 'cars-for-sale',
    },
  ],
};

/** Fleet models worth showing on a service page (none for leasing/sale). */
export function serviceVehicles(type: string, fleet: readonly Vehicle[]): Vehicle[] {
  const pick = (test: (v: Vehicle) => boolean) => fleet.filter(v => v.isAvailable !== false && test(v));
  const byPrice = (a: Vehicle, b: Vehicle) => (a.displayPricePerDay ?? a.pricePerDay ?? 0) - (b.displayPricePerDay ?? b.pricePerDay ?? 0);
  const varied = (list: Vehicle[]) => {
    // One model per category first, so the list shows the range of the fleet.
    const seen = new Set<string>(); const first: Vehicle[] = []; const rest: Vehicle[] = [];
    for (const v of [...list].sort(byPrice)) (seen.has(v.category) ? rest : (seen.add(v.category), first)).push(v);
    return [...first, ...rest];
  };
  switch (type) {
    case 'commercial': return pick(v => v.category === 'COMMERCIAL').sort(byPrice).slice(0, 6);
    case 'new-driver': return pick(v => ['MINI', 'ECONOMY', 'COMPACT', 'ECONOMY_COMPACT'].includes(v.category)).sort(byPrice).slice(0, 6);
    case 'monthly': case 'daily': case 'hourly': case 'business': return varied(pick(() => true)).slice(0, 6);
    default: return [];
  }
}

export const RELATED_PAGES: { path: string; he: string; en: string }[] = [
  { path: 'services/daily', he: 'השכרת רכב ליום', en: 'Daily car rental' },
  { path: 'services/monthly', he: 'השכרת רכב לחודש', en: 'Monthly car rental' },
  { path: 'services/hourly', he: 'השכרת רכב לפי שעה', en: 'Hourly car rental' },
  { path: 'services/commercial', he: 'השכרת רכב מסחרי', en: 'Commercial vehicle rental' },
  { path: 'services/business', he: 'השכרת רכב לעסקים', en: 'Business car rental' },
  { path: 'services/new-driver', he: 'השכרת רכב לנהג צעיר', en: 'Young driver car rental' },
  { path: 'leasing', he: 'ליסינג פרטי ועסקי', en: 'Private & business leasing' },
  { path: 'branches/telaviv', he: 'השכרת רכב בתל אביב', en: 'Car rental in Tel Aviv' },
  { path: 'branches/herzliya', he: 'השכרת רכב בהרצליה', en: 'Car rental in Herzliya' },
  { path: 'branches/jerusalem', he: 'השכרת רכב בירושלים', en: 'Car rental in Jerusalem' },
  { path: 'branches/airport', he: 'השכרת רכב בנתב״ג', en: 'Ben Gurion Airport car rental' },
];
