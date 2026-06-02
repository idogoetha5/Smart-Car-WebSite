'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

export default function CookieBanner() {
  const locale = useLocale();
  const isHe = locale === 'he';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie_consent')) setVisible(true);
    } catch {}
  }, []);

  const accept = () => {
    try {
      localStorage.setItem('cookie_consent', 'accepted');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'cookie_consent', newValue: 'accepted' })
      );
    } catch {}
    setVisible(false);
  };

  const decline = () => {
    try {
      localStorage.setItem('cookie_consent', 'declined');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'cookie_consent', newValue: 'declined' })
      );
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={isHe ? 'הסכמה לעוגיות' : 'Cookie consent'}
      className="fixed bottom-0 inset-x-0 z-50 bg-[#0D2B2B] text-[#B8D8D8] shadow-2xl"
    >
      <div
        className={`max-w-6xl mx-auto px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
          isHe ? 'sm:flex-row-reverse' : ''
        }`}
      >
        <p className={`text-sm flex-1 leading-relaxed ${isHe ? 'text-right' : 'text-left'}`}>
          {isHe
            ? 'אתר זה משתמש בעוגיות לשיפור חוויית הגלישה. ניתן לאשר שימוש בעוגיות לא חיוניות, או לדחות ולהשתמש רק בעוגיות הכרחיות.'
            : 'This site uses cookies to improve your experience. You may accept non-essential cookies, or decline to use only strictly necessary cookies.'}
        </p>
        <div className={`flex gap-3 shrink-0 ${isHe ? 'flex-row-reverse' : ''}`}>
          <Link
            href={`/${locale}/cookies`}
            className="px-4 py-2 text-sm rounded-lg border border-[#2D5F5F] hover:border-[#B8D8D8] transition-colors whitespace-nowrap"
          >
            {isHe ? 'מדיניות עוגיות' : 'Cookie Policy'}
          </Link>
          <button
            onClick={decline}
            className="px-4 py-2 text-sm rounded-lg border border-[#4D8F8F] text-[#B8D8D8] hover:border-white transition-colors whitespace-nowrap"
          >
            {isHe ? 'דחייה' : 'Decline'}
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 text-sm bg-[#E8743B] hover:bg-[#d4632a] text-white font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            {isHe ? 'אישור' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
