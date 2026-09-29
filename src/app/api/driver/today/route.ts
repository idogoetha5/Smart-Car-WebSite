import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { israelToday, israelTomorrow, israelDayRange } from '@/lib/israel-day';
import { formatLocationForDriver } from '@/lib/location-display';
import { numericOrderReference } from '@/lib/order-reference';

const SEARCH_WINDOW_DAYS = 45;
const TASK_FETCH_LIMIT = 500;

interface TaskRow {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  booking: {
    id: string;
    customer_name: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_time: string | null;
    return_time: string | null;
    pickup_location: string;
    dropoff_location: string;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
}

interface InspectionSlot {
  id: string;
  status: 'awaiting_signature' | 'signed';
}

async function inspectionMapFor(bookingIds: string[]): Promise<Map<string, InspectionSlot>> {
  const map = new Map<string, InspectionSlot>();
  if (bookingIds.length === 0) return map;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select('id, booking_id, type, status, created_at')
    .in('booking_id', bookingIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[driver/today] inspection lookup failed:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(`${row.booking_id}:${row.type}`, { id: row.id, status: row.status });
  }
  return map;
}

function shapeTask(task: TaskRow, inspections: Map<string, InspectionSlot>) {
  const booking = task.booking;
  const time = task.type === 'pickup' ? booking?.pickup_time : booking?.return_time;
  const location = task.type === 'pickup' ? booking?.pickup_location : booking?.dropoff_location;

  return {
    taskId: task.id,
    taskStatus: task.status,
    type: task.type,
    bookingId: booking?.id ?? '',
    bookingNumber: booking ? numericOrderReference(booking.id) : '',
    customerName: booking?.customer_name ?? '',
    vehicleName: booking?.vehicle ? `${booking.vehicle.make} ${booking.vehicle.model}` : '—',
    licensePlate: booking?.vehicle?.license_plate ?? '—',
    location: formatLocationForDriver(location),
    time,
    inspection: booking ? inspections.get(`${booking.id}:${task.type}`) ?? null : null,
  };
}

function relevantDate(task: TaskRow): string | null {
  if (!task.booking) return null;
  return task.type === 'pickup' ? task.booking.pickup_date : task.booking.dropoff_date;
}

const TASK_SELECT =
  'id, type, status, booking:bookings(id, customer_name, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, vehicle:vehicles(make, model, license_plate))';

/**
 * "היום שלי" — only tasks assigned to the logged-in driver (an admin
 * session sees every task, unfiltered). A plain website/phone booking
 * with no task row simply doesn't appear here until one is created — see
 * the plan's "workflow change" note.
 */
export async function GET(request: NextRequest) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  let query = supabase
    .from('driver_tasks')
    .select(TASK_SELECT)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(TASK_FETCH_LIMIT);
  if (driverId) query = query.eq('assigned_driver_id', driverId);

  const { data, error } = await query.returns<TaskRow[]>();
  if (error) {
    console.error('[driver/today] task lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  const tasks = (data ?? []).filter((t) => t.booking !== null);

  const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';

  if (search) {
    const since = Date.now() - SEARCH_WINDOW_DAYS * 86_400_000;
    const until = Date.now() + SEARCH_WINDOW_DAYS * 86_400_000;
    const needle = search.toLowerCase();

    const matches = tasks.filter((t) => {
      const date = relevantDate(t);
      if (!date) return false;
      const ts = new Date(date).getTime();
      if (ts < since || ts > until) return false;

      const plate = (t.booking?.vehicle?.license_plate ?? '').toLowerCase();
      const name = (t.booking?.customer_name ?? '').toLowerCase();
      return (
        name.includes(needle) ||
        plate.includes(needle.replace(/[\s-]/g, '')) ||
        (t.booking && numericOrderReference(t.booking.id) === search)
      );
    });

    const inspections = await inspectionMapFor(matches.map((t) => t.booking!.id));
    return NextResponse.json({ results: matches.map((t) => shapeTask(t, inspections)) });
  }

  const dateParam = request.nextUrl.searchParams.get('date') === 'tomorrow' ? israelTomorrow() : israelToday();
  const { startISO, endISO } = israelDayRange(dateParam);
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();

  const inRange = (t: TaskRow) => {
    const date = relevantDate(t);
    if (!date) return false;
    const ts = new Date(date).getTime();
    return ts >= start && ts < end;
  };

  const pickups = tasks.filter((t) => t.type === 'pickup' && inRange(t));
  const returns = tasks.filter((t) => t.type === 'return' && inRange(t));
  const inspections = await inspectionMapFor([...pickups, ...returns].map((t) => t.booking!.id));

  const sortByTime = (rows: TaskRow[]) =>
    [...rows].sort((a, b) => {
      const ta = (a.type === 'pickup' ? a.booking?.pickup_time : a.booking?.return_time) ?? '99:99';
      const tb = (b.type === 'pickup' ? b.booking?.pickup_time : b.booking?.return_time) ?? '99:99';
      return ta.localeCompare(tb);
    });

  return NextResponse.json({
    date: dateParam,
    pickups: sortByTime(pickups).map((t) => shapeTask(t, inspections)),
    returns: sortByTime(returns).map((t) => shapeTask(t, inspections)),
  });
}
