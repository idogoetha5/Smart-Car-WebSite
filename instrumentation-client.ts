/**
 * Client-side Sentry init.
 *
 * Next.js loads this file; it does NOT load sentry.client.config.ts, which is
 * the webpack-era entry point and is dead code under Turbopack. That is why
 * monitoring was silently inert even after the DSN was set.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubBrowserEvent } from '@/lib/sentry-scrub';
import { restrictedSentryDataCollection } from '@/lib/sentry-data-collection';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
  dataCollection: restrictedSentryDataCollection,
  beforeSend: scrubBrowserEvent,
});

// Required for navigation spans in the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
