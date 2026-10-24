import { unstable_cache } from 'next/cache';
import { getVehicles } from '@/lib/db/vehicles';

// This app has not enabled Cache Components; follow its existing Data Cache
// pattern rather than migrating the whole application for a public fleet read.
// No dates, addresses, cookies or customer data enter this shared cache.
export const getRentalPageVehicles = unstable_cache(
  () => getVehicles({ isAvailable: true }),
  ['public-rental-page-fleet-v1'],
  { revalidate: 60 },
);
