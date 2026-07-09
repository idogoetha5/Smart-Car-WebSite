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
    return [];
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
