import { NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Vehicle picker for the driver app's walk-in quick-booking form. The
 * public GET /api/vehicles deliberately excludes license_plate from its
 * column allowlist (VEHICLE_COLUMNS in src/lib/db/vehicles.ts) since it's
 * unauthenticated — a driver matching a physical car needs the plate, so
 * this is its own driver-or-admin-gated route rather than reusing that one.
 */
export async function GET(request: Request) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ?all=1: garage / wash jobs may be for a car that is off the rental list right now.
  const all = new URL(request.url).searchParams.get('all') === '1';
  const supabase = createAdminClient();
  let query = supabase.from('vehicles').select('id, make, model, license_plate, price_per_day');
  if (!all) query = query.eq('is_available', true);
  const { data, error } = await query.order('make', { ascending: true }).order('model', { ascending: true });

  if (error) {
    console.error('[driver/vehicles] lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json(
    { data: data ?? [] },
    { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' } }
  );
}
