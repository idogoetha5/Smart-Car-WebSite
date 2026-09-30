import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { israelToday, israelTomorrow, israelDayRange } from '@/lib/israel-day';
import { formatLocationForDriver, navigationQueryFor } from '@/lib/location-display';
import { createInspectionToken } from '@/lib/inspection-link';
import { numericOrderReference } from '@/lib/order-reference';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';

const SEARCH_WINDOW_DAYS = 45;
/** A handed-over car stays findable in search (for its return) this long after the handover. */
const OPEN_RENTAL_WINDOW_DAYS = 120;
const TASK_FETCH_LIMIT = 500;

interface TaskRow {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  updated_at?: string | null;
  assigned_driver_id?: string | null;
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
    custom_license_plate?: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
}

interface InspectionSlot {
  id: string;
  status: 'awaiting_signature' | 'signed';
  /** Link to the signed PDF (30-day token) for the 'send signed copy' WhatsApp button. */
  pdfUrl?: string;
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
    map.set(`${row.booking_id}:${row.type}`, {
      id: row.id,
      status: row.status,
      pdfUrl: row.status === 'signed' ? `${SITE_URL}/insp-pdf/${encodeURIComponent(createInspectionToken(row.id))}` : undefined,
    });
  }
  return map;
}

const DONE_VISIBLE_MS = 24 * 60 * 60 * 1000;

/** Tasks marked done (by the driver or by signing) drop off the driver's lists 24h later. */
function isVisible(task: TaskRow): boolean {
  if (task.booking === null) return false;
  if (task.status !== 'done') return true;
  const doneAt = task.updated_at ? new Date(task.updated_at).getTime() : NaN;
  return Number.isNaN(doneAt) || Date.now() - doneAt < DONE_VISIBLE_MS;
}

function shapeTask(task: TaskRow, inspections: Map<string, InspectionSlot>, awaitingReturn = false) {
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
    date: (task.type === 'pickup' ? booking?.pickup_date : booking?.dropoff_date) ?? null,
    inspection: booking ? inspections.get(`${booking.id}:${task.type}`) ?? null : null,
    /** Search only: a completed handover whose return hasn't been done yet. */
    awaitingReturn,
  };
}

const TASK_SELECT_INNER =
  'id, type, status, updated_at, assigned_driver_id, booking:bookings!inner(id, customer_name, customer_phone, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, custom_vehicle_name, custom_license_plate, vehicle:vehicles(make, model, license_plate))';

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
    const handoverSinceISO = new Date(Date.now() - OPEN_RENTAL_WINDOW_DAYS * 86_400_000).toISOString();
    const untilISO = new Date(Date.now() + SEARCH_WINDOW_DAYS * 86_400_000).toISOString();
    // Pickups from every driver: a car handed over by one driver may be
    // collected by another, so completed handovers are searchable by all.
    const pickupSearchQuery = supabase
      .from('driver_tasks')
      .select(TASK_SELECT_INNER)
      .eq('type', 'pickup')
      .neq('status', 'cancelled')
      .gte('booking.pickup_date', handoverSinceISO)
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
    const needle = search.toLowerCase();
    const matchesSearch = (t: TaskRow) => {
      const plate = bookingLicensePlate(t.booking).toLowerCase();
      const name = (t.booking?.customer_name ?? '').toLowerCase();
      return (
        name.includes(needle) ||
        plate.includes(needle.replace(/[\s-]/g, '')) ||
        (t.booking !== null && numericOrderReference(t.booking.id) === search)
      );
    };

    const pickupCandidates = (pickupSearchResult.data ?? []).filter((t) => t.booking !== null && matchesSearch(t));
    const returnMatches = (returnSearchResult.data ?? []).filter(isVisible).filter(matchesSearch);
    const inspections = await inspectionMapFor([
      ...new Set([...pickupCandidates, ...returnMatches].map((t) => t.booking!.id)),
    ]);
    const returnTaskBookings = new Set(returnMatches.map((t) => t.booking!.id));

    const results: ReturnType<typeof shapeTask>[] = [];
    for (const t of pickupCandidates) {
      const bookingId = t.booking!.id;
      const returnSigned = inspections.get(`${bookingId}:return`)?.status === 'signed';
      const handedOver = t.status === 'done' || inspections.get(`${bookingId}:pickup`)?.status === 'signed';
      if (handedOver) {
        // Findable until its return form is signed — then it's gone. If a
        // return task already exists for it, that card is the one to use.
        if (returnSigned || returnTaskBookings.has(bookingId)) continue;
        results.push(shapeTask(t, inspections, true));
      } else if (!driverId || t.assigned_driver_id === driverId) {
        if (isVisible(t)) results.push(shapeTask(t, inspections));
      }
    }
    for (const t of returnMatches) results.push(shapeTask(t, inspections));
    return NextResponse.json({ results });
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

  const pickups = (pickupResult.data ?? []).filter(isVisible);
  const returns = (returnResult.data ?? []).filter(isVisible);
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
