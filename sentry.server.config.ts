import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';
import { restrictedSentryDataCollection } from '@/lib/sentry-data-collection';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
  debug: false,
  dataCollection: restrictedSentryDataCollection,
  beforeSend: scrubEvent,
});
