'use client';

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

export default function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  if (!SITE_KEY) {
    console.error('[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set — widget cannot render');
    return null;
  }
  return (
    <Turnstile
      siteKey={SITE_KEY}
      onSuccess={onSuccess}
      onError={() => onError?.()}
      onExpire={onExpire}
      options={{ theme: 'light', language: 'auto' }}
    />
  );
}
