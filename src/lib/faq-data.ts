// Plain data, deliberately not colocated in FaqSection.tsx (a 'use client'
// component): importing a named export from a client-boundary module into
// a Server Component breaks under Next.js's RSC build — the export isn't a
// plain array at server-render time, so page.tsx's `.map()` over it for
// FAQPage JSON-LD threw "not a function" while prerendering /en. Keeping
// the data in a server-safe module lets both sides import the same source
// without crossing that boundary.

export type FaqItem = {
  q: string;
  a: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
};

export const FAQ_HE: FaqItem[] = [
  {
    q: 'מאיזה גיל ניתן לשכור רכב?',
    a: 'השכרה זמינה מגיל 18, גם לנהגים חדשים וצעירים. נדרש רישיון נהיגה בתוקף, רישום מראש בחוזה ההשכרה וכיסוי ביטוחי מתאים. התנאים, התוספת האפשרית ומגבלות קבוצת הרכב נקבעים לפי גיל הנהג והוותק שלו, והנהיגה כפופה למגבלות הדין החלות עליו.',
  },
  {
    q: 'האם כיסוי ביטוחי כלול במחיר ההשכרה?',
    a: 'כל השכרה כוללת את הביטוח או הכיסוי הביטוחי הבסיסי המפורט בהצעה ובחוזה ההשכרה. ניתן להוסיף הפחתה או ביטול של דמי השתתפות בנזק, בכפוף לתנאים ולחריגים. לנהג חדש או צעיר עשויה לחול תוספת.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'לפרטים מלאים על הביטוח',
  },
  {
    q: 'אילו מסמכים צריך להציג בעת איסוף הרכב?',
    a: 'תעודת זהות או דרכון, רישיון נהיגה מקורי בתוקף וכרטיס אשראי על שם השוכר לצורך הפיקדון. כל נהג נוסף צריך להציג רישיון ולהירשם בחוזה לפני הנהיגה. לנהג עם רישיון זר עשוי להידרש גם רישיון בינלאומי או תרגום רשמי, בהתאם לסוג הרישיון.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'ראה רשימת מסמכים מלאה',
  },
  {
    q: 'אפשר לקבל ולהחזיר את הרכב במקומות שונים?',
    a: 'כן. ניתן למסור ולהחזיר רכב בסניפים או בכתובות שונות בארץ, בתיאום מראש ובכפוף לזמינות. המחיר נקבע לפי הכתובות והשעות ויאושר על ידי נציג.',
  },
  {
    q: 'מהי מדיניות הביטול?',
    a: 'מדיניות הביטול הקנונית היא זו שבעמוד תנאי ההשכרה: יותר מ־72 שעות לפני האיסוף — החזר מלא; 72–48 שעות — 25% מדמי השכירות הבסיסיים; 48–24 שעות — 50%; פחות מ־24 שעות או אי־הופעה — 100%. שינוי תאריכים ללא חיוב אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות.',
    learnMoreHref: '/terms', learnMoreLabel: 'למדיניות הביטול המלאה',
  },
];

export const FAQ_EN: FaqItem[] = [
  {
    q: 'What is the minimum age to rent a vehicle?',
    a: 'Rental is available from age 18, including new and young drivers. A valid driving licence, advance registration in the rental agreement and suitable coverage are required. Terms, possible surcharges and vehicle-group restrictions depend on the driver\'s age and licence history. All legal driving restrictions continue to apply.',
  },
  {
    q: 'Is insurance cover included in the rental price?',
    a: 'Each rental includes the basic protection described in the quote and rental agreement. An option to reduce or waive damage participation may be available, subject to conditions and exclusions. A new or young driver surcharge may apply.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'Full insurance details →',
  },
  {
    q: 'Which documents must be presented when collecting the vehicle?',
    a: 'Please present an ID card or passport, an original valid driving licence and a credit card in the renter\'s name for the deposit. Every additional driver must present a licence and be added to the agreement before driving. Drivers with a foreign licence may also need an International Driving Permit or official translation, depending on the licence.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'See full document checklist →',
  },
  {
    q: 'Can the vehicle be collected and returned at different locations?',
    a: 'Yes. Delivery and return may be arranged at branches or different addresses in Israel, subject to advance coordination and availability. The price is based on the locations and times and will be confirmed by a representative.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'The canonical cancellation policy is on the Rental Terms page: more than 72 hours before pickup — full refund; 72–48 hours — 25% of the base rental fee; 48–24 hours — 50%; under 24 hours or a no-show — 100%. Date changes are free up to 48 hours before pickup, subject to availability.',
    learnMoreHref: '/terms', learnMoreLabel: 'Full cancellation policy →',
  },
];
