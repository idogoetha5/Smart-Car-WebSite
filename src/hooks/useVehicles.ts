'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Vehicle, VehicleFilters } from '@/types';

export function useVehicles(initialFilters?: VehicleFilters) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<VehicleFilters>(initialFilters ?? {});

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
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

      const res = await fetch(`/api/vehicles?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      const json = await res.json();
      let data: Vehicle[] = json.data ?? [];
      if (filters.category === 'ECONOMY_COMPACT') {
        data = data.filter(v => v.category === 'ECONOMY' || v.category === 'COMPACT');
      }
      if (filters.seats != null) {
        const s = filters.seats;
        data = data.filter(v => s >= 8 ? v.seats >= 8 : v.seats === s);
      }
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  return { vehicles, isLoading, error, filters, setFilters, refetch: fetchVehicles };
}
