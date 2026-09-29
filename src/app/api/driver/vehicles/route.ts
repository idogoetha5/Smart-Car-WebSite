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
export async function GET() {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, make, model, license_plate, price_per_day')
    .eq('is_available', true)
    .order('make', { ascending: true })
    .order('model', { ascending: true });

  if (error) {
    console.error('[driver/vehicles] lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
