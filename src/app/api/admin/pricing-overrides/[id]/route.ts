import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { OVERRIDE_COLUMNS, mapOverrideRow } from '@/lib/db/pricing';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const { fixed_price, adjustment_percent } = body;
  const hasFixed = fixed_price !== undefined && fixed_price !== null && fixed_price !== '';
  const hasPercent = adjustment_percent !== undefined && adjustment_percent !== null && adjustment_percent !== '';
  if (hasFixed === hasPercent) {
    return NextResponse.json({ error: 'Provide exactly one of fixed_price or adjustment_percent' }, { status: 400 });
  }

  const payload = {
    fixed_price: hasFixed ? fixed_price : null,
    adjustment_percent: hasPercent ? adjustment_percent : null,
  };

  const { data, error } = await supabase
    .from('vehicle_price_overrides')
    .update(payload)
    .eq('id', id)
    .select(OVERRIDE_COLUMNS)
    .single();
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data: mapOverrideRow(data) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('vehicle_price_overrides').delete().eq('id', id);
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
