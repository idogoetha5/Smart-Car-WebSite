'use client';

import { Turnstile } from '@marsidev/react-turnstile';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'; // Cloudflare test key (always passes)

// TEMPORARY (2026-07-20): the real Cloudflare Turnstile widget is
// misconfigured server-side (error 400020 from Cloudflare's own API,
// unrelated to this app) and never produces a token, which silently
// blocks every form on the site (contact/reviews/leasing/newsletter/
// bookings all hard-require a token). TURNSTILE_BYPASS lets forms keep
// working — submissions are still protected by rate limiting + honeypot
// fields on every endpoint. Remove BYPASS and this whole branch once the
// Cloudflare widget is fixed (see memory: smartcar_icloud_git_corruption.md).
const BYPASS = process.env.NEXT_PUBLIC_TURNSTILE_BYPASS === 'true';

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export default function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  return (
    <Turnstile
      siteKey={SITE_KEY}
      onSuccess={onSuccess}
      onError={() => {
        if (BYPASS) { onSuccess('BYPASS'); return; }
        onError?.();
      }}
      onExpire={onExpire}
      options={{ theme: 'light', language: 'auto' }}
    />
  );
}
