import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

/** Status view for Daniel's "is it signed yet" screen. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, booking_id, type, odometer_km, fuel_eighths, status, signed_at, video_sha256, booking:bookings(id, customer_name, customer_email, vehicle:vehicles(make, model, license_plate))'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/inspections/[id]] lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
