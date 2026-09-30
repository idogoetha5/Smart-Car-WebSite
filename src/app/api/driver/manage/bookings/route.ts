import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

/** Branch manager: recent bookings (minimal fields) to attach a task to an existing rental. */
export async function GET() {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, customer_name, custom_vehicle_name, vehicle:vehicles(make, model)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.error('[driver/manage/bookings] list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
