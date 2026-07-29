'use client';

import { useState } from 'react';
import Link from 'next/link';

type FaqItem = {
  q: string;
  a: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
};

const FAQ_HE: FaqItem[] = [
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
    // Interim wording only. A final cancellation policy needs the site,
    // the booking confirmation, company policy and the law aligned, and a
    // lawyer's approval — so no specific charge percentages are published.
    q: 'מהי מדיניות הביטול?',
    a: 'תנאי הביטול והשינוי נמסרים לפני אישור ההזמנה ומופיעים באישור הכתוב. הזכויות הקבועות בדין נשמרות. לביטול או לשינוי אפשר לפנות אלינו בטלפון, בדוא״ל או באמצעות טופס יצירת הקשר.',
  },
];

const FAQ_EN: FaqItem[] = [
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
    // Interim wording only — see the Hebrew entry above.
    q: 'What is the cancellation policy?',
    a: 'Cancellation and change terms are provided before confirmation and appear in the written confirmation. Statutory consumer rights remain unaffected. To cancel or change a request, contact us by phone, email or the contact form.',
  },
];

export default function FaqSection({ locale }: { locale: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = locale === 'he' ? FAQ_HE : FAQ_EN;

  return (
    <div className="space-y-3">
      {faqs.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
            aria-controls={`faq-panel-${i}`}
            id={`faq-button-${i}`}
            className="w-full flex items-center justify-between p-5 text-start hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-[#0D2B2B] text-sm md:text-base text-start flex-1">
              {item.q}
            </span>
            <span aria-hidden="true" className={`text-lg transition-transform flex-shrink-0 ms-3 ${openIndex === i ? 'text-[#B64916]' : 'text-gray-600'}`}>
              {openIndex === i ? '▲' : '▼'}
            </span>
          </button>
          {/* Kept in the DOM and hidden, rather than unmounted: the button's
              aria-controls names this panel, and an id that does not exist
              while the panel is collapsed is a dangling reference. `hidden`
              also keeps it out of the accessibility tree and out of the
              tab order, which unmounting was the long way round to. */}
          <div
            id={`faq-panel-${i}`}
            role="region"
            aria-labelledby={`faq-button-${i}`}
            hidden={openIndex !== i}
            className="px-5 pb-5 text-start"
          >
              <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
              {item.learnMoreHref && (
                <Link
                  href={`/${locale}${item.learnMoreHref}`}
                  className="inline-block mt-3 text-xs font-semibold text-[#2D5F5F] hover:text-[#B64916] underline transition-colors"
                >
                  {item.learnMoreLabel}
                </Link>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
