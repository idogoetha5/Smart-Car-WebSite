'use client';

import { useState, useCallback } from 'react';

interface AvailabilityResult {
  available: boolean | null;
  isChecking: boolean;
  error: string | null;
}

export function useAvailability() {
  const [state, setState] = useState<AvailabilityResult>({
    available: null,
    isChecking: false,
    error: null,
  });

  const checkAvailability = useCallback(
    async (vehicleId: string, pickupDate: string, dropoffDate: string) => {
      setState({ available: null, isChecking: true, error: null });
      try {
        const params = new URLSearchParams({ vehicleId, pickupDate, dropoffDate });
        const res = await fetch(`/api/availability?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to check availability');
        const json = await res.json();
        setState({ available: json.available, isChecking: false, error: null });
      } catch (err) {
        setState({
          available: null,
          isChecking: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    []
  );

  return { ...state, checkAvailability };
}
