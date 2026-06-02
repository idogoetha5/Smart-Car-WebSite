import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const vehicleId   = searchParams.get('vehicleId');
  const pickupDate  = searchParams.get('pickupDate');
  const dropoffDate = searchParams.get('dropoffDate');

  if (!vehicleId || !pickupDate || !dropoffDate) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .in('status', ['CONFIRMED', 'ACTIVE'])
      .lt('pickup_date', dropoffDate)
      .gt('dropoff_date', pickupDate);

    return NextResponse.json({
      available: !conflicts || conflicts.length === 0,
    });
  } catch {
    return NextResponse.json({ available: true });
  }
}
