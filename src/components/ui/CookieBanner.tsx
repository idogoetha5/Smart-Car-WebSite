'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  REOPEN_EVENT,
  readConsent,
  writeConsent,
  type ConsentValue,
} from '@/lib/cookie-consent';

export default function CookieBanner() {
  const locale = useLocale();
  const isHe = locale === 'he';
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ConsentValue | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Where focus came from, so it can be handed back when the banner is
  // dismissed after being re-opened from the footer control.
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCurrent(readConsent());
    if (!readConsent()) setVisible(true);
  }, []);

  // Footer "Cookie Preferences" re-opens the banner for an existing choice.
  useEffect(() => {
    const reopen = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setCurrent(readConsent());
      setVisible(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  // Move focus into the banner when it is re-opened deliberately, so
  // keyboard and screen-reader users land on the controls they asked for.
  useEffect(() => {
    if (visible && opener.current) dialogRef.current?.focus();
  }, [visible]);

  const close = () => {
    setVisible(false);
    opener.current?.focus();
    opener.current = null;
  };

  const choose = (value: ConsentValue) => {
    writeConsent(value);
    setCurrent(value);
    close();
  };

  // Escape closes without changing the stored choice.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && readConsent()) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const accept = () => choose('accepted');
  const decline = () => choose('declined');

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-live="polite"
      aria-label={isHe ? 'הסכמה לעוגיות' : 'Cookie consent'}
      className="fixed bottom-0 inset-x-0 z-50 bg-[#0D2B2B] text-[#B8D8D8] shadow-2xl focus:outline-none"
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
            aria-pressed={current === 'declined'}
            className={`px-4 py-2 text-sm rounded-lg border text-[#B8D8D8] hover:border-white transition-colors whitespace-nowrap ${
              current === 'declined' ? 'border-white' : 'border-[#4D8F8F]'
            }`}
          >
            {isHe ? 'דחייה' : 'Decline'}
          </button>
          <button
            onClick={accept}
            aria-pressed={current === 'accepted'}
            className={`px-5 py-2 text-sm bg-[#C24E17] hover:bg-[#d4632a] text-white font-bold rounded-lg transition-colors whitespace-nowrap ${
              current === 'accepted' ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0D2B2B]' : ''
            }`}
          >
            {isHe ? 'אישור' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
