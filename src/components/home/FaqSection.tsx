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
    a: 'אפשר להשכיר רכב אצלנו מגיל 18, עם רישיון נהיגה בתוקף של שנה לפחות. נהגים צעירים מתחת לגיל 25 ישלמו תוספת ביטוח קטנה — זה הכל.',
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
    a: 'התוכניות השתנו? אין בעיה — ביטול עד 24 שעות לפני האיסוף הוא ללא שום עלות. ביטול מאוחר יותר עשוי לכלול דמי ביטול.',
  },
];

const FAQ_EN: FaqItem[] = [
  {
    q: 'What is the minimum age to rent a vehicle?',
    a: 'The minimum rental age is 18. A valid driving licence held for at least 12 months is required. Drivers under 25 are subject to a young driver surcharge.',
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
            className="w-full flex items-center justify-between p-5 text-start hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-[#0D2B2B] text-sm md:text-base text-start flex-1">
              {item.q}
            </span>
            <span className={`text-lg transition-transform flex-shrink-0 ms-3 ${openIndex === i ? 'text-[#E8743B]' : 'text-gray-400'}`}>
              {openIndex === i ? '▲' : '▼'}
            </span>
          </button>
          {openIndex === i && (
            <div className="px-5 pb-5 text-start">
              <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
              {item.learnMoreHref && (
                <Link
                  href={`/${locale}${item.learnMoreHref}`}
                  className="inline-block mt-3 text-xs font-semibold text-[#2D5F5F] hover:text-[#E8743B] underline transition-colors"
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
