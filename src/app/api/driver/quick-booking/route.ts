import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidInternationalPhone } from '@/lib/validations';
import { isValidEmail, normalizeEmail } from '@/lib/email';

const UNSPECIFIED_LOCATION = 'לא צוין';

/**
 * Creates a minimal booking on the spot for a rental that was never
 * entered into the system (a walk-in, or one arranged outside the normal
 * flow) — collects only what the driver actually has, then hands off to
 * the existing inspection flow unchanged. Not the public booking form:
 * no rate limit/Turnstile (this is an authenticated driver/admin action),
 * no bookingRequestSchema (that schema requires customerEmail/agreeTerms/
 * both locations and is tightly coupled to the public form's fields).
 */
export async function POST(request: NextRequest) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const customerName = String(body?.customerName ?? '').trim();
  const customerPhone = String(body?.customerPhone ?? '').trim();
  const customerEmail = String(body?.customerEmail ?? '').trim();
  const vehicleId = String(body?.vehicleId ?? '').trim();
  const customVehicleName = String(body?.customVehicleName ?? '').trim();
  const type = body?.type === 'pickup' || body?.type === 'return' ? body.type : null;
  const location = String(body?.location ?? '').trim().slice(0, 200) || UNSPECIFIED_LOCATION;

  if (!customerName) {
    return NextResponse.json({ error: 'שם הלקוח הוא שדה חובה' }, { status: 400 });
  }
  if (!customerPhone || !isValidInternationalPhone(customerPhone)) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 });
  }
  if (!isValidEmail(customerEmail)) {
    return NextResponse.json({ error: 'יש להזין כתובת אימייל תקינה של הלקוח' }, { status: 400 });
  }
  if (!type || (!vehicleId && !customVehicleName)) {
    return NextResponse.json({ error: 'יש לבחור רכב או לכתוב את שם הרכב, ולבחור סוג בדיקה' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (vehicleId) {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', vehicleId)
      .maybeSingle();

    if (vehicleError) {
      console.error('[driver/quick-booking] vehicle lookup failed:', vehicleError.message);
      return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
    }
    if (!vehicle) {
      return NextResponse.json({ error: 'הרכב לא נמצא' }, { status: 404 });
    }
  }

  const now = new Date();
  const plusOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // The actual historical pickup for a 'return' walk-in is unknown — this
  // is a stub for a rental that was never logged, not a real multi-day
  // reservation. Admin can revise the dates through existing tools if needed.
  const pickupDate = now;
  const dropoffDate = type === 'return' ? now : plusOneDay;
  const bookingPayload: Record<string, unknown> = {
    vehicle_id: vehicleId || null,
    customer_name: customerName,
    customer_email: normalizeEmail(customerEmail),
    customer_phone: customerPhone,
    pickup_date: pickupDate.toISOString(),
    dropoff_date: dropoffDate.toISOString(),
    pickup_location: type === 'pickup' ? location : UNSPECIFIED_LOCATION,
    dropoff_location: type === 'return' ? location : UNSPECIFIED_LOCATION,
    total_days: 1,
    // Field job, not a priced reservation.
    price_per_day: 0,
    total_price: 0,
    status: 'CONFIRMED',
    source: 'driver',
    created_by_driver_id: driverId,
  };
  if (!vehicleId) bookingPayload.custom_vehicle_name = customVehicleName;

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert(bookingPayload)
    .select('id')
    .single();

  if (insertError || !booking) {
    console.error('[driver/quick-booking] insert failed:', insertError?.message);
    const missingMigration = insertError?.message.includes('custom_vehicle_name');
    return NextResponse.json(
      { error: missingMigration ? 'יש לעדכן את מסד הנתונים לפני הוספת רכב ידני' : 'יצירת ההזמנה נכשלה' },
      { status: 500 }
    );
  }

  // Assigned to the driver who created it, so it shows up in their own
  // "היום שלי" immediately — the driver-app's Today list is task-based,
  // not a raw scan of bookings. Best-effort: the booking already exists
  // and is usable even if this insert fails, so a failure is logged, not
  // surfaced as an error to the driver mid-flow.
  const { error: taskError } = await supabase.from('driver_tasks').insert({
    booking_id: booking.id,
    type,
    assigned_driver_id: driverId,
    created_by: driverId ? 'driver' : 'admin',
  });
  if (taskError) {
    console.error('[driver/quick-booking] task creation failed:', taskError.message);
  }

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
