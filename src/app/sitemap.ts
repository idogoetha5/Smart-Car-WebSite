import { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { BRANCHES } from '@/lib/branches';
import { DELIVERY_CITIES } from '@/lib/delivery-cities';

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

// Static pages don't change on every build — reporting `new Date()` for
// each one told crawlers the whole site changed on every deploy, which
// makes lastModified a useless (and distrusted) signal. This is the date
// the static content was last meaningfully edited; bump it when a static
// page's content actually changes.
const STATIC_CONTENT_LAST_MODIFIED = new Date('2026-07-28T00:00:00Z');
// The branch-page copy and structured data are shared across every branch.
// Keep each branch entry fresh when that shared content changes, so crawlers
// have an accurate signal that the location pages should be revisited.
const BRANCH_PAGE_LAST_MODIFIED = new Date('2026-10-23T00:00:00Z');
const TEL_AVIV_BRANCH_LAST_MODIFIED = new Date('2026-10-23T00:00:00Z');
const RENTAL_GUIDANCE_LAST_MODIFIED = new Date('2026-10-23T00:00:00Z');
const DELIVERY_GUIDANCE_LAST_MODIFIED = new Date('2026-10-24T00:00:00Z');
const NATIONWIDE_RENTAL_LAST_MODIFIED = new Date('2026-10-19T00:00:00Z');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/he`,
      lastModified: NATIONWIDE_RENTAL_LAST_MODIFIED,
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: { he: `${baseUrl}/he`, en: `${baseUrl}/en` },
      },
    },
    { url: `${baseUrl}/en`, lastModified: NATIONWIDE_RENTAL_LAST_MODIFIED, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/he/catalog`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/en/catalog`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/he/rental`, lastModified: RENTAL_GUIDANCE_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/en/rental`, lastModified: RENTAL_GUIDANCE_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/he/leasing`, lastModified: RENTAL_GUIDANCE_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/en/leasing`, lastModified: RENTAL_GUIDANCE_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/he/contact`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/en/contact`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/he/cars-for-sale`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/en/cars-for-sale`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/he/branches`, lastModified: NATIONWIDE_RENTAL_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/en/branches`, lastModified: NATIONWIDE_RENTAL_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.8 },
    // Dedicated per-branch landing pages, added 2026-08-04 for city-specific
    // organic search ("השכרת רכב <city>") — higher priority than the /branches
    // index since these are the pages meant to actually rank.
    ...BRANCHES.flatMap((b) => [
      {
        url: `${baseUrl}/he/branches/${b.id}`,
        lastModified: b.id === 'telaviv' ? TEL_AVIV_BRANCH_LAST_MODIFIED : BRANCH_PAGE_LAST_MODIFIED,
        changeFrequency: b.id === 'telaviv' ? 'weekly' as const : 'monthly' as const,
        priority: b.id === 'telaviv' ? 0.85 : 0.7,
      },
      {
        url: `${baseUrl}/en/branches/${b.id}`,
        lastModified: b.id === 'telaviv' ? TEL_AVIV_BRANCH_LAST_MODIFIED : BRANCH_PAGE_LAST_MODIFIED,
        changeFrequency: b.id === 'telaviv' ? 'weekly' as const : 'monthly' as const,
        priority: b.id === 'telaviv' ? 0.85 : 0.7,
      },
    ]),
    { url: `${baseUrl}/he/about`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/en/about`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/he/privacy`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/en/privacy`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/he/terms`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/en/terms`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/he/accessibility`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/en/accessibility`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/he/insurance`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/en/insurance`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/he/guide`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/en/guide`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.6 },
    // Delivery-only city pages — no branch at these addresses, only the
    // existing door-to-door delivery service. Indexed via this sitemap;
    // linked on-site only as the small "also deliver to" line on /branches.
    ...DELIVERY_CITIES.flatMap((c) => [
      { url: `${baseUrl}/he/delivery/${c.slug}`, lastModified: DELIVERY_GUIDANCE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.5 },
      { url: `${baseUrl}/en/delivery/${c.slug}`, lastModified: DELIVERY_GUIDANCE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.5 },
    ]),
    { url: `${baseUrl}/he/cookies`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/en/cookies`, lastModified: STATIC_CONTENT_LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.3 },
    ...[
      'business', 'commercial', 'daily', 'hourly',
      'leasing', 'monthly', 'new-driver', 'sale',
    ].flatMap((type) => [
      { url: `${baseUrl}/he/services/${type}`, lastModified: RENTAL_GUIDANCE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.6 },
      { url: `${baseUrl}/en/services/${type}`, lastModified: RENTAL_GUIDANCE_LAST_MODIFIED, changeFrequency: 'monthly' as const, priority: 0.6 },
    ]),
  ];

  try {
    const supabase = createAdminClient();
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, updated_at')
      .eq('is_available', true);

    const vehicleRoutes: MetadataRoute.Sitemap = (vehicles ?? []).flatMap((v) => [
      {
        url: `${baseUrl}/he/rental/${v.id}`,
        lastModified: new Date(v.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
      {
        url: `${baseUrl}/en/rental/${v.id}`,
        lastModified: new Date(v.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
    ]);

    return [...staticRoutes, ...vehicleRoutes];
  } catch {
    return staticRoutes;
  }
}
