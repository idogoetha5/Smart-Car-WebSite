'use client';

import { Turnstile } from '@marsidev/react-turnstile';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'; // Cloudflare test key (always passes)

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
      onError={onError}
      onExpire={onExpire}
      options={{ theme: 'light', language: 'auto' }}
    />
  );
}
