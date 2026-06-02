'use client';

// Add NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX to Vercel environment variables.
// GA scripts are only injected after the user accepts cookie consent
// (localStorage key: 'cookie_consent' === 'accepted').

import Script from 'next/script';
import { useState, useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

if (process.env.NODE_ENV === 'development' && !GA_ID) {
  console.warn('[Analytics] NEXT_PUBLIC_GA_ID is not set');
}

export default function GoogleAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setConsented(localStorage.getItem('cookie_consent') === 'accepted');
      } catch {}
    };

    check();

    // Re-check when another tab updates consent or the cookie banner fires
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cookie_consent') check();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!GA_ID || !consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
