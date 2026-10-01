import { NextResponse } from 'next/server';
import { audienceOf, driverRole, requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { sendPushToDrivers } from '@/lib/push';
import { testMessage } from '@/lib/push-messages';

/** Sends a "notifications work" message to the logged-in driver's/manager's devices. */
export async function POST(request: Request) {
  const { ok, driverId } = await requireDriverOrAdmin(audienceOf(request));
  if (!ok || !driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await driverRole(driverId);
  await sendPushToDrivers([driverId], testMessage(role === 'manager'));
  return NextResponse.json({ ok: true });
}
