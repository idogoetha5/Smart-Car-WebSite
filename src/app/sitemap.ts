import { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/he`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: { he: `${baseUrl}/he`, en: `${baseUrl}/en` },
      },
    },
    { url: `${baseUrl}/en`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/he/catalog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/en/catalog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/he/rental`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/en/rental`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/he/leasing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/en/leasing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/he/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/en/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
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
