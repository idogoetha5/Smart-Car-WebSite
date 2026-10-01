import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

type Kind = 'garage' | 'tire' | 'wash' | 'test' | 'other';

export interface FleetEvent {
  id: string;
  /** service = garage / tyres / wash / test task; pickup / return = signed inspection. */
  kind: 'service' | 'pickup' | 'return';
  serviceKind?: Kind | null;
  reason?: string | null;
  place?: string | null;
  note?: string | null;
  status?: 'open' | 'done' | 'cancelled';
  urgent?: boolean;
  day: string;
  time: string | null;
  at: string;
  driverName: string | null;
  customerName?: string | null;
  km?: number | null;
  damageCount?: number;
}

export interface FleetVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  licensePlate: string | null;
  testDueDate: string | null;
  currentOdometerKm: number | null;
  color: string | null;
  category: string;
  fuelType: string;
  transmission: string;
  available: boolean;
  /** Last signed inspection was a handover with no return after it. */
  withCustomer: boolean;
  inGarage: boolean;
  toWash: boolean;
  lastKm: number | null;
  lastWash: string | null;
  lastService: string | null;
  openTaskIds: string[];
  history: FleetEvent[];
}

/**
 * Branch manager: the fleet with each car's story — garage / tyre / wash
 * trips and signed handovers and returns (km, new damage), newest first.
 */
export async function GET() {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const [cars, tasks, inspections] = await Promise.all([
    supabase.from('vehicles').select('id, make, model, year, license_plate, test_due_date, current_odometer_km, color_he, category, fuel_type, transmission, is_available').order('make').order('model'),
    supabase
      .from('driver_tasks')
      .select('id, status, urgent, notes, created_at, scheduled_at, scheduled_time, service_kind, service_reason, service_place, vehicle_id, driver:drivers(name)')
      .eq('type', 'service')
      .not('vehicle_id', 'is', null)
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: false })
      .limit(1000),
    supabase
      .from('vehicle_inspections')
      .select('id, type, signed_at, odometer_km, damage_marks, driver:drivers(name), booking:bookings!inner(vehicle_id, customer_name)')
      .eq('status', 'signed')
      .not('booking.vehicle_id', 'is', null)
      .order('signed_at', { ascending: false })
      .limit(1000),
  ]);
  const failed = cars.error || tasks.error || inspections.error;
  if (failed) {
    console.error('[driver/manage/fleet] lookup failed:', failed.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const byCar = new Map<string, FleetEvent[]>();
  const push = (carId: string, e: FleetEvent) => {
    const list = byCar.get(carId);
    if (list) list.push(e);
    else byCar.set(carId, [e]);
  };

  for (const t of tasks.data ?? []) {
    const day = String(t.scheduled_at ?? t.created_at ?? '').slice(0, 10);
    push(t.vehicle_id as string, {
      id: t.id,
      kind: 'service',
      serviceKind: (t.service_kind as Kind) ?? 'garage',
      reason: t.service_reason,
      place: t.service_place,
      note: t.notes,
      status: t.status as FleetEvent['status'],
      urgent: !!t.urgent,
      day,
      time: t.scheduled_time ? String(t.scheduled_time).slice(0, 5) : null,
      at: `${day}T${t.scheduled_time ? String(t.scheduled_time).slice(0, 5) : '00:00'}`,
      driverName: (t.driver as unknown as { name: string } | null)?.name ?? null,
    });
  }

  for (const i of inspections.data ?? []) {
    const booking = i.booking as unknown as { vehicle_id: string | null; customer_name: string } | null;
    if (!booking?.vehicle_id || !i.signed_at) continue;
    const marks = (i.damage_marks ?? []) as unknown[];
    push(booking.vehicle_id, {
      id: i.id,
      kind: i.type as 'pickup' | 'return',
      day: String(i.signed_at).slice(0, 10),
      time: null,
      at: String(i.signed_at),
      driverName: (i.driver as unknown as { name: string } | null)?.name ?? null,
      customerName: booking.customer_name,
      km: i.odometer_km,
      damageCount: marks.length,
    });
  }

  const data: FleetVehicle[] = (cars.data ?? []).map((c) => {
    const history = (byCar.get(c.id) ?? []).sort((a, b) => b.at.localeCompare(a.at));
    const open = history.filter((e) => e.kind === 'service' && e.status === 'open');
    const done = history.filter((e) => e.kind === 'service' && e.status === 'done');
    const lastInspection = history.find((e) => e.kind !== 'service');
    return {
      id: c.id,
      make: c.make,
      model: c.model,
      year: c.year ?? null,
      licensePlate: c.license_plate ?? null,
      testDueDate: c.test_due_date ?? null,
      currentOdometerKm: c.current_odometer_km ?? null,
      color: c.color_he ?? null,
      category: c.category,
      fuelType: c.fuel_type,
      transmission: c.transmission,
      available: c.is_available !== false,
      withCustomer: lastInspection?.kind === 'pickup',
      inGarage: open.some((e) => e.serviceKind !== 'wash'),
      toWash: open.some((e) => e.serviceKind === 'wash'),
      lastKm: history.find((e) => e.km != null)?.km ?? c.current_odometer_km ?? null,
      lastWash: done.find((e) => e.serviceKind === 'wash')?.day ?? null,
      lastService: done.find((e) => e.serviceKind !== 'wash')?.day ?? null,
      openTaskIds: open.map((e) => e.id),
      history,
    };
  });

  return NextResponse.json({ data });
}

const CATEGORIES = new Set(['MINI', 'ECONOMY', 'COMPACT', 'SEDAN', 'CROSSOVER', 'SUV', 'LUXURY', 'VAN', 'ELECTRIC', 'COMMERCIAL']);
const FUEL_TYPES = new Set(['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID']);
const TRANSMISSIONS = new Set(['AUTOMATIC', 'MANUAL']);

/** Add a fleet vehicle from the manager app. */
export async function POST(request: Request) {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const make = String(body?.make ?? '').trim().slice(0, 80);
  const model = String(body?.model ?? '').trim().slice(0, 80);
  const licensePlate = String(body?.licensePlate ?? '').trim().slice(0, 20);
  const testDueDate = String(body?.testDueDate ?? '').trim();
  const year = Number(body?.year);
  const category = String(body?.category ?? 'ECONOMY');
  const fuelType = String(body?.fuelType ?? 'GASOLINE');
  const transmission = String(body?.transmission ?? 'AUTOMATIC');
  const currentOdometerKm = body?.currentOdometerKm === '' || body?.currentOdometerKm == null ? null : Number(body.currentOdometerKm);
  const pricePerDay = Number(body?.pricePerDay ?? 0);
  const pricePerMonth = Number(body?.pricePerMonth ?? 0);
  const depositAmount = Number(body?.depositAmount ?? 0);
  const seats = Number(body?.seats ?? 5);
  const doors = Number(body?.doors ?? 4);

  if (!make || !model || !licensePlate || !testDueDate) {
    return NextResponse.json({ error: 'יש למלא יצרן, דגם, מספר רישוי ומועד טסט' }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    return NextResponse.json({ error: 'שנת הרכב אינה תקינה' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDueDate)) {
    return NextResponse.json({ error: 'מועד הטסט אינו תקין' }, { status: 400 });
  }
  if (!CATEGORIES.has(category) || !FUEL_TYPES.has(fuelType) || !TRANSMISSIONS.has(transmission)) {
    return NextResponse.json({ error: 'אחד מפרטי הרכב אינו תקין' }, { status: 400 });
  }
  if (currentOdometerKm != null && (!Number.isInteger(currentOdometerKm) || currentOdometerKm < 0)) {
    return NextResponse.json({ error: 'קריאת הקילומטרים אינה תקינה' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('vehicles').insert({
    make,
    model,
    license_plate: licensePlate,
    test_due_date: testDueDate,
    current_odometer_km: currentOdometerKm,
    year,
    category,
    fuel_type: fuelType,
    transmission,
    color_he: String(body?.color ?? '').trim().slice(0, 40) || null,
    seats: Number.isInteger(seats) && seats > 0 ? seats : 5,
    doors: Number.isInteger(doors) && doors > 0 ? doors : 4,
    price_per_day: Number.isFinite(pricePerDay) && pricePerDay >= 0 ? pricePerDay : 0,
    price_per_month: Number.isFinite(pricePerMonth) && pricePerMonth >= 0 ? pricePerMonth : 0,
    deposit_amount: Number.isFinite(depositAmount) && depositAmount >= 0 ? depositAmount : 0,
    is_available: body?.available !== false,
    is_featured: false,
    total_units: 1,
  }).select('id').single();

  if (error) {
    console.error('[driver/manage/fleet] create failed:', error.message);
    return NextResponse.json(
      { error: error.code === '23505' ? 'מספר הרישוי כבר קיים במערכת' : 'לא הצלחנו להוסיף את הרכב' },
      { status: error.code === '23505' ? 409 : 500 }
    );
  }
  return NextResponse.json({ data }, { status: 201 });
}
