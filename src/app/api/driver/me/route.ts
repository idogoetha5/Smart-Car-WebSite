import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, verifyDriverToken } from '@/lib/admin-auth';
import { driverRole } from '@/lib/driver-route-auth';

/** Who is using the driver app: a driver, a branch manager, or an admin. */
export async function GET() {
  const cookieStore = await cookies();
  const driverId = await verifyDriverToken(cookieStore.get('driver_auth')?.value);
  if (driverId) {
    const role = await driverRole(driverId);
    if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ role, canManage: role === 'manager' });
  }
  if (await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ role: 'admin', canManage: true });
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
