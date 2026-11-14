import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mapRow, VEHICLE_COLUMNS } from '@/lib/db/vehicles';

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .order('created_at', { ascending: false });

  const category = searchParams.get('category');
  const transmission = searchParams.get('transmission');
  const fuelType = searchParams.get('fuel_type');
  const maxPrice = searchParams.get('max_price');
  const available = searchParams.get('available');

  if (category && category !== 'ALL') query = query.eq('category', category);
  if (transmission && transmission !== 'ALL')
    query = query.eq('transmission', transmission);
  if (fuelType && fuelType !== 'ALL') query = query.eq('fuel_type', fuelType);
  if (maxPrice) query = query.lte('price_per_day', parseFloat(maxPrice));
  if (available === 'true') query = query.eq('is_available', true);

  const { data, error } = await query;

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }

  // Public fleet list, read on every catalogue visit: the CDN keeps it for a minute (as the rental
  // page's own fleet cache does) instead of a database query per visitor. Errors are not cached.
  return NextResponse.json({ data: (data ?? []).map(mapRow) }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
