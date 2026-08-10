import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getVehicles } from '@/lib/db/vehicles';
import CatalogResults from './CatalogResults';

// Same reasoning as the homepage's featured-vehicles fetch and the branch
// pages: the catalogue doesn't need to be live to the second, and this
// keeps every page load off a cold Supabase round-trip.
export const revalidate = 3600;

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const isHe = locale === 'he';

  let vehicles: Awaited<ReturnType<typeof getVehicles>> = [];
  try {
    vehicles = await getVehicles({ isAvailable: true });
  } catch {}

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <h1 className="text-4xl font-black text-gray-900 mb-2">{t('title')}</h1>
        {/* The catalogue lists only part of the fleet, so the count is
            never presented as the whole of what is available. */}
        <p className="text-gray-600 max-w-3xl">
          {isHe
            ? 'באתר מוצג מבחר מהצי. לאחר שליחת הבקשה נבדוק את הצי המלא ונאשר את הרכב או קבוצת הרכב המתאימה.'
            : 'The website shows a selection from our fleet. After you send the request, we will check the full fleet and confirm the available vehicle or vehicle group.'}
        </p>
      </div>

      <CatalogResults initialVehicles={vehicles} />
    </div>
  );
}
