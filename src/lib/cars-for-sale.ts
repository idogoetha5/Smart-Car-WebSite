import { resolveVehicleImageUrl } from '@/lib/car-images';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * The public sales catalogue contract. Keep this deliberately narrower than
 * the database row: these are the only facts a customer-facing channel may
 * quote without a person checking a document or a specific vehicle.
 */
export type CarForSale = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  km: number | null;
  color: string | null;
  extras: string | null;
  image_url: string | null;
};

export const CAR_FOR_SALE_COLUMNS = 'id, make, model, year, price, km, color, extras, image_url';

/**
 * Shared implementation behind the public API and WhatsApp.  This prevents
 * the conversation engine from depending on undocumented database columns or
 * claiming information that the public cars-for-sale API does not expose.
 */
export async function getCarsForSale(): Promise<CarForSale[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('cars_for_sale')
    .select(CAR_FOR_SALE_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`[cars-for-sale] catalogue lookup failed: ${error.message}`);
  return (data ?? []).map((car) => ({
    id: String(car.id),
    make: String(car.make ?? ''),
    model: String(car.model ?? ''),
    year: Number(car.year),
    price: Number(car.price),
    km: car.km === null || car.km === undefined ? null : Number(car.km),
    color: car.color === null || car.color === undefined ? null : String(car.color),
    extras: car.extras === null || car.extras === undefined ? null : String(car.extras),
    image_url: resolveVehicleImageUrl(car.image_url),
  }));
}
