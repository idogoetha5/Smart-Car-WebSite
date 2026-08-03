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

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('pricing_seasons')
    .select(SEASON_COLUMNS)
    .order('priority', { ascending: false });
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data: (data ?? []).map(mapSeasonRow) });
}

// Explicit allowlist rather than insert(body) — same reasoning as
// api/admin/vehicles/route.ts: a column added later must not become
// writable here until someone decides it should be.
const ALLOWED = [
  'name_he', 'name_en', 'start_date', 'end_date',
  'recurs_annually', 'adjustment_percent', 'fixed_price', 'priority', 'is_active',
] as const;

export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const body = await request.json();

  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  if (!payload.name_he || !payload.name_en || !payload.start_date || !payload.end_date) {
    return NextResponse.json({ error: 'name_he, name_en, start_date and end_date are required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('pricing_seasons').insert(payload).select(SEASON_COLUMNS).single();
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  invalidatePricingConfigCache();
  return NextResponse.json({ data: mapSeasonRow(data) });
}
