/**
 * Client-side Sentry init.
 *
 * Next.js loads this file; it does NOT load sentry.client.config.ts, which is
 * the webpack-era entry point and is dead code under Turbopack. That is why
 * monitoring was silently inert even after the DSN was set.
 */
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

// Required for navigation spans in the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
