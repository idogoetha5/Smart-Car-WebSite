import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // GA4 + EmailJS + Cloudflare Turnstile + Sentry (bundled, no CDN needed)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.emailjs.com https://challenges.cloudflare.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
      // GA4 reporting + Sentry error ingestion
      "connect-src 'self' https://*.supabase.co https://api.emailjs.com https://nominatim.openstreetmap.org https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://*.ingest.sentry.io",
      "frame-src https://challenges.cloudflare.com",
      "worker-src blob:",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // @sparticuz/chromium ships binary assets (a .br archive) that must be
  // copied as-is into the serverless function, not bundled/relocated —
  // without this the quote-PDF route fails at runtime with "input
  // directory .../chromium/bin does not exist".
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // The chromium binary is read dynamically at runtime (fs calls inside
  // chromium.executablePath()), not via a static import, so Next.js's file
  // tracer misses it and drops it from the deployed function unless told
  // explicitly to keep it.
  outputFileTracingIncludes: {
    '/api/admin/quote-pdf/route': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'iovpoxmdsgsstaduggvb.supabase.co' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async redirects() {
    // Old site (pre smartcar.co.il migration) used root-level Hebrew slugs
    // with no locale prefix. Google still has ~27 of these indexed; without
    // these redirects they 404 on the new site, which was breaking indexed
    // search results and losing existing SEO link equity.
    return [
      { source: '/אודות', destination: '/he/about', permanent: true },
      { source: '/סניפים', destination: '/he/branches', permanent: true },
      { source: '/השכרת-רכב', destination: '/he/rental', permanent: true },
      { source: '/לוח-רכבים-למכירה', destination: '/he/cars-for-sale', permanent: true },
      { source: '/שרותים/מכירת-רכב', destination: '/he/cars-for-sale', permanent: true },
      { source: '/שרותים/השכרת-רכב', destination: '/he/rental', permanent: true },
      { source: '/שרותים/ליסינג-עסקי', destination: '/he/leasing', permanent: true },
      { source: '/שרותים/business-leasing', destination: '/he/leasing', permanent: true },
      // Old fleet section (category pages + individual vehicle pages, e.g.
      // /צי-רכבים/קבוצה-a/קיה-פיקנטו) has no 1:1 equivalent under the new
      // vehicle data model — send all of it to the live catalog.
      { source: '/צי-רכבים', destination: '/he/catalog', permanent: true },
      { source: '/צי-רכבים/:path*', destination: '/he/catalog', permanent: true },
      { source: '/יונדאי-inspire-1-4-i20', destination: '/he/catalog', permanent: true },
      { source: '/יונדאי-inspire-11-4-i20', destination: '/he/catalog', permanent: true },
    ];
  },
};

const withSentry = (config: NextConfig) =>
  withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: true,
    // Only upload source maps in CI/production builds when SENTRY_AUTH_TOKEN is set
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    telemetry: false,
  });

export default withSentry(withNextIntl(nextConfig));
