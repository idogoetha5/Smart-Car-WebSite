'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FAQ_HE, FAQ_EN } from '@/lib/faq-data';

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
