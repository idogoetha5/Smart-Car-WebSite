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

/**
 * Backs the admin pricing page's bulk actions: apply a percent or fixed
 * price to every selected vehicle for one season in a single request, or
 * revert every selected vehicle back to that season's own default (delete
 * their override rows). The UI is responsible for confirming with the admin
 * how many vehicles this affects before calling this — this endpoint itself
 * does not re-derive "all vehicles", it only ever touches the ids it's given.
 */
export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { season_id, vehicle_ids, mode, fixed_price, adjustment_percent } = body as {
    season_id?: string;
    vehicle_ids?: string[];
    mode?: 'default' | 'fixed' | 'percent';
    fixed_price?: number;
    adjustment_percent?: number;
  };

  if (!season_id || !Array.isArray(vehicle_ids) || vehicle_ids.length === 0) {
    return NextResponse.json({ error: 'season_id and a non-empty vehicle_ids array are required' }, { status: 400 });
  }
  if (mode !== 'default' && mode !== 'fixed' && mode !== 'percent') {
    return NextResponse.json({ error: "mode must be 'default', 'fixed' or 'percent'" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (mode === 'default') {
    const { error } = await supabase
      .from('vehicle_price_overrides')
      .delete()
      .eq('season_id', season_id)
      .in('vehicle_id', vehicle_ids);
    if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
    invalidatePricingConfigCache();
    return NextResponse.json({ success: true, affected: vehicle_ids.length });
  }

  const rows = vehicle_ids.map((vehicle_id) => ({
    vehicle_id,
    season_id,
    fixed_price: mode === 'fixed' ? fixed_price : null,
    adjustment_percent: mode === 'percent' ? adjustment_percent : null,
  }));

  const { data, error } = await supabase
    .from('vehicle_price_overrides')
    .upsert(rows, { onConflict: 'vehicle_id,season_id' })
    .select(OVERRIDE_COLUMNS);

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  invalidatePricingConfigCache();
  return NextResponse.json({ success: true, affected: rows.length, data: (data ?? []).map(mapOverrideRow) });
}
