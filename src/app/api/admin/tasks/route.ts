import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { israelDayRange } from '@/lib/israel-day';
import { isValidInternationalPhone } from '@/lib/validations';
import { isValidEmail, normalizeEmail } from '@/lib/email';

const UNSPECIFIED_LOCATION = 'לא צוין';

const TASK_SELECT =
  'id, type, status, notes, created_by, created_at, assigned_driver_id, driver:drivers(id, name), booking:bookings(id, customer_name, customer_phone, pickup_date, dropoff_date, pickup_location, dropoff_location, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))';

interface TaskWithBooking {
  id: string;
  type: 'pickup' | 'return';
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
    pickup_location: string;
    dropoff_location: string;
    custom_vehicle_name: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

/** Lists tasks for the per-driver task panels in the admin "נהגים" page. */
export async function GET(request: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
export async function POST(request: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type === 'pickup' || body?.type === 'return' ? body.type : null;
  if (!type) {
    return NextResponse.json({ error: 'יש לבחור סוג משימה' }, { status: 400 });
  }
  const assignedDriverId = body?.assignedDriverId ? String(body.assignedDriverId).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const scheduledAt = body?.scheduledAt ? String(body.scheduledAt) : null; // ISO datetime
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
    const vehicleId = String(body?.vehicleId ?? '').trim();
    const customVehicleName = String(body?.customVehicleName ?? '').trim();

    if (!customerName) {
      return NextResponse.json({ error: 'שם הלקוח הוא שדה חובה' }, { status: 400 });
    }
    if (!customerPhone || !isValidInternationalPhone(customerPhone)) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 });
    }
    if (!isValidEmail(customerEmail)) {
      return NextResponse.json({ error: 'יש להזין כתובת אימייל תקינה של הלקוח' }, { status: 400 });
    }
    if (!vehicleId && !customVehicleName) {
      return NextResponse.json({ error: 'יש לבחור רכב או לכתוב את שם הרכב' }, { status: 400 });
    }

    let pricePerDay = 0;
    if (vehicleId) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, price_per_day')
        .eq('id', vehicleId)
        .maybeSingle();
      if (vehicleError) {
        console.error('[admin/tasks] vehicle lookup failed:', vehicleError.message);
        return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
      }
      if (!vehicle) {
        return NextResponse.json({ error: 'הרכב לא נמצא' }, { status: 404 });
      }
      pricePerDay = Number(vehicle.price_per_day) || 0;
    }

    const scheduled = scheduledAt ? new Date(scheduledAt) : new Date();
    const plusOneDay = new Date(scheduled.getTime() + 24 * 60 * 60 * 1000);
    const pickupDate = scheduled;
    const dropoffDate = type === 'return' ? scheduled : plusOneDay;
    const bookingPayload: Record<string, unknown> = {
      vehicle_id: vehicleId || null,
      customer_name: customerName,
      customer_email: normalizeEmail(customerEmail),
      customer_phone: customerPhone,
      pickup_date: pickupDate.toISOString(),
      dropoff_date: dropoffDate.toISOString(),
      pickup_location: type === 'pickup' ? (location || UNSPECIFIED_LOCATION) : UNSPECIFIED_LOCATION,
      dropoff_location: type === 'return' ? (location || UNSPECIFIED_LOCATION) : UNSPECIFIED_LOCATION,
      total_days: 1,
      price_per_day: pricePerDay,
      total_price: pricePerDay,
      status: 'CONFIRMED',
      source: 'phone',
    };
    if (!vehicleId) bookingPayload.custom_vehicle_name = customVehicleName;

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert(bookingPayload)
      .select('id')
      .single();

    if (insertError || !booking) {
      console.error('[admin/tasks] booking insert failed:', insertError?.message);
      const missingMigration = insertError?.message.includes('custom_vehicle_name');
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
      created_by: 'admin',
    })
    .select('id')
    .single();

  if (taskError || !task) {
    console.error('[admin/tasks] task insert failed:', taskError?.message);
    return NextResponse.json({ error: 'יצירת המשימה נכשלה' }, { status: 500 });
  }

  return NextResponse.json({ taskId: task.id, bookingId }, { status: 201 });
}
