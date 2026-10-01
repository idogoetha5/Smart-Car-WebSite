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
    supabase.from('vehicles').select('id, make, model, year, license_plate, is_available').order('make').order('model'),
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
      available: c.is_available !== false,
      withCustomer: lastInspection?.kind === 'pickup',
      inGarage: open.some((e) => e.serviceKind !== 'wash'),
      toWash: open.some((e) => e.serviceKind === 'wash'),
      lastKm: history.find((e) => e.km != null)?.km ?? null,
      lastWash: done.find((e) => e.serviceKind === 'wash')?.day ?? null,
      lastService: done.find((e) => e.serviceKind !== 'wash')?.day ?? null,
      openTaskIds: open.map((e) => e.id),
      history,
    };
  });

  return NextResponse.json({ data });
}
