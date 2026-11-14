'use client';

import { useEffect, useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

// The Cloudflare test key (always passes) is only ever a dev fallback —
// in production the real site key must be configured.
const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
  (process.env.NODE_ENV !== 'production' ? '1x00000000000000000000AA' : '');

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

// Turnstile downloads about 1.8 MB from Cloudflare. On the home page it sits in the reviews and
// newsletter forms far below the fold, so it used to cost every mobile visitor that download on
// load. It now starts only when its form comes near the screen; the box keeps its height meanwhile
// so nothing jumps.
export default function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near || !box.current) return;
    if (typeof IntersectionObserver === 'undefined') { const timer = setTimeout(() => setNear(true), 0); return () => clearTimeout(timer); }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '400px 0px' });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [near]);

  if (!SITE_KEY) {
    console.error('[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set — widget cannot render');
    return null;
  }
  return (
    <div ref={box} style={{ minHeight: 65 }}>
      {near && (
        <Turnstile
          siteKey={SITE_KEY}
          onSuccess={onSuccess}
          onError={() => onError?.()}
          onExpire={onExpire}
          options={{ theme: 'light', language: 'auto' }}
        />
      )}
    </div>
  );
}
