import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { israelToday, israelTomorrow, israelDayRange } from '@/lib/israel-day';
import { formatLocationForDriver, navigationQueryFor } from '@/lib/location-display';
import { createInspectionToken } from '@/lib/inspection-link';
import { numericOrderReference } from '@/lib/order-reference';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { serviceKindLabel, serviceReasonLabel, serviceTitle } from '@/lib/service-task';
import { searchHandovers } from '@/lib/inspection-previous';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';

const SEARCH_WINDOW_DAYS = 45;
/** A handed-over car stays findable in search (for its return) this long after the handover. */
const OPEN_RENTAL_WINDOW_DAYS = 120;
const TASK_FETCH_LIMIT = 500;

interface TaskRow {
  id: string;
  urgent?: boolean;
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

function shapeTask(task: TaskRow, inspections: Map<string, InspectionSlot>, awaitingReturn = false, claimable = false) {
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
    urgent: Boolean(task.urgent),
    /** Open urgent task with no driver yet — this driver can take it. */
    claimable,
  };
}

const SERVICE_SELECT =
  'id, type, status, urgent, updated_at, notes, scheduled_at, scheduled_time, location, service_kind, service_reason, service_place, custom_vehicle_name, custom_license_plate, car:vehicles(make, model, license_plate)';

interface ServiceRow {
  id: string;
  urgent?: boolean;
  status: 'open' | 'done' | 'cancelled';
  updated_at: string | null;
  notes: string | null;
  scheduled_at: string;
  scheduled_time: string | null;
  location: string | null;
  service_kind: string | null;
  service_reason: string | null;
  service_place: string | null;
  custom_vehicle_name: string | null;
  custom_license_plate: string | null;
  car: { make: string; model: string; license_plate: string | null } | null;
}

function shapeService(t: ServiceRow, claimable = false) {
  const carSource = { vehicle: t.car, custom_vehicle_name: t.custom_vehicle_name, custom_license_plate: t.custom_license_plate };
  return {
    taskId: t.id,
    urgent: Boolean(t.urgent),
    claimable,
    taskStatus: t.status,
    type: 'service' as const,
    bookingId: '',
    bookingNumber: '',
    customerName: serviceTitle(t.service_kind, t.service_place),
    vehicleName: bookingVehicleName(carSource),
    licensePlate: bookingLicensePlate(carSource),
    location: t.location ?? '',
    navQuery: t.location ? navigationQueryFor(t.location) : undefined,
    customerPhone: '',
    time: t.scheduled_time,
    date: t.scheduled_at,
    inspection: null,
    service: {
      kind: t.service_kind,
      kindLabel: serviceKindLabel(t.service_kind),
      reason: serviceReasonLabel(t.service_reason),
      details: t.notes,
    },
  };
}

const TASK_SELECT_INNER =
  'id, type, status, urgent, updated_at, assigned_driver_id, booking:bookings!inner(id, customer_name, customer_phone, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, custom_vehicle_name, custom_license_plate, vehicle:vehicles(make, model, license_plate))';

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
      // Compare plates without dashes/spaces on both sides: "12-345-67" is found by "1234567" too.
      const plate = bookingLicensePlate(t.booking).toLowerCase().replace(/[\s-]/g, '');
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

    // Signed handovers that have no driver task (e.g. done from the admin) —
    // still waiting for a return, so every driver can find them too.
    const shown = new Set(results.map((r) => r.bookingId));
    for (const h of await searchHandovers(search)) {
      if (!h.bookingId || shown.has(h.bookingId) || returnTaskBookings.has(h.bookingId)) continue;
      shown.add(h.bookingId);
      results.push({
        taskId: '',
        taskStatus: 'done' as const,
        type: 'pickup' as const,
        bookingId: h.bookingId,
        bookingNumber: numericOrderReference(h.bookingId),
        customerName: h.customerName,
        vehicleName: h.vehicleName,
        licensePlate: h.licensePlate,
        location: '',
        navQuery: '',
        customerPhone: h.customerPhone ?? '',
        time: null,
        date: h.signedAt,
        inspection: { id: h.inspectionId, status: 'signed' as const },
        awaitingReturn: true,
        urgent: false,
        claimable: false,
      });
    }
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

  // Garage / tyre-shop jobs for the day (no rental — their own day, time, car and address).
  let serviceQuery = supabase
    .from('driver_tasks')
    .select(SERVICE_SELECT)
    .eq('type', 'service')
    .neq('status', 'cancelled')
    .gte('scheduled_at', startISO)
    .lt('scheduled_at', endISO);
  if (driverId) serviceQuery = serviceQuery.eq('assigned_driver_id', driverId);
  const serviceResult = await serviceQuery.returns<ServiceRow[]>();
  if (serviceResult.error) console.error('[driver/today] service lookup failed:', serviceResult.error.message);
  const services = (serviceResult.data ?? [])
    .filter((t) => t.status !== 'done' || !t.updated_at || Date.now() - new Date(t.updated_at).getTime() < DONE_VISIBLE_MS)
    .map((t) => shapeService(t))
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));

  // Open urgent tasks nobody took yet (any type) — offered to every driver for the day.
  let open: Array<ReturnType<typeof shapeTask> | ReturnType<typeof shapeService>> = [];
  if (driverId) {
    const [openPickups, openReturns, openServices] = await Promise.all([
      supabase.from('driver_tasks').select(TASK_SELECT_INNER).eq('type', 'pickup').eq('status', 'open').eq('urgent', true).is('assigned_driver_id', null)
        .gte('booking.pickup_date', startISO).lt('booking.pickup_date', endISO).returns<TaskRow[]>(),
      supabase.from('driver_tasks').select(TASK_SELECT_INNER).eq('type', 'return').eq('status', 'open').eq('urgent', true).is('assigned_driver_id', null)
        .gte('booking.dropoff_date', startISO).lt('booking.dropoff_date', endISO).returns<TaskRow[]>(),
      supabase.from('driver_tasks').select(SERVICE_SELECT).eq('type', 'service').eq('status', 'open').eq('urgent', true).is('assigned_driver_id', null)
        .gte('scheduled_at', startISO).lt('scheduled_at', endISO).returns<ServiceRow[]>(),
    ]);
    const openTasks = [...(openPickups.data ?? []), ...(openReturns.data ?? [])];
    const openInspections = await inspectionMapFor(openTasks.map((t) => t.booking!.id));
    open = [
      ...openTasks.map((t) => shapeTask(t, openInspections, false, true)),
      ...(openServices.data ?? []).map((t) => shapeService(t, true)),
    ];
  }

  return NextResponse.json({
    open,
    services,
    date: dateParam,
    pickups: sortByTime(pickups).map((t) => shapeTask(t, inspections)),
    returns: sortByTime(returns).map((t) => shapeTask(t, inspections)),
  });
}
