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
    q: 'מה גיל מינימלי להשכרת רכב?',
    a: 'הגיל המינימלי הוא 21, ו-23 לקטגוריות LUXURY, SUV ו-VAN. בכל המקרים נדרש רישיון נהיגה בתוקף של 24 חודשים רצופים לפחות ממועד הוצאתו.',
  },
  {
    q: 'האם הביטוח כלול במחיר?',
    a: 'בטח — כל הזמנה אצלנו כוללת ביטוח חובה מלא וביטוח מקיף בסיסי, בלי שום עלות נוספת. ואם אתם רוצים שקט נפשי מוחלט, אפשר להוסיף ביטול השתתפות עצמית (CDW) בתוספת יומית קטנה, וכל האחריות האישית שלכם יורדת לאפס.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'לפרטים מלאים על הביטוח',
  },
  {
    q: 'מה אני צריך להביא ביום האיסוף?',
    a: 'רק שלושה דברים: תעודת זהות, רישיון נהיגה בתוקף, ואמצעי תשלום. חשוב לזכור — המסמכים צריכים להיות מקוריים, צילומים לא יתקבלו.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'ראה רשימת מסמכים מלאה',
  },
  {
    q: 'האם ניתן לאסוף ולהחזיר בסניפים שונים?',
    a: 'כן, בהחלט! אפשר לאסוף מאחד הסניפים שלנו ולהחזיר בסניף אחר, או בכל כתובת אחרת בארץ שנוחה לכם. רק תתאמו מראש עם הנציג שלנו.',
  },
  {
    q: 'מה מדיניות הביטול?',
    a: 'התוכניות השתנו? אין בעיה — ביטול עד 72 שעות לפני האיסוף הוא ללא שום עלות, עם החזר מלא. ביטול בטווח 72–48 שעות כרוך בעמלה של 25% מדמי השכירות הבסיסיים, ובטווח 48–24 שעות — 50%. ביטול פחות מ-24 שעות לפני האיסוף, או אי-הופעה, אינו מזכה בהחזר.',
  },
];

const FAQ_EN: FaqItem[] = [
  {
    q: 'What is the minimum age to rent a vehicle?',
    a: 'The minimum rental age is 21 (23 for LUXURY, SUV, and VAN categories). A valid driving licence held for at least 24 consecutive months is required.',
  },
  {
    q: 'Is insurance included in the price?',
    a: 'Yes — mandatory (third-party) and basic comprehensive insurance are included in every booking. You can add a Collision Damage Waiver (CDW) for an additional daily fee, which reduces your personal liability to zero. Without CDW, you are liable up to the deductible amount stated in the contract.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'Full insurance details →',
  },
  {
    q: 'What do I need to bring on pickup day?',
    a: 'Please bring a valid government-issued photo ID, your original driving licence, and a payment method. All documents must be originals — photocopies are not accepted.',
    learnMoreHref: '/insurance',
    learnMoreLabel: 'See full document checklist →',
  },
  {
    q: 'Can I pick up and return the vehicle at different locations?',
    a: 'Yes! You can pick up from one of our branches and return to a different branch, or to any other address in Israel. Coordinate in advance with your representative!',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancellations made 72 hours or more before pickup receive a full refund. Cancellations within 48–72 hours incur a 25% fee; within 24–48 hours, 50%. Cancellations less than 24 hours before pickup are non-refundable.',
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
