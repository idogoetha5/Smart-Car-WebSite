'use client';

import useSWR from 'swr';
import { dataFetcher } from '@/lib/swr';
import type { PricingConfig } from '@/lib/seasonal';

const EMPTY_CONFIG: PricingConfig = { seasons: [], overrides: [] };

/** Backs every seasonal-price display — SWR dedupes this key, so N vehicle cards on one page still fire a single request. */
export function usePricingConfig() {
  const { data, error, isLoading } = useSWR<PricingConfig | null>('/api/pricing-config', dataFetcher);
  return {
    config: data ?? EMPTY_CONFIG,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
