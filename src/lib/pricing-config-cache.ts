import { revalidateTag } from 'next/cache';

export const PRICING_CONFIG_CACHE_TAG = 'pricing-config';

/**
 * Call from every admin route that writes a pricing_season or
 * vehicle_price_overrides row. `{ expire: 0 }` forces immediate expiry
 * rather than Next 16's default stale-while-revalidate ('max') behavior —
 * the whole point here is that a manager saving a price must never leave a
 * customer looking at the old one, not even for one background-refreshed
 * request.
 */
export function invalidatePricingConfigCache(): void {
  revalidateTag(PRICING_CONFIG_CACHE_TAG, { expire: 0 });
}
