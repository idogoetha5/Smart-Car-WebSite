/**
 * Driver-task list/create logic shared by the admin API (/api/admin/tasks)
 * and the branch-manager API (/api/driver/manage/tasks). Callers do their
 * own auth first.
 */
import { readVehicleInput, resolveVehicle } from '@/lib/custom-vehicle';
import { inBackground, notifyTaskCreated } from '@/lib/push-notify';
import { isServiceKind, isServiceReason } from '@/lib/service-task';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { israelDayRange } from '@/lib/israel-day';
import { isValidInternationalPhone } from '@/lib/validations';
import { isValidEmail, normalizeEmail } from '@/lib/email';

const UNSPECIFIED_LOCATION = 'לא צוין';

const TASK_SELECT =
  'id, type, status, notes, created_by, created_at, assigned_driver_id, scheduled_at, scheduled_time, location, service_kind, service_reason, service_place, custom_vehicle_name, custom_license_plate, car:vehicles(make, model, license_plate), driver:drivers(id, name), booking:bookings(id, customer_name, customer_phone, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, custom_vehicle_name, custom_license_plate, vehicle:vehicles(make, model, license_plate))';

interface TaskWithBooking {
  id: string;
  type: 'pickup' | 'return' | 'service';
  /** Service (garage) jobs only — handovers/returns use their booking. */
  scheduled_at?: string | null;
  scheduled_time?: string | null;
  location?: string | null;
  service_kind?: string | null;
  service_reason?: string | null;
  service_place?: string | null;
  custom_vehicle_name?: string | null;
  custom_license_plate?: string | null;
  car?: { make: string; model: string; license_plate: string | null } | null;
  status: 'open' | 'done' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  assigned_driver_id: string | null;
  driver: { id: string; name: string } | null;
  booking: {
    id: string;
    customer_name: string;
    customer_phone: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    return_time?: string | null;
    pickup_location: string;
    dropoff_location: string;
    custom_vehicle_name: string | null;
    custom_license_plate?: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
}

/** Lists tasks for the per-driver task panels in the admin "נהגים" page. */
export async function listDriverTasks(request: NextRequest): Promise<NextResponse> {

  const supabase = createAdminClient();
  const driverId = request.nextUrl.searchParams.get('driverId');
  const dateParam = request.nextUrl.searchParams.get('date');

  let query = supabase.from('driver_tasks').select(TASK_SELECT).order('created_at', { ascending: false }).limit(500);
  if (driverId) query = query.eq('assigned_driver_id', driverId);

  const { data, error } = await query.returns<TaskWithBooking[]>();
  if (error) {
    console.error('[admin/tasks] list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  let tasks = data ?? [];
  if (dateParam) {
    const { startISO, endISO } = israelDayRange(dateParam);
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    tasks = tasks.filter((t) => {
      if (t.type === 'service') {
        const ts = t.scheduled_at ? new Date(t.scheduled_at).getTime() : NaN;
        return ts >= start && ts < end;
      }
      const booking = t.booking;
      if (!booking) return false;
      const date = t.type === 'pickup' ? booking.pickup_date : booking.dropoff_date;
      const ts = new Date(date).getTime();
      return ts >= start && ts < end;
    });
  }

  // Inspection status per booking+type, same lookup pattern used across the
  // driver app, so the list can show whether it was signed.
  const bookingIds = tasks
    .map((t) => t.booking?.id)
    .filter((id): id is string => Boolean(id));

  let inspectionMap = new Map<string, { id: string; status: string }>();
  if (bookingIds.length > 0) {
    const { data: inspections } = await supabase
      .from('vehicle_inspections')
      .select('id, booking_id, type, status, created_at')
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: true });
    inspectionMap = new Map(
      (inspections ?? []).map((i) => [`${i.booking_id}:${i.type}`, { id: i.id, status: i.status }])
    );
  }

  const shaped = tasks.map((t) => ({
    ...t,
    inspection: t.booking ? inspectionMap.get(`${t.booking.id}:${t.type}`) ?? null : null,
  }));

  return NextResponse.json({ data: shaped });
}

/**
 * Creates a task — either against an existing bookingId (e.g. a return
 * task for a rental that already has a pickup task/booking) or by first
 * creating a new phone-booked booking (status CONFIRMED, source 'phone').
 * Same insert shape as the driver walk-in quick-booking route — see
 * src/app/api/driver/quick-booking/route.ts and the plan's "what a new
 * bookings row triggers" section: no automatic email/WhatsApp fires.
 */
export async function createDriverTask(request: NextRequest, createdBy: string): Promise<NextResponse> {

  const body = await request.json().catch(() => null);
  if (body?.type === 'service') return createServiceTask(body, createdBy);
  const type = body?.type === 'pickup' || body?.type === 'return' ? body.type : null;
  if (!type) {
    return NextResponse.json({ error: 'יש לבחור סוג משימה' }, { status: 400 });
  }
  const assignedDriverId = body?.assignedDriverId ? String(body.assignedDriverId).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const scheduledAt = body?.scheduledAt ? String(body.scheduledAt) : null; // ISO datetime
  // Israel wall-clock time the driver sees on the task card (HH:MM).
  const scheduledTime = typeof body?.scheduledTime === 'string' && /^\d{2}:\d{2}$/.test(body.scheduledTime) ? body.scheduledTime : null;
  const location = body?.location ? String(body.location).trim() : null;

  const supabase = createAdminClient();
  let bookingId = String(body?.bookingId ?? '').trim();

  if (bookingId) {
    // Link to an existing rental — update the relevant date/location if given.
    const { data: existing, error: existingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .maybeSingle();
    if (existingError) {
      console.error('[admin/tasks] booking lookup failed:', existingError.message);
      return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'ההזמנה לא נמצאה' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (scheduledAt) update[type === 'pickup' ? 'pickup_date' : 'dropoff_date'] = scheduledAt;
    if (scheduledTime) update[type === 'pickup' ? 'pickup_time' : 'return_time'] = scheduledTime;
    if (location) update[type === 'pickup' ? 'pickup_location' : 'dropoff_location'] = location;
    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabase.from('bookings').update(update).eq('id', bookingId);
      if (updateError) {
        console.error('[admin/tasks] booking update failed:', updateError.message);
        return NextResponse.json({ error: 'עדכון ההזמנה נכשל' }, { status: 500 });
      }
    }
  } else {
    // New phone-booked rental.
    const customerName = String(body?.customerName ?? '').trim();
    const customerPhone = String(body?.customerPhone ?? '').trim();
    const customerEmail = String(body?.customerEmail ?? '').trim();

    if (!customerName) {
      return NextResponse.json({ error: 'שם הלקוח הוא שדה חובה' }, { status: 400 });
    }
    if (!customerPhone || !isValidInternationalPhone(customerPhone)) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 });
    }
    if (!isValidEmail(customerEmail)) {
      return NextResponse.json({ error: 'יש להזין כתובת אימייל תקינה של הלקוח' }, { status: 400 });
    }
    const vehicle = await resolveVehicle(supabase, readVehicleInput(body), { requirePlate: false });
    if (!vehicle.ok) {
      return NextResponse.json({ error: vehicle.error }, { status: vehicle.status });
    }

    const scheduled = scheduledAt ? new Date(scheduledAt) : new Date();
    const plusOneDay = new Date(scheduled.getTime() + 24 * 60 * 60 * 1000);
    const pickupDate = scheduled;
    const dropoffDate = type === 'return' ? scheduled : plusOneDay;
    const bookingPayload: Record<string, unknown> = {
      vehicle_id: vehicle.vehicleId,
      customer_name: customerName,
      customer_email: normalizeEmail(customerEmail),
      customer_phone: customerPhone,
      pickup_date: pickupDate.toISOString(),
      dropoff_date: dropoffDate.toISOString(),
      pickup_location: type === 'pickup' ? (location || UNSPECIFIED_LOCATION) : UNSPECIFIED_LOCATION,
      dropoff_location: type === 'return' ? (location || UNSPECIFIED_LOCATION) : UNSPECIFIED_LOCATION,
      total_days: 1,
      // Field job, not a priced reservation.
      price_per_day: 0,
      total_price: 0,
      status: 'CONFIRMED',
      source: 'phone',
    };
    if (scheduledTime) bookingPayload[type === 'pickup' ? 'pickup_time' : 'return_time'] = scheduledTime;
    if (vehicle.customVehicleName) bookingPayload.custom_vehicle_name = vehicle.customVehicleName;
    if (vehicle.customLicensePlate) bookingPayload.custom_license_plate = vehicle.customLicensePlate;

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert(bookingPayload)
      .select('id')
      .single();

    if (insertError || !booking) {
      console.error('[admin/tasks] booking insert failed:', insertError?.message);
      const missingMigration = /custom_vehicle_name|custom_license_plate/.test(insertError?.message ?? '');
      return NextResponse.json(
        { error: missingMigration ? 'יש לעדכן את מסד הנתונים לפני הוספת רכב ידני' : 'יצירת ההזמנה נכשלה' },
        { status: 500 }
      );
    }
    bookingId = booking.id;
  }

  const { data: task, error: taskError } = await supabase
    .from('driver_tasks')
    .insert({
      booking_id: bookingId,
      type,
      assigned_driver_id: assignedDriverId,
      notes,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (taskError || !task) {
    console.error('[admin/tasks] task insert failed:', taskError?.message);
    return NextResponse.json({ error: 'יצירת המשימה נכשלה' }, { status: 500 });
  }

  // Handover with its return planned in the same step: set the rental's
  // return date/time and create the return task for the same driver.
  const returnAt = type === 'pickup' && body?.returnAt ? String(body.returnAt) : null;
  let returnTaskId: string | null = null;
  if (returnAt && !Number.isNaN(new Date(returnAt).getTime())) {
    const returnTime = typeof body?.returnTime === 'string' && /^\d{2}:\d{2}$/.test(body.returnTime) ? body.returnTime : null;
    const bookingUpdate: Record<string, unknown> = { dropoff_date: new Date(returnAt).toISOString() };
    if (returnTime) bookingUpdate.return_time = returnTime;
    const { error: returnBookingError } = await supabase.from('bookings').update(bookingUpdate).eq('id', bookingId);
    if (returnBookingError) console.error('[admin/tasks] return date update failed:', returnBookingError.message);
    const { data: returnTask, error: returnTaskError } = await supabase
      .from('driver_tasks')
      .insert({ booking_id: bookingId, type: 'return', assigned_driver_id: assignedDriverId, created_by: createdBy })
      .select('id')
      .single();
    if (returnTaskError) console.error('[admin/tasks] return task insert failed:', returnTaskError.message);
    returnTaskId = returnTask?.id ?? null;
  }

  inBackground(() => notifyTaskCreated(task.id, returnTaskId));

  return NextResponse.json({ taskId: task.id, bookingId, returnTaskId }, { status: 201 });
}

/**
 * Garage / tyre-shop job: a car taken somewhere on a day, with a reason. No
 * rental, no customer, no inspection — the driver marks it done.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createServiceTask(body: any, createdBy: string): Promise<NextResponse> {
  const kind = body?.serviceKind;
  const reason = body?.serviceReason;
  if (!isServiceKind(kind)) return NextResponse.json({ error: 'יש לבחור לאן הרכב נוסע' }, { status: 400 });
  if (!isServiceReason(reason)) return NextResponse.json({ error: 'יש לבחור סיבה' }, { status: 400 });
  const scheduledAt = body?.scheduledAt ? new Date(String(body.scheduledAt)) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: 'יש לבחור תאריך' }, { status: 400 });
  const scheduledTime = typeof body?.scheduledTime === 'string' && /^\d{2}:\d{2}$/.test(body.scheduledTime) ? body.scheduledTime : null;

  const supabase = createAdminClient();
  const vehicle = await resolveVehicle(supabase, readVehicleInput(body), { requirePlate: false });
  if (!vehicle.ok) return NextResponse.json({ error: vehicle.error }, { status: vehicle.status });

  const { data: task, error } = await supabase
    .from('driver_tasks')
    .insert({
      type: 'service',
      booking_id: null,
      assigned_driver_id: body?.assignedDriverId ? String(body.assignedDriverId).trim() : null,
      notes: body?.notes ? String(body.notes).trim().slice(0, 1000) : null,
      created_by: createdBy,
      vehicle_id: vehicle.vehicleId,
      custom_vehicle_name: vehicle.customVehicleName,
      custom_license_plate: vehicle.customLicensePlate,
      scheduled_at: scheduledAt.toISOString(),
      scheduled_time: scheduledTime,
      location: body?.location ? String(body.location).trim().slice(0, 200) : null,
      service_kind: kind,
      service_reason: reason,
      service_place: body?.servicePlace ? String(body.servicePlace).trim().slice(0, 120) : null,
    })
    .select('id')
    .single();

  if (error || !task) {
    console.error('[admin/tasks] service task insert failed:', error?.message);
    const missingMigration = /service_kind|scheduled_at|driver_tasks_type_check|null value in column "booking_id"/.test(error?.message ?? '');
    return NextResponse.json(
      { error: missingMigration ? 'יש לעדכן את מסד הנתונים לפני הוספת משימות מוסך' : 'יצירת המשימה נכשלה' },
      { status: 500 }
    );
  }

  inBackground(() => notifyTaskCreated(task.id));
  return NextResponse.json({ taskId: task.id }, { status: 201 });
}
