import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { israelToday, israelTomorrow, israelDayRange } from '@/lib/israel-day';
import { formatLocationForDriver, navigationQueryFor } from '@/lib/location-display';
import { numericOrderReference } from '@/lib/order-reference';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';

const SEARCH_WINDOW_DAYS = 45;
const TASK_FETCH_LIMIT = 500;

interface TaskRow {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  booking: {
    id: string;
    customer_name: string;
    customer_phone: string | null;
    pickup_date: string;
    dropoff_date: string;
    pickup_time: string | null;
    return_time: string | null;
    pickup_location: string;
    dropoff_location: string;
    custom_vehicle_name: string | null;
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
    vehicleName: bookingVehicleName(booking),
    licensePlate: bookingLicensePlate(booking),
    location: formatLocationForDriver(location),
    navQuery: navigationQueryFor(location),
    customerPhone: booking?.customer_phone ?? '',
    time,
    inspection: booking ? inspections.get(`${booking.id}:${task.type}`) ?? null : null,
  };
}

const TASK_SELECT_INNER =
  'id, type, status, booking:bookings!inner(id, customer_name, customer_phone, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))';

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
  const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';

  if (search) {
    const sinceISO = new Date(Date.now() - SEARCH_WINDOW_DAYS * 86_400_000).toISOString();
    const untilISO = new Date(Date.now() + SEARCH_WINDOW_DAYS * 86_400_000).toISOString();
    let pickupSearchQuery = supabase
      .from('driver_tasks')
      .select(TASK_SELECT_INNER)
      .eq('type', 'pickup')
      .neq('status', 'cancelled')
      .gte('booking.pickup_date', sinceISO)
      .lte('booking.pickup_date', untilISO)
      .order('created_at', { ascending: false })
      .limit(TASK_FETCH_LIMIT);
    let returnSearchQuery = supabase
      .from('driver_tasks')
      .select(TASK_SELECT_INNER)
      .eq('type', 'return')
      .neq('status', 'cancelled')
      .gte('booking.dropoff_date', sinceISO)
      .lte('booking.dropoff_date', untilISO)
      .order('created_at', { ascending: false })
      .limit(TASK_FETCH_LIMIT);
    if (driverId) {
      pickupSearchQuery = pickupSearchQuery.eq('assigned_driver_id', driverId);
      returnSearchQuery = returnSearchQuery.eq('assigned_driver_id', driverId);
    }

    const [pickupSearchResult, returnSearchResult] = await Promise.all([
      pickupSearchQuery.returns<TaskRow[]>(),
      returnSearchQuery.returns<TaskRow[]>(),
    ]);
    if (pickupSearchResult.error || returnSearchResult.error) {
      console.error(
        '[driver/today] search lookup failed:',
        pickupSearchResult.error?.message ?? returnSearchResult.error?.message
      );
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    const tasks = [...(pickupSearchResult.data ?? []), ...(returnSearchResult.data ?? [])]
      .filter((task) => task.booking !== null);
    const needle = search.toLowerCase();

    const matches = tasks.filter((t) => {
      const plate = bookingLicensePlate(t.booking).toLowerCase();
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
  let pickupQuery = supabase
    .from('driver_tasks')
    .select(TASK_SELECT_INNER)
    .eq('type', 'pickup')
    .neq('status', 'cancelled')
    .gte('booking.pickup_date', startISO)
    .lt('booking.pickup_date', endISO)
    .order('created_at', { ascending: false });
  let returnQuery = supabase
    .from('driver_tasks')
    .select(TASK_SELECT_INNER)
    .eq('type', 'return')
    .neq('status', 'cancelled')
    .gte('booking.dropoff_date', startISO)
    .lt('booking.dropoff_date', endISO)
    .order('created_at', { ascending: false });
  if (driverId) {
    pickupQuery = pickupQuery.eq('assigned_driver_id', driverId);
    returnQuery = returnQuery.eq('assigned_driver_id', driverId);
  }

  const [pickupResult, returnResult] = await Promise.all([
    pickupQuery.returns<TaskRow[]>(),
    returnQuery.returns<TaskRow[]>(),
  ]);
  if (pickupResult.error || returnResult.error) {
    console.error(
      '[driver/today] dated task lookup failed:',
      pickupResult.error?.message ?? returnResult.error?.message
    );
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const pickups = (pickupResult.data ?? []).filter((task) => task.booking !== null);
  const returns = (returnResult.data ?? []).filter((task) => task.booking !== null);
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
