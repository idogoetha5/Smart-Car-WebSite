import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveVehicleImageUrl } from '@/lib/car-images';

export async function GET() {
  const supabase = createAdminClient();

  // Explicit allowlist — this is a public endpoint, never leak internal
  // columns (e.g. cost/supplier notes) if they're added to the table later.
  const { data, error } = await supabase
    .from('cars_for_sale')
    .select('id, make, model, year, price, km, color, extras, image_url')
    .order('created_at', { ascending: false });

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  const cars = (data ?? []).map((car) => ({
    ...car,
    image_url: resolveVehicleImageUrl(car.image_url),
  }));
  return NextResponse.json({ data: cars });
}
