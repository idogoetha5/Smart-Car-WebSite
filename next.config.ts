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
  // Matches what Vercel's own domain-level HSTS setting actually serves
  // (one year, no preload) — not the value that gets sent. Vercel's
  // domain setting wins over this header regardless, so keep this in sync
  // with the dashboard rather than silently drifting. `preload` is a
  // one-way submission to browsers' built-in HSTS list; do not add it here
  // without also changing the Vercel setting and meaning it.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // GA4 + EmailJS + Cloudflare Turnstile + Sentry (bundled, no CDN needed)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.emailjs.com https://challenges.cloudflare.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
      // GA4 reporting + Sentry error ingestion. The Sentry org is on the EU
      // region, so its host is *.ingest.de.sentry.io — that is NOT a suffix
      // match for *.ingest.sentry.io, and every event was being blocked here.
      "connect-src 'self' https://*.supabase.co https://api.emailjs.com https://nominatim.openstreetmap.org https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
      "frame-src https://challenges.cloudflare.com",
      "worker-src blob:",
      // Defence-in-depth against injected <base>/<object> and form
      // exfiltration to a third-party endpoint.
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

// Private / transactional routes: keep them out of search results at the
// HTTP layer too, not only via robots.txt (which is advisory and doesn't
// remove already-indexed URLs).
const noIndexHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The root layout (app/layout.tsx) renders no <html>/<body> of its own —
  // those only exist inside app/[locale]/layout.tsx, since locale is a
  // top-level dynamic segment. That leaves genuinely unmatched URLs (no
  // route at all, not just a page-level notFound()) with no layout to
  // supply a document shell, and Next's classic root not-found.js only
  // returns a real 404 status for non-streamed responses. global-not-found
  // is exactly Next's documented answer for a top-level dynamic segment
  // like this — see app/global-not-found.tsx.
  experimental: {
    globalNotFound: true,
  },
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
    // TEMPORARY (2026-08-10): Vercel's Image Optimization is returning 402
    // OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED account-wide — every vehicle
    // image on the live site is broken. This bypasses Vercel's optimizer
    // entirely so <Image> falls back to serving the original file directly,
    // unresized/unconverted, which does not depend on that quota/billing at
    // all. Revert once the Vercel plan/usage issue is actually resolved —
    // this trades image weight and format conversion for the site working.
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/:locale/my-bookings/:path*', headers: noIndexHeaders },
      { source: '/:locale/booking-confirmation/:path*', headers: noIndexHeaders },
      { source: '/:locale/condition-report/:path*', headers: noIndexHeaders },
      { source: '/:locale/admin/:path*', headers: noIndexHeaders },
    ];
  },
  async redirects() {
    // Old-URL redirects for the pre-migration Hebrew slug structure live in
    // src/proxy.ts instead — the next-intl proxy runs before these config
    // redirects and was intercepting those paths first.
    return [
      {
        // Both smartcar.co.il and www.smartcar.co.il answered 200, so every
        // page existed at two addresses: link equity, crawl budget and cache
        // state split between them, and the canonical tag alone does not stop
        // a crawler fetching both. Kept here rather than as a Vercel domain
        // setting so it is reviewable and revertible with the rest of the
        // code. :path* preserves the path; Next.js carries the query string.
        source: '/:path*',
        has: [{ type: 'host', value: 'smartcar.co.il' }],
        destination: 'https://www.smartcar.co.il/:path*',
        permanent: true,
      },
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
