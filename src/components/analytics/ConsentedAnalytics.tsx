'use client';

import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';

export default function ConsentedAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setConsented(localStorage.getItem('cookie_consent') === 'accepted');
      } catch {}
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return consented ? <Analytics /> : null;
}
