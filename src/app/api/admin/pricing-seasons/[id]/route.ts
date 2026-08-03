import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { SEASON_COLUMNS, mapSeasonRow } from '@/lib/db/pricing';
import { invalidatePricingConfigCache } from '@/lib/pricing-config-cache';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

const ALLOWED = [
  'name_he', 'name_en', 'start_date', 'end_date',
  'recurs_annually', 'adjustment_percent', 'fixed_price', 'priority', 'is_active',
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
  }

  const { data, error } = await supabase
    .from('pricing_seasons')
    .update(payload)
    .eq('id', id)
    .select(SEASON_COLUMNS)
    .single();
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  invalidatePricingConfigCache();
  return NextResponse.json({ data: mapSeasonRow(data) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('pricing_seasons').delete().eq('id', id);
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  invalidatePricingConfigCache();
  return NextResponse.json({ success: true });
}
