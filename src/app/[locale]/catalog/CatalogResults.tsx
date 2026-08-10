'use client';

import { useMemo, useState } from 'react';
import type { Vehicle, VehicleFilters } from '@/types';
import VehicleGrid from '@/components/catalog/VehicleGrid';
import VehicleFiltersPanel from '@/components/catalog/VehicleFilters';
import VehicleSearch from '@/components/catalog/VehicleSearch';

const CATEGORY_ORDER: Record<string, number> = {
  MINI: 0, ECONOMY: 1, COMPACT: 2, SEDAN: 3,
  CROSSOVER: 4, SUV: 5, LUXURY: 6, VAN: 7, COMMERCIAL: 8, ELECTRIC: 9,
};

/**
 * The full available fleet arrives already fetched from the server (see
 * page.tsx) — this only filters/sorts/searches over it in the browser.
 * There is no client fetch here at all, unlike the old useVehicles/SWR
 * version: that was the actual cause of the catalogue's initial HTML
 * having no vehicles (and no links to their /rental/[id] pages) for
 * crawlers to see.
 */
export default function CatalogResults({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<VehicleFilters>({ isAvailable: true });

  const filtered = useMemo(() => {
    let list = initialVehicles;

    if (filters.category && filters.category !== 'ALL') {
      if (filters.category === 'ECONOMY_COMPACT') {
        list = list.filter(v => v.category === 'ECONOMY' || v.category === 'COMPACT');
      } else {
        list = list.filter(v => v.category === filters.category);
      }
    }
    if (filters.transmission && filters.transmission !== 'ALL') {
      list = list.filter(v => v.transmission === filters.transmission);
    }
    if (filters.fuelType && filters.fuelType !== 'ALL') {
      list = list.filter(v => v.fuelType === filters.fuelType);
    }
    if (filters.maxPricePerDay) {
      list = list.filter(v => v.pricePerDay <= filters.maxPricePerDay!);
    }
    if (filters.seats != null) {
      const s = filters.seats;
      list = list.filter(v => (s >= 8 ? v.seats >= 8 : v.seats === s));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v => `${v.make} ${v.model} ${v.year}`.toLowerCase().includes(q));
    }

    const sorted = [...list].sort(
      (a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
    );

    const seen = new Set<string>();
    return sorted.filter(v => {
      const key = `${v.make} ${v.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [initialVehicles, filters, search]);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <aside className="lg:w-72 shrink-0">
        <div className="sticky top-24">
          <VehicleFiltersPanel filters={filters} onChange={(f) => setFilters({ ...f, isAvailable: true })} />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <VehicleSearch value={search} onChange={setSearch} />
        </div>
        <VehicleGrid vehicles={filtered} />
      </div>
    </div>
  );
}
