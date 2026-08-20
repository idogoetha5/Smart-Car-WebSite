import { getVehicles } from '@/lib/db/vehicles';
import { getActiveSeasons, getAllOverrides } from '@/lib/db/pricing';
import { getSeasonalPriceRange } from '@/lib/seasonal';

export type WhatsAppRentalQuote = { id: string; title: string; pricePerDay: number; total: number; days: number };

/** Read-only catalogue suggestions. They are never a reservation or availability guarantee. */
export async function getWhatsAppRentalQuotes(preference: string | undefined, pickupDate: string, dropoffDate: string): Promise<WhatsAppRentalQuote[]> {
  const category = preference === 'ALL' ? undefined : preference;
  const [vehicles, seasons, overrides] = await Promise.all([
    getVehicles({ category: category as never, isAvailable: true }),
    getActiveSeasons(),
    getAllOverrides(),
  ]);
  return vehicles.slice(0, 3).map((vehicle) => {
    const priced = getSeasonalPriceRange(vehicle, { seasons, overrides }, new Date(`${pickupDate}T00:00:00Z`), new Date(`${dropoffDate}T00:00:00Z`));
    return { id: vehicle.id, title: `${vehicle.make} ${vehicle.model}`, pricePerDay: priced.avgPricePerDay, total: priced.subtotal, days: priced.days };
  });
}
