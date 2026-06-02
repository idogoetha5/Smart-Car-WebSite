'use client';

import { useState, useCallback } from 'react';
import { calculateLeasingMonthly } from '@/lib/utils';

interface LeasingState {
  vehicleId: string;
  vehiclePricePerMonth: number;
  durationMonths: number;
  downPayment: number;
  mileagePackage: number;
}

export function useLeasing(initial?: Partial<LeasingState>) {
  const [state, setState] = useState<LeasingState>({
    vehicleId: '',
    vehiclePricePerMonth: 0,
    durationMonths: 36,
    downPayment: 0,
    mileagePackage: 15000,
    ...initial,
  });

  const monthlyPayment = calculateLeasingMonthly(
    state.vehiclePricePerMonth,
    state.durationMonths,
    state.downPayment,
    state.mileagePackage
  );

  const totalCost =
    monthlyPayment * state.durationMonths + state.downPayment;

  const update = useCallback(
    (updates: Partial<LeasingState>) =>
      setState((prev) => ({ ...prev, ...updates })),
    []
  );

  return { ...state, monthlyPayment, totalCost, update };
}
