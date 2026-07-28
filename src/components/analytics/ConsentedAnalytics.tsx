'use client';

import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { readConsent } from '@/lib/cookie-consent';

export default function ConsentedAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    // Re-read on every `storage` event: writeConsent dispatches one in the
    // current tab too, so withdrawing consent from the footer control
    // unmounts analytics immediately rather than at the next navigation.
    const check = () => setConsented(readConsent() === 'accepted');
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  return consented ? <Analytics /> : null;
}
