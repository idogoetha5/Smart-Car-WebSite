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

  return NextResponse.json({ data }, { status: 201 });
}
