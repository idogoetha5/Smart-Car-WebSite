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
    q: 'מי יכול לשכור רכב?',
    a: 'השירות זמין מגיל 18 לבעלי רישיון נהיגה בתוקף, גם במהלך השנתיים הראשונות לקבלת הרישיון. כל נהג חייב להירשם מראש בחוזה ולהיות מכוסה בכיסוי הביטוחי המתאים. נהג חדש או צעיר נדרש לפעול לפי המגבלות החלות עליו.',
  },
  {
    q: 'האם ביטוח כלול במחיר ההשכרה?',
    a: 'מחיר ההשכרה כולל את הכיסוי הביטוחי הבסיסי המפורט בהצעה ובחוזה. ניתן להוסיף ביטול השתתפות עצמית בתשלום, בכפוף לתנאים ולחריגים המפורטים בחוזה. לנהג חדש או צעיר עשויה לחול תוספת מחיר בהתאם לכיסוי הביטוחי הנדרש.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'לפרטים מלאים על הביטוח',
  },
  {
    q: 'אילו מסמכים צריך להציג בעת איסוף הרכב?',
    a: 'בעת איסוף הרכב יש להציג תעודת זהות או דרכון, רישיון נהיגה מקורי ובתוקף וכרטיס אשראי בתוקף על שם השוכר. גם נהג נוסף נדרש להציג רישיון נהיגה ולהירשם בחוזה לפני הנהיגה.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'ראה רשימת מסמכים מלאה',
  },
  {
    q: 'אפשר לקבל ולהחזיר את הרכב במקומות שונים?',
    a: 'כן. ניתן לתאם מסירה והחזרה בסניפים או בכתובת אחרת בכל הארץ. השירות כפוף לתיאום מראש, והמחיר נקבע מול הנציג לפי הכתובות והזמנים.',
  },
  {
    q: 'מהי מדיניות הביטול?',
    a: 'ביטול יותר מ־72 שעות לפני מועד האיסוף אינו כרוך בחיוב ומזכה בהחזר מלא. ביטול 72–48 שעות לפני האיסוף כרוך בחיוב של 25% מדמי השכירות הבסיסיים, וביטול 48–24 שעות לפני האיסוף כרוך בחיוב של 50%. ביטול פחות מ־24 שעות לפני האיסוף או אי־הגעה אינו מזכה בהחזר.',
  },
];

const FAQ_EN: FaqItem[] = [
  {
    q: 'Who can rent a vehicle?',
    a: 'The service is available from age 18 to holders of a valid driving licence, including during the first two years after the licence was issued. Every driver must be registered in the agreement in advance and be covered by the applicable insurance. A new or young driver must comply with the restrictions that apply to them.',
  },
  {
    q: 'Is insurance included in the rental price?',
    a: 'The rental price includes the basic insurance cover detailed in the quote and in the agreement. A collision damage waiver can be added for a fee, subject to the terms and exclusions set out in the agreement. A new or young driver may be subject to an additional charge according to the insurance cover required.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'Full insurance details →',
  },
  {
    q: 'Which documents must be presented when collecting the vehicle?',
    a: 'When collecting the vehicle you must present an ID card or passport, an original valid driving licence, and a valid credit card in the renter\'s name. An additional driver must also present a driving licence and be registered in the agreement before driving.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'See full document checklist →',
  },
  {
    q: 'Can the vehicle be collected and returned at different locations?',
    a: 'Yes. Delivery and return can be arranged at our branches or at another address anywhere in Israel. The service is subject to prior coordination, and the price is agreed with the representative according to the addresses and times.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancellation more than 72 hours before the collection time is free of charge and entitles you to a full refund. Cancellation 72–48 hours before collection is charged at 25% of the basic rental fee, and cancellation 48–24 hours before collection is charged at 50%. Cancellation less than 24 hours before collection, or failure to appear, does not entitle you to a refund.',
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
          {openIndex === i && (
            <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`} className="px-5 pb-5 text-start">
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
          )}
        </div>
      ))}
    </div>
  );
}
