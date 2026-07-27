import { MetadataRoute } from 'next';

// Must not depend on NEXT_PUBLIC_APP_URL being present — when it was
// missing this emitted "undefined/sitemap.xml" and pointed crawlers at a
// broken URL.
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private / transactional routes must stay out of the index:
        // my-bookings and booking-confirmation expose a customer's own
        // booking view, and the condition report is an operational form.
        disallow: [
          '/*/admin/',
          '/api/',
          '/*/my-bookings',
          '/*/booking-confirmation',
          '/*/condition-report',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
