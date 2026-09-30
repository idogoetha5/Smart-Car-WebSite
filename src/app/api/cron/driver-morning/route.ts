import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { israelDayRange, israelToday } from '@/lib/israel-day';
import { morningDigestMessage, type TaskSummary } from '@/lib/push-messages';
import { sendPushToDrivers } from '@/lib/push';

/**
 * Daily at ~07:30 Israel (vercel.json): "בוקר טוב" notification to every
 * active driver with open tasks today — how many, and the first one.
 * Vercel Cron authenticates with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { startISO, endISO } = israelDayRange(israelToday());
  const select =
    'type, assigned_driver_id, booking:bookings!inner(customer_name, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location)';
  type Row = {
    type: 'pickup' | 'return';
    assigned_driver_id: string | null;
    booking: { customer_name: string; pickup_time: string | null; return_time: string | null; pickup_location: string | null; dropoff_location: string | null };
  };

  const [pickups, returns, drivers] = await Promise.all([
    supabase.from('driver_tasks').select(select).eq('type', 'pickup').eq('status', 'open').not('assigned_driver_id', 'is', null)
      .gte('booking.pickup_date', startISO).lt('booking.pickup_date', endISO).returns<Row[]>(),
    supabase.from('driver_tasks').select(select).eq('type', 'return').eq('status', 'open').not('assigned_driver_id', 'is', null)
      .gte('booking.dropoff_date', startISO).lt('booking.dropoff_date', endISO).returns<Row[]>(),
    supabase.from('drivers').select('id, name').eq('active', true).eq('role', 'driver'),
  ]);
  if (pickups.error || returns.error || drivers.error) {
    console.error('[cron/driver-morning] lookup failed:', pickups.error?.message ?? returns.error?.message ?? drivers.error?.message);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  const byDriver = new Map<string, TaskSummary[]>();
  for (const row of [...(pickups.data ?? []), ...(returns.data ?? [])]) {
    if (!row.assigned_driver_id) continue;
    const location = row.type === 'pickup' ? row.booking.pickup_location : row.booking.dropoff_location;
    const time = row.type === 'pickup' ? row.booking.pickup_time : row.booking.return_time;
    const list = byDriver.get(row.assigned_driver_id) ?? [];
    list.push({
      type: row.type,
      customerName: row.booking.customer_name,
      day: israelToday(),
      time: time ? time.slice(0, 5) : null,
      address: location && location !== 'לא צוין' ? location : null,
    });
    byDriver.set(row.assigned_driver_id, list);
  }

  let sent = 0;
  for (const driver of drivers.data ?? []) {
    const tasks = byDriver.get(driver.id);
    if (!tasks?.length) continue;
    await sendPushToDrivers([driver.id], morningDigestMessage(driver.name, tasks));
    sent += 1;
  }
  return NextResponse.json({ success: true, drivers: sent });
}
