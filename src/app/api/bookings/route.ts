import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { verifyTurnstile } from '@/lib/turnstile';
import { verifyAdminToken } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { getSeasonalPriceRange } from '@/lib/seasonal';
import { bookingSchema } from '@/lib/validations';
import type { Vehicle } from '@/types';

const EXTRAS_PRICE: Record<string, number> = {
  insurance: 45,
  highway6: 35,
  baby_seat: 20,
  driver: 25,
};

async function checkAdminAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(`*, vehicle:vehicles(make, model, year, image_urls)`)
    .order('created_at', { ascending: false });

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: rlOk, retryAfter } = await checkRateLimit(`booking:${ip}`, 5, 60 * 60 * 1000);
  if (!rlOk) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const supabase = createAdminClient();
  const body = await request.json();

  // Turnstile bot check
  if (!await verifyTurnstile(body.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  // Honeypot check — bots fill hidden fields, humans don't
  if (body._website) {
    return NextResponse.json({ data: { id: 'bot' } }, { status: 201 }); // silent reject
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid booking data' },
      { status: 400 }
    );
  }

  const vehicleId    = body.vehicleId;
  const pickupDate   = body.pickupDate;
  const dropoffDate  = body.dropoffDate;

  // Validate dates server-side
  if (!pickupDate || !dropoffDate) {
    return NextResponse.json({ error: 'Pickup and drop-off dates are required' }, { status: 400 });
  }
  if (dropoffDate <= pickupDate) {
    return NextResponse.json({ error: 'Drop-off date must be after pickup date' }, { status: 400 });
  }
  if (new Date(pickupDate) < new Date(new Date().toISOString().split('T')[0])) {
    return NextResponse.json({ error: 'Pickup date cannot be in the past' }, { status: 400 });
  }

  // Check for conflicts (only CONFIRMED/ACTIVE block availability)
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .in('status', ['CONFIRMED', 'ACTIVE'])
    .lt('pickup_date', dropoffDate)
    .gt('dropoff_date', pickupDate);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'Vehicle not available for selected dates' },
      { status: 409 }
    );
  }

  const totalDays = Math.ceil(
    (new Date(dropoffDate).getTime() - new Date(pickupDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Fetch vehicle to calculate server-side price
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('make, model, year, price_per_day, category, is_available')
    .eq('id', vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  }

  if (!vehicle.is_available) {
    return NextResponse.json({ error: 'Vehicle is not available for booking' }, { status: 409 });
  }

  if (!vehicle.price_per_day || vehicle.price_per_day <= 0) {
    return NextResponse.json({ error: 'Vehicle pricing is not configured' }, { status: 422 });
  }

  // Calculate authoritative price server-side (mirrors BookingForm logic).
  // Priced per-day across the full range so a rental crossing a season
  // boundary (e.g. June → July) is charged the correct rate for each day.
  const vehicleForPricing = { make: vehicle.make, model: vehicle.model, pricePerDay: vehicle.price_per_day } as Pick<Vehicle, 'make' | 'model' | 'pricePerDay'>;
  const { subtotal, avgPricePerDay: serverPricePerDay } = getSeasonalPriceRange(
    vehicleForPricing as Vehicle,
    new Date(pickupDate),
    new Date(dropoffDate)
  );
  const discountPct = totalDays >= 60 ? 15 : totalDays >= 30 ? 10 : totalDays >= 14 ? 7 : 0;
  const serverDiscount = Math.round(subtotal * discountPct / 100);
  const vehicleTotal = subtotal - serverDiscount;
  const selectedExtras: string[] = Array.isArray(body.extras) ? body.extras : [];
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (EXTRAS_PRICE[id] ?? 0) * totalDays, 0);
  const serverTotalPrice = vehicleTotal + extrasTotal;

  // Map camelCase → snake_case for Supabase insert
  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      vehicle_id:          vehicleId,
      customer_name:       body.customerName,
      customer_email:      body.customerEmail,
      customer_phone:      body.customerPhone,
      customer_id_number:  body.customerIdNumber ?? null,
      pickup_date:         pickupDate,
      dropoff_date:        dropoffDate,
      pickup_location:     body.pickupLocation,
      dropoff_location:    body.dropoffLocation,
      notes:               body.notes ?? null,
      extras:              selectedExtras,
      additional_driver_name: body.additionalDriverName ?? null,
      additional_driver_id:   body.additionalDriverId ?? null,
      // Consent ledger — evidence of what the customer agreed to and when.
      // Version string must match the one shown on /terms.
      terms_version:       body.agreeTerms === true ? '2.0' : null,
      terms_accepted_at:   body.agreeTerms === true ? new Date().toISOString() : null,
      marketing_consent:   body.marketingConsent === true,
      total_days:          totalDays,
      total_price:         serverTotalPrice,
      price_per_day:       serverPricePerDay,
      pickup_time:         body.pickup_time ?? '09:00',
      return_time:         body.return_time ?? '09:00',
      status:              'PENDING',
    }])
    .select()
    .single();

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }

  // "Booking request received" email — sent server-side, exactly once per
  // successfully created booking (this is a separate EmailJS template from
  // the "booking confirmed" one, which is only sent by the admin route on
  // the transition into CONFIRMED). Failure is non-fatal: the booking is
  // already saved; the response tells the client whether the email went out
  // so the confirmation page never claims an email that wasn't sent.
  const emailSent = await sendRequestReceivedEmail({
    booking: data,
    vehicle: { make: vehicle.make, model: vehicle.model, year: vehicle.year },
  });

  return NextResponse.json({ data, emailSent }, { status: 201 });
}

function formatDateHe(dateStr: string): string {
  const datePart = String(dateStr).split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

async function sendRequestReceivedEmail({
  booking,
  vehicle,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: any;
  vehicle: { make: string; model: string; year: number };
}): Promise<boolean> {
  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('[bookings] EmailJS not fully configured — request-received email not sent for', booking.id);
    return false;
  }

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  serviceId,
        template_id: templateId,
        user_id:     publicKey,
        accessToken: privateKey,
        template_params: {
          to_email:        booking.customer_email,
          to_name:         booking.customer_name,
          order_id:        String(booking.id).slice(0, 8).toUpperCase(),
          booking_type:    'השכרה',
          vehicle_name:    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          start_date:      formatDateHe(booking.pickup_date),
          end_date:        formatDateHe(booking.dropoff_date),
          pickup_location: booking.pickup_location,
          return_location: booking.dropoff_location || booking.pickup_location,
          customer_phone:  booking.customer_phone,
          total_price:     booking.total_price ? `₪${Number(booking.total_price).toLocaleString()}` : 'יצור קשר לפרטים',
          bcc_email:       'office@smartcar.co.il',
          pickup_time:     booking.pickup_time || '09:00',
          return_time:     booking.return_time || '09:00',
          logo_url:        'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
        },
      }),
    });
    if (!res.ok) {
      console.error('[bookings] request-received email failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[bookings] request-received email error:', err);
    return false;
  }
}
