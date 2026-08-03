import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { OVERRIDE_COLUMNS, mapOverrideRow } from '@/lib/db/pricing';
import { invalidatePricingConfigCache } from '@/lib/pricing-config-cache';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('vehicle_price_overrides').select(OVERRIDE_COLUMNS);
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data: (data ?? []).map(mapOverrideRow) });
}

export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const body = await request.json();

  const { vehicle_id, season_id, fixed_price, adjustment_percent } = body;
  if (!vehicle_id || !season_id) {
    return NextResponse.json({ error: 'vehicle_id and season_id are required' }, { status: 400 });
  }
  const hasFixed = fixed_price !== undefined && fixed_price !== null && fixed_price !== '';
  const hasPercent = adjustment_percent !== undefined && adjustment_percent !== null && adjustment_percent !== '';
  if (hasFixed === hasPercent) {
    return NextResponse.json({ error: 'Provide exactly one of fixed_price or adjustment_percent' }, { status: 400 });
  }

  const payload = {
    vehicle_id,
    season_id,
    fixed_price: hasFixed ? fixed_price : null,
    adjustment_percent: hasPercent ? adjustment_percent : null,
  };

  const { data, error } = await supabase
    .from('vehicle_price_overrides')
    .insert(payload)
    .select(OVERRIDE_COLUMNS)
    .single();
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  invalidatePricingConfigCache();
  return NextResponse.json({ data: mapOverrideRow(data) });
}
