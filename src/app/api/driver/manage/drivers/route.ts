import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

/** Branch manager: active drivers to assign tasks to (names only). */
export async function GET() {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('drivers').select('id, name, active').eq('active', true).eq('role', 'driver').order('name');
  if (error) {
    console.error('[driver/manage/drivers] list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
