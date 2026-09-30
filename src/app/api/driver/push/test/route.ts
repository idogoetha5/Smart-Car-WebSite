import { NextResponse } from 'next/server';
import { driverRole, requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { sendPushToDrivers } from '@/lib/push';
import { testMessage } from '@/lib/push-messages';

/** Sends a "notifications work" message to the logged-in driver's/manager's devices. */
export async function POST() {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok || !driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await driverRole(driverId);
  await sendPushToDrivers([driverId], testMessage(role === 'manager'));
  return NextResponse.json({ ok: true });
}
