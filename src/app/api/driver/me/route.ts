import { NextResponse } from 'next/server';
import { audienceOf, driverRole, requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Who is using the app: a driver, a branch manager, or an admin.
 * The manager app asks with ?as=manager (prefers the manager session);
 * the driver app asks without it (prefers the driver session).
 */
export async function GET(request: Request) {
  const { ok, driverId } = await requireDriverOrAdmin(audienceOf(request));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!driverId) return NextResponse.json({ role: 'admin', canManage: true, name: '' });
  const role = await driverRole(driverId);
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await createAdminClient().from('drivers').select('name').eq('id', driverId).maybeSingle();
  return NextResponse.json({ role, canManage: role === 'manager', name: data?.name ?? '' });
}
