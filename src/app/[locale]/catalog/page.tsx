'use client';

import { useState } from 'react';

const CATEGORY_ORDER: Record<string, number> = {
  MINI: 0, ECONOMY: 1, COMPACT: 2, SEDAN: 3,
  CROSSOVER: 4, SUV: 5, LUXURY: 6, VAN: 7, COMMERCIAL: 8, ELECTRIC: 9,
};
import { useTranslations, useLocale } from 'next-intl';
import { useVehicles } from '@/hooks/useVehicles';
import VehicleGrid from '@/components/catalog/VehicleGrid';
import VehicleFiltersPanel from '@/components/catalog/VehicleFilters';
import VehicleSearch from '@/components/catalog/VehicleSearch';

export default function CatalogPage() {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const { vehicles, isLoading, filters, setFilters } = useVehicles({ isAvailable: true });

  const sorted = (search
    ? vehicles.filter((v) =>
        `${v.make} ${v.model} ${v.year}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : vehicles
  ).sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));

  const seen = new Set<string>();
  const filtered = sorted.filter(v => {
    const key = `${v.make} ${v.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <h1 className="text-4xl font-black text-gray-900 mb-2">{t('title')}</h1>
        {/* The catalogue lists only part of the fleet, so the count is
            never presented as the whole of what is available. */}
        <p className="text-gray-600 max-w-3xl">
          {locale === 'he'
            ? 'באתר מוצג מבחר מהצי. לאחר שליחת הבקשה נבדוק את הצי המלא ונאשר את הרכב או קבוצת הרכב המתאימה.'
            : 'The website shows a selection from our fleet. After you send the request, we will check the full fleet and confirm the available vehicle or vehicle group.'}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-24">
            <VehicleFiltersPanel filters={filters} onChange={(f) => setFilters({ ...f, isAvailable: true })} />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <VehicleSearch value={search} onChange={setSearch} />
          </div>
          <VehicleGrid vehicles={filtered} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
