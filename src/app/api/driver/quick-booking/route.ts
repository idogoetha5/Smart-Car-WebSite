import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidInternationalPhone } from '@/lib/validations';

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
  const type = body?.type === 'pickup' || body?.type === 'return' ? body.type : null;

  if (!customerName) {
    return NextResponse.json({ error: 'שם הלקוח הוא שדה חובה' }, { status: 400 });
  }
  if (!customerPhone || !isValidInternationalPhone(customerPhone)) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 });
  }
  if (!vehicleId || !type) {
    return NextResponse.json({ error: 'יש לבחור רכב וסוג בדיקה' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, price_per_day')
    .eq('id', vehicleId)
    .maybeSingle();

  if (vehicleError) {
    console.error('[driver/quick-booking] vehicle lookup failed:', vehicleError.message);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
  if (!vehicle) {
    return NextResponse.json({ error: 'הרכב לא נמצא' }, { status: 404 });
  }

  const now = new Date();
  const plusOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // The actual historical pickup for a 'return' walk-in is unknown — this
  // is a stub for a rental that was never logged, not a real multi-day
  // reservation. Admin can revise the dates through existing tools if needed.
  const pickupDate = now;
  const dropoffDate = type === 'return' ? now : plusOneDay;
  const pricePerDay = Number(vehicle.price_per_day) || 0;

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      vehicle_id: vehicleId,
      customer_name: customerName,
      customer_email: customerEmail || '',
      customer_phone: customerPhone,
      pickup_date: pickupDate.toISOString(),
      dropoff_date: dropoffDate.toISOString(),
      pickup_location: UNSPECIFIED_LOCATION,
      dropoff_location: UNSPECIFIED_LOCATION,
      total_days: 1,
      price_per_day: pricePerDay,
      total_price: pricePerDay,
      status: 'CONFIRMED',
      source: 'driver',
      created_by_driver_id: driverId,
    })
    .select('id')
    .single();

  if (insertError || !booking) {
    console.error('[driver/quick-booking] insert failed:', insertError?.message);
    return NextResponse.json({ error: 'יצירת ההזמנה נכשלה' }, { status: 500 });
  }

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
