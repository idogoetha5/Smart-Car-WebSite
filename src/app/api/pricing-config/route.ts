import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getActiveSeasons, getAllOverrides } from '@/lib/db/pricing';
import { PRICING_CONFIG_CACHE_TAG } from '@/lib/pricing-config-cache';
import type { PricingConfig } from '@/lib/seasonal';

/**
 * Every customer-facing price render (vehicle cards, rental page, quote
 * builder) calls this route, so a DB round-trip on every single hit is
 * wasted work. Cached briefly and only ever invalidated explicitly — see
 * invalidatePricingConfigCache(), called by every admin route that writes a
 * season or override — never left to expire stale on its own for more than
 * this ceiling. Never caches an error response.
 */
const getCachedPricingConfig = unstable_cache(
  async (): Promise<PricingConfig> => {
    const [seasons, overrides] = await Promise.all([getActiveSeasons(), getAllOverrides()]);
    return { seasons, overrides };
  },
  ['pricing-config'],
  { tags: [PRICING_CONFIG_CACHE_TAG], revalidate: 30 }
);

export async function GET() {
  try {
    const data = await getCachedPricingConfig();
    return NextResponse.json({ data });
  } catch (error) {
    console.error((error as Error).message);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }
}
