import { createAdminClient } from '@/lib/supabase/server';
import { createInspectionToken } from '@/lib/inspection-link';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import type { DamageMark } from '@/lib/inspection-damage';
import type { Checklist } from '@/lib/inspection-checklist';

export interface HandoverDamage {
  inspectionId: string;
  /** The rental the handover belongs to — a return is done on the same booking. */
  bookingId: string | null;
  customerPhone: string | null;
  marks: DamageMark[];
  /** Token for /insp-photo of the handover inspection's photos. */
  mediaToken: string;
  odometerKm: number;
  fuelEighths: number;
  checklist: Checklist | null;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  signedAt: string | null;
}

const SELECT =
  'id, booking_id, status, type, damage_marks, odometer_km, fuel_eighths, checklist, signed_at, created_at, booking:bookings(customer_name, customer_phone, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))';

type Row = {
  id: string;
  booking_id: string | null;
  status: string;
  type: string;
  damage_marks: DamageMark[] | null;
  odometer_km: number;
  fuel_eighths: number;
  checklist: Checklist | null;
  signed_at: string | null;
  booking: {
    customer_name: string;
    customer_phone?: string | null;
    custom_vehicle_name: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
};

function shape(row: Row): HandoverDamage {
  return {
    inspectionId: row.id,
    bookingId: row.booking_id,
    customerPhone: row.booking?.customer_phone ?? null,
    marks: row.damage_marks ?? [],
    mediaToken: createInspectionToken(row.id, 24),
    odometerKm: row.odometer_km,
    fuelEighths: row.fuel_eighths,
    checklist: row.checklist ?? null,
    customerName: row.booking?.customer_name ?? '',
    vehicleName: bookingVehicleName(row.booking),
    licensePlate: bookingLicensePlate(row.booking),
    signedAt: row.signed_at,
  };
}

/**
 * The handover (pickup) a return is compared with: the one the driver
 * picked (handoverInspectionId), otherwise the latest signed — or latest —
 * handover on the same booking. Its damage is drawn grey on the return so
 * only new damage is marked, and its mileage/fuel/checklist are the
 * baseline for the office alerts.
 */
export async function loadHandover(params: { bookingId?: string | null; handoverInspectionId?: string | null }): Promise<HandoverDamage | null> {
  const supabase = createAdminClient();
  if (params.handoverInspectionId) {
    const { data, error } = await supabase
      .from('vehicle_inspections')
      .select(SELECT)
      .eq('id', params.handoverInspectionId)
      .eq('type', 'pickup')
      .maybeSingle<Row>();
    if (error) console.error('[inspection-previous] by id failed:', error.message);
    if (data) return shape(data);
  }
  if (!params.bookingId) return null;
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(SELECT)
    .eq('booking_id', params.bookingId)
    .eq('type', 'pickup')
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<Row[]>();
  if (error) {
    console.error('[inspection-previous] lookup failed:', error.message);
    return null;
  }
  const rows = data ?? [];
  const row = rows.find((r) => r.status === 'signed') ?? rows[0];
  return row ? shape(row) : null;
}

/** Back-compat wrapper. */
export async function loadHandoverDamage(bookingId: string, handoverInspectionId?: string | null) {
  return loadHandover({ bookingId, handoverInspectionId });
}

/** Signed handovers from the last 120 days matching a customer name or plate — for the return picker. */
export async function searchHandovers(query: string): Promise<HandoverDamage[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(SELECT)
    .eq('type', 'pickup')
    .eq('status', 'signed')
    .gte('signed_at', since)
    .order('signed_at', { ascending: false })
    .limit(400)
    .returns<Row[]>();
  if (error) {
    console.error('[inspection-previous] search failed:', error.message);
    return [];
  }
  const compact = needle.replace(/[\s-]/g, '');
  const matches = (data ?? []).filter((r) => {
    const name = (r.booking?.customer_name ?? '').toLowerCase();
    const plate = bookingLicensePlate(r.booking).toLowerCase().replace(/[\s-]/g, '');
    return name.includes(needle) || (compact.length >= 3 && plate.includes(compact));
  });
  if (!matches.length) return [];

  // A handover drops out of the return picker once its return is signed —
  // either on the same rental or linked to this handover explicitly.
  const bookingIds = [...new Set(matches.map((r) => r.booking_id).filter((id): id is string => Boolean(id)))];
  const handoverIds = matches.map((r) => r.id);
  const [byBooking, byLink] = await Promise.all([
    bookingIds.length
      ? supabase.from('vehicle_inspections').select('booking_id').eq('type', 'return').eq('status', 'signed').in('booking_id', bookingIds)
      : Promise.resolve({ data: [] as Array<{ booking_id: string | null }>, error: null }),
    supabase.from('vehicle_inspections').select('handover_inspection_id').eq('type', 'return').eq('status', 'signed').in('handover_inspection_id', handoverIds),
  ]);
  if (byBooking.error || byLink.error) {
    console.error('[inspection-previous] returned lookup failed:', byBooking.error?.message ?? byLink.error?.message);
  }
  const returnedBookings = new Set((byBooking.data ?? []).map((r) => r.booking_id));
  const returnedHandovers = new Set((byLink.data ?? []).map((r: { handover_inspection_id: string | null }) => r.handover_inspection_id));

  return matches
    .filter((r) => !returnedHandovers.has(r.id) && !(r.booking_id && returnedBookings.has(r.booking_id)))
    .slice(0, 20)
    .map(shape);
}
