'use client';

/**
 * Vercel Analytics, gated per event rather than by mounting.
 *
 * The old comment claimed withdrawing consent "unmounts analytics
 * immediately". It does unmount the React element — but a live DOM check found
 * /_vercel/insights/script.js still present afterwards, so unmounting never
 * established that measurement had stopped.
 *
 * Vercel documents beforeSend as the opt-out mechanism: return null and the
 * event is dropped. Consent is read at send time, so a withdrawal takes effect
 * on the very next event, including during SPA navigation where no remount
 * happens at all.
 *
 * beforeSend also strips the query string, since a page URL is exactly what an
 * analytics event carries and the booking flow used to put a booking id and
 * dates there.
 */

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/react';
import { readConsent } from '@/lib/cookie-consent';
import { isAdminArea } from '@/lib/site-chrome';

export default function ConsentedAnalytics() {
  const locale = useLocale();
  const pathname = usePathname();
  // Whether the script has been injected at all. Consent is re-read inside
  // beforeSend on every event, so this only controls first injection.
  const [everAccepted, setEverAccepted] = useState(false);

  useEffect(() => {
    const check = () => {
      if (readConsent() === 'accepted') setEverAccepted(true);
    };
    check();
    // writeConsent dispatches `storage` in the current tab too.
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  // The admin team's own navigation must never count as customer traffic —
  // never mounted there, regardless of consent. Public-site behavior above
  // and below this line is unchanged.
  if (isAdminArea(pathname, locale)) return null;
  if (!everAccepted) return null;

  return (
    <Analytics
      beforeSend={(event) => {
        // Read at send time, not at mount time.
        if (readConsent() !== 'accepted') return null;
        try {
          const url = new URL(event.url);
          return { ...event, url: `${url.origin}${url.pathname}` };
        } catch {
          return event;
        }
      }}
    />
  );
}
