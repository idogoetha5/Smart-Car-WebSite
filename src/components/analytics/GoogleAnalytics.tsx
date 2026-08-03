'use client';

/**
 * GA4 with Google Consent Mode.
 *
 * The previous version simply did not render the scripts until consent was
 * accepted, and unmounted them when it was withdrawn. Not rendering is a fine
 * default; unmounting is not a withdrawal. React removes its element while the
 * injected gtag script, the dataLayer and any cookies already set stay exactly
 * where they are — a live DOM check confirmed the tag survives the unmount.
 *
 * Consent Mode is the mechanism designed for this. The default is denied, set
 * before the tag loads, and grant/revoke is signalled explicitly, so a
 * withdrawal is communicated to Google rather than merely hidden from React.
 */

import Script from 'next/script';
import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { CONSENT_KEY, readConsent } from '@/lib/cookie-consent';
import { isAdminArea } from '@/lib/site-chrome';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

if (process.env.NODE_ENV === 'development' && !GA_ID) {
  console.warn('[Analytics] NEXT_PUBLIC_GA_ID is not set');
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export default function GoogleAnalytics() {
  const locale = useLocale();
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);
  // Once the tag is on the page it cannot be taken back off, so track whether
  // it was ever loaded separately from the current answer.
  const [everAccepted, setEverAccepted] = useState(false);

  useEffect(() => {
    const check = () => {
      const accepted = readConsent() === 'accepted';
      setConsented(accepted);
      if (accepted) setEverAccepted(true);
    };

    check();

    // Re-check when another tab updates consent, or when the banner (opened
    // fresh or re-opened from the footer control) records a choice here.
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) check();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Push every change to the tag. After a withdrawal this is what actually
  // stops collection — unmounting the element would not. Also skipped in the
  // admin area: a tag already loaded from an earlier public-site visit in the
  // same tab must not keep receiving updates once the admin navigates in.
  useEffect(() => {
    if (!GA_ID || !everAccepted || isAdminArea(pathname, locale)) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push([
      'consent',
      'update',
      {
        analytics_storage: consented ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
  }, [consented, everAccepted, pathname, locale]);

  // The admin team's own navigation must never count as customer traffic —
  // never mounted there, regardless of consent. Public-site behavior is
  // otherwise unchanged.
  if (isAdminArea(pathname, locale)) return null;
  // Nothing is injected until the visitor accepts at least once.
  if (!GA_ID || !everAccepted) return null;

  return (
    <>
      {/* One script, not two. beforeInteractive is only valid in the root
          layout, and it is not needed here: dataLayer is an ordered queue, so
          a `consent default` queued ahead of `config` is honoured whenever
          gtag.js finishes loading. */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            send_page_view: true,
            anonymize_ip: true
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
