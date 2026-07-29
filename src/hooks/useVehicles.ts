'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { dataFetcher } from '@/lib/swr';
import type { Vehicle, VehicleFilters } from '@/types';

/** Only the filters `/api/vehicles` itself understands belong in the URL. */
function buildQuery(filters: VehicleFilters): string {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL' && filters.category !== 'ECONOMY_COMPACT')
    params.set('category', filters.category);
  if (filters.transmission && filters.transmission !== 'ALL')
    params.set('transmission', filters.transmission);
  if (filters.fuelType && filters.fuelType !== 'ALL')
    params.set('fuel_type', filters.fuelType);
  if (filters.maxPricePerDay)
    params.set('max_price', String(filters.maxPricePerDay));
  if (filters.isAvailable !== undefined)
    params.set('available', String(filters.isAvailable));
  return params.toString();
}

export function useVehicles(initialFilters?: VehicleFilters) {
  const [filters, setFilters] = useState<VehicleFilters>(initialFilters ?? {});

  const { data, error, isLoading, mutate } = useSWR<Vehicle[] | null>(
    `/api/vehicles?${buildQuery(filters)}`,
    dataFetcher,
  );

  // ECONOMY_COMPACT and `seats` have no server-side equivalent, so they are
  // applied here. Keeping them out of the SWR key is deliberate: switching
  // between them re-derives from the response already in cache instead of
  // firing another request.
  const vehicles = useMemo(() => {
    let list = data ?? [];
    if (filters.category === 'ECONOMY_COMPACT') {
      list = list.filter(v => v.category === 'ECONOMY' || v.category === 'COMPACT');
    }
    if (filters.seats != null) {
      const s = filters.seats;
      list = list.filter(v => (s >= 8 ? v.seats >= 8 : v.seats === s));
    }
    return list;
  }, [data, filters.category, filters.seats]);

  return {
    vehicles,
    isLoading,
    error: error ? (error as Error).message : null,
    filters,
    setFilters,
    refetch: mutate,
  };
}
