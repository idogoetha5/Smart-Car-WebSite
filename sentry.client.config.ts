import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
  // Defaults to false in v10; pinned explicitly so an SDK upgrade cannot
  // quietly start attaching IPs, cookies and headers.
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
