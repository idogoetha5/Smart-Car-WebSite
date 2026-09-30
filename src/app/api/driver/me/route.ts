import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, verifyDriverToken } from '@/lib/admin-auth';
import { driverRole } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

/** Who is using the driver app: a driver, a branch manager, or an admin. */
export async function GET() {
  const cookieStore = await cookies();
  const driverId = await verifyDriverToken(cookieStore.get('driver_auth')?.value);
  if (driverId) {
    const role = await driverRole(driverId);
    if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await createAdminClient().from('drivers').select('name').eq('id', driverId).maybeSingle();
    return NextResponse.json({ role, canManage: role === 'manager', name: data?.name ?? '' });
  }
  if (await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ role: 'admin', canManage: true, name: '' });
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
