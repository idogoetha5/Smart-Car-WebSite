'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  REOPEN_EVENT,
  readConsent,
  writeConsent,
  type ConsentValue,
} from '@/lib/cookie-consent';

/**
 * Consent as an external store. writeConsent already dispatches a `storage`
 * event in the current tab as well as others, so one listener covers both.
 */
function subscribeConsent(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(REOPEN_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(REOPEN_EVENT, onChange);
  };
}

// getSnapshot must be referentially stable for primitives; readConsent
// returns a string or null, so it already is.
function readConsentSnapshot(): ConsentValue | null {
  return readConsent();
}

export default function CookieBanner() {
  const locale = useLocale();
  const isHe = locale === 'he';
  // Reopened deliberately from the footer control. Set only from an event
  // handler, never from an effect body.
  const [reopened, setReopened] = useState(false);
  // Dismissed with Escape without choosing. Deriving visibility purely from
  // the stored value would otherwise trap a first-time visitor behind a
  // banner they cannot close until they pick something.
  const [dismissed, setDismissed] = useState(false);
  // Consent is genuinely external state — it lives in localStorage and other
  // tabs can change it — so useSyncExternalStore reads it rather than an
  // effect copying it into React state on mount. The server snapshot is null,
  // which is also the correct pre-hydration answer: nothing is known yet.
  const current = useSyncExternalStore(subscribeConsent, readConsentSnapshot, () => null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Where focus came from, so it can be handed back when the banner is
  // dismissed after being re-opened from the footer control.
  const opener = useRef<HTMLElement | null>(null);

  // Derived, not copied. The banner is shown when no choice has been stored,
  // or when the footer control asked for it. Previously a mount effect copied
  // the stored value into state, which is the setState-in-effect cascade the
  // React Compiler warns about — and it also meant two sources of truth for
  // the same fact.
  const visible = (current === null && !dismissed) || reopened;

  // Footer "Cookie Preferences" re-opens the banner for an existing choice.
  useEffect(() => {
    const reopen = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setReopened(true);
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
    setReopened(false);
    setDismissed(true);
    opener.current?.focus();
    opener.current = null;
  };

  const choose = (value: ConsentValue) => {
    // writeConsent dispatches `storage`, which the store above is subscribed
    // to, so the new value propagates without a second source of truth.
    writeConsent(value);
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
