import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { israelToday, israelTomorrow, israelDayRange } from '@/lib/israel-day';
import { formatLocationForDriver } from '@/lib/location-display';
import { numericOrderReference } from '@/lib/order-reference';

const SEARCH_WINDOW_DAYS = 45;

interface BookingRow {
  id: string;
  customer_name: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string;
  dropoff_location: string;
  vehicle: { make: string; model: string; license_plate: string | null } | null;
}

interface InspectionSlot {
  id: string;
  status: 'awaiting_signature' | 'signed';
}

function shapeRow(
  b: BookingRow,
  inspections: Map<string, InspectionSlot>
) {
  return {
    bookingId: b.id,
    bookingNumber: numericOrderReference(b.id),
    customerName: b.customer_name,
    vehicleName: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—',
    licensePlate: b.vehicle?.license_plate ?? '—',
    pickupLocation: formatLocationForDriver(b.pickup_location),
    dropoffLocation: formatLocationForDriver(b.dropoff_location),
    pickupDate: b.pickup_date,
    dropoffDate: b.dropoff_date,
    pickupTime: b.pickup_time,
    returnTime: b.return_time,
    pickupInspection: inspections.get(`${b.id}:pickup`) ?? null,
    returnInspection: inspections.get(`${b.id}:return`) ?? null,
  };
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
  // Ordered ascending, so a later row for the same booking+type overwrites
  // an earlier one — the map ends up holding the most recent inspection.
  for (const row of data ?? []) {
    map.set(`${row.booking_id}:${row.type}`, { id: row.id, status: row.status });
  }
  return map;
}

export async function GET(request: NextRequest) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';
  const supabase = createAdminClient();
  const VEHICLE_SELECT =
    'id, customer_name, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, vehicle:vehicles(make, model, license_plate)';

  if (search) {
    // numericOrderReference is a one-way hash with no reverse lookup, so a
    // search by booking number can't be a direct DB filter — this scans a
    // bounded window and matches in JS instead of the whole table.
    const since = new Date(Date.now() - SEARCH_WINDOW_DAYS * 86_400_000).toISOString();
    const until = new Date(Date.now() + SEARCH_WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .select(VEHICLE_SELECT)
      .or(
        `and(pickup_date.gte.${since},pickup_date.lte.${until}),and(dropoff_date.gte.${since},dropoff_date.lte.${until})`
      )
      .returns<BookingRow[]>();

    if (error) {
      console.error('[driver/today] search query failed:', error.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }

    const needle = search.toLowerCase();
    const matches = (data ?? []).filter((b) => {
      const plate = (b.vehicle?.license_plate ?? '').toLowerCase();
      return (
        b.customer_name.toLowerCase().includes(needle) ||
        plate.includes(needle.replace(/[\s-]/g, '')) ||
        numericOrderReference(b.id) === search
      );
    });

    const inspections = await inspectionMapFor(matches.map((b) => b.id));
    return NextResponse.json({ results: matches.map((b) => shapeRow(b, inspections)) });
  }

  const dateParam = request.nextUrl.searchParams.get('date') === 'tomorrow' ? israelTomorrow() : israelToday();
  const { startISO, endISO } = israelDayRange(dateParam);

  const [pickupsRes, returnsRes] = await Promise.all([
    supabase.from('bookings').select(VEHICLE_SELECT).gte('pickup_date', startISO).lt('pickup_date', endISO).returns<BookingRow[]>(),
    supabase.from('bookings').select(VEHICLE_SELECT).gte('dropoff_date', startISO).lt('dropoff_date', endISO).returns<BookingRow[]>(),
  ]);

  if (pickupsRes.error || returnsRes.error) {
    console.error('[driver/today] date query failed:', pickupsRes.error?.message, returnsRes.error?.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const allIds = [...(pickupsRes.data ?? []), ...(returnsRes.data ?? [])].map((b) => b.id);
  const inspections = await inspectionMapFor(allIds);

  const sortByTime = (rows: BookingRow[], timeField: 'pickup_time' | 'return_time') =>
    [...rows].sort((a, b) => (a[timeField] ?? '99:99').localeCompare(b[timeField] ?? '99:99'));

  return NextResponse.json({
    date: dateParam,
    pickups: sortByTime(pickupsRes.data ?? [], 'pickup_time').map((b) => shapeRow(b, inspections)),
    returns: sortByTime(returnsRes.data ?? [], 'return_time').map((b) => shapeRow(b, inspections)),
  });
}
