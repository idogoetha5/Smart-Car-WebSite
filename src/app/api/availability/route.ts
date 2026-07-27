import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit, retryAfter } = await checkRateLimit(`availability:${ip}`, 30, 60_000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const { searchParams } = new URL(request.url);

  const vehicleId   = searchParams.get('vehicleId');
  const pickupDate  = searchParams.get('pickupDate');
  const dropoffDate = searchParams.get('dropoffDate');

  if (!vehicleId || !pickupDate || !dropoffDate) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const [{ data: conflicts, error }, { data: vehicleRow }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .in('status', ['CONFIRMED', 'ACTIVE'])
        .lt('pickup_date', dropoffDate)
        .gt('dropoff_date', pickupDate),
      supabase
        .from('vehicles')
        .select('total_units')
        .eq('id', vehicleId)
        .single(),
    ]);

    if (error) {
      return NextResponse.json(
        { available: false, error: 'Availability temporarily unavailable' },
        { status: 503 }
      );
    }

    // The fleet may hold more than one unit of this model — a date only
    // reads as taken online once every listed unit is booked. And even
    // then this is informational: the online catalog is only part of the
    // full fleet, so the UI never blocks a request based on this.
    const units = Math.max(1, Number(vehicleRow?.total_units) || 1);
    return NextResponse.json({
      available: conflicts.length < units,
    });
  } catch {
    return NextResponse.json(
      { available: false, error: 'Availability temporarily unavailable' },
      { status: 503 }
    );
  }
}
