import { NextResponse } from 'next/server';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { calculateInspectionDeviation } from '@/lib/inspection-deviation';
import type { DamageMark } from '@/lib/inspection-damage';
import { createInspectionToken } from '@/lib/inspection-link';
import { createAdminClient } from '@/lib/supabase/server';

export type RentalAlertKind = 'mileage' | 'fuel' | 'damage' | 'odometer';

export interface RentalAlert {
  id: string;
  bookingId: string;
  signedAt: string;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  rentalDays: number;
  pickupOdometerKm: number;
  returnOdometerKm: number;
  distanceKm: number;
  allowedKm: number;
  excessKm: number;
  pickupFuelEighths: number;
  returnFuelEighths: number;
  fuelMissingEighths: number;
  newDamages: DamageMark[];
  kinds: RentalAlertKind[];
  isLatestRental: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  pdfUrl: string | null;
  videoUrl: string | null;
}

interface BookingRow {
  id: string;
  customer_name: string;
  total_days: number | null;
  vehicle_id: string | null;
  custom_vehicle_name: string | null;
  custom_license_plate: string | null;
  vehicle: { make: string; model: string; license_plate: string | null } | null;
}

interface InspectionRow {
  id: string;
  booking_id: string;
  type: 'pickup' | 'return';
  odometer_km: number;
  fuel_eighths: number;
  damage_marks: DamageMark[] | null;
  handover_inspection_id: string | null;
  signed_at: string | null;
  video_path: string | null;
  signed_pdf_path: string | null;
  booking: BookingRow | null;
}

interface ReviewRow {
  return_inspection_id: string;
  resolved_at: string;
  resolved_by_role: 'manager' | 'admin';
  resolver: { name: string } | null;
}

const DAY_MS = 86_400_000;
const SAME_SPOT_DISTANCE = 0.055;
const SAME_KIND_DISTANCE = 0.09;

function damageDistance(a: DamageMark, b: DamageMark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Filters out return marks that match damage already recorded at pickup. */
export function newDamageMarks(pickup: readonly DamageMark[], returned: readonly DamageMark[]): DamageMark[] {
  return returned.filter((mark) =>
    !pickup.some((old) => {
      if (old.view !== mark.view) return false;
      const distance = damageDistance(old, mark);
      return distance <= SAME_SPOT_DISTANCE || (old.kind === mark.kind && distance <= SAME_KIND_DISTANCE);
    })
  );
}

/** Every started 24-hour period counts as a rental day; booking days are the fallback. */
export function rentalDaysBetween(pickupSignedAt: string | null, returnSignedAt: string | null, bookingDays: number | null): number {
  if (pickupSignedAt && returnSignedAt) {
    const elapsed = new Date(returnSignedAt).getTime() - new Date(pickupSignedAt).getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0) return Math.max(1, Math.ceil(elapsed / DAY_MS));
  }
  return Math.max(1, Math.ceil(Number(bookingDays) || 1));
}

function vehicleKey(row: InspectionRow): string {
  if (row.booking?.vehicle_id) return `vehicle:${row.booking.vehicle_id}`;
  const plate = bookingLicensePlate(row.booking).replace(/[\s-]/g, '').toLowerCase();
  return plate ? `plate:${plate}` : `booking:${row.booking_id}`;
}

function signedTime(row: InspectionRow): number {
  return row.signed_at ? new Date(row.signed_at).getTime() : 0;
}

/** Builds current alerts and retained history from signed pickup/return pairs. */
export async function listRentalAlerts(): Promise<NextResponse> {
  const supabase = createAdminClient();
  const [inspectionsResult, reviewsResult] = await Promise.all([
    supabase
      .from('vehicle_inspections')
      .select(
        'id, booking_id, type, odometer_km, fuel_eighths, damage_marks, handover_inspection_id, signed_at, video_path, signed_pdf_path, booking:bookings(id, customer_name, total_days, vehicle_id, custom_vehicle_name, custom_license_plate, vehicle:vehicles(make, model, license_plate))'
      )
      .eq('status', 'signed')
      .order('signed_at', { ascending: false })
      .limit(1200),
    supabase
      .from('rental_alert_reviews')
      .select('return_inspection_id, resolved_at, resolved_by_role, resolver:drivers(name)')
      .order('resolved_at', { ascending: false }),
  ]);

  if (inspectionsResult.error || reviewsResult.error) {
    console.error('[rental-alerts] lookup failed:', inspectionsResult.error?.message ?? reviewsResult.error?.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const inspections = (inspectionsResult.data ?? []) as unknown as InspectionRow[];
  const reviews = new Map(
    ((reviewsResult.data ?? []) as unknown as ReviewRow[]).map((review) => [review.return_inspection_id, review])
  );
  const pickupsById = new Map(inspections.filter((row) => row.type === 'pickup').map((row) => [row.id, row]));
  const pickupsByBooking = new Map<string, InspectionRow[]>();
  for (const pickup of pickupsById.values()) {
    const rows = pickupsByBooking.get(pickup.booking_id) ?? [];
    rows.push(pickup);
    pickupsByBooking.set(pickup.booking_id, rows);
  }
  for (const rows of pickupsByBooking.values()) rows.sort((a, b) => signedTime(b) - signedTime(a));

  const returns = inspections.filter((row) => row.type === 'return' && row.signed_at);
  const latestReturnByVehicle = new Map<string, string>();
  for (const returned of returns) {
    const key = vehicleKey(returned);
    if (!latestReturnByVehicle.has(key)) latestReturnByVehicle.set(key, returned.id);
  }

  const alerts: RentalAlert[] = [];
  for (const returned of returns) {
    const explicitlyLinked = returned.handover_inspection_id
      ? pickupsById.get(returned.handover_inspection_id)
      : undefined;
    const sameBooking = (pickupsByBooking.get(returned.booking_id) ?? []).find(
      (pickup) => signedTime(pickup) <= signedTime(returned)
    );
    const pickup = explicitlyLinked ?? sameBooking;
    if (!pickup) continue;

    const rentalDays = rentalDaysBetween(pickup.signed_at, returned.signed_at, returned.booking?.total_days ?? null);
    const deviation = calculateInspectionDeviation(
      { odometerKm: pickup.odometer_km, fuelEighths: pickup.fuel_eighths },
      { odometerKm: returned.odometer_km, fuelEighths: returned.fuel_eighths },
      rentalDays
    );
    const damages = newDamageMarks(pickup.damage_marks ?? [], returned.damage_marks ?? []);
    const kinds: RentalAlertKind[] = [];
    if (deviation.distanceKm !== null && deviation.distanceKm < 0) kinds.push('odometer');
    else if (deviation.excessKm > 0) kinds.push('mileage');
    if (deviation.fuelMissingEighths > 0) kinds.push('fuel');
    if (damages.length > 0) kinds.push('damage');
    if (!kinds.length || deviation.distanceKm === null) continue;

    const review = reviews.get(returned.id);
    const token = createInspectionToken(returned.id, 24);
    alerts.push({
      id: returned.id,
      bookingId: returned.booking_id,
      signedAt: returned.signed_at as string,
      customerName: returned.booking?.customer_name ?? '',
      vehicleName: bookingVehicleName(returned.booking),
      licensePlate: bookingLicensePlate(returned.booking),
      rentalDays,
      pickupOdometerKm: pickup.odometer_km,
      returnOdometerKm: returned.odometer_km,
      distanceKm: deviation.distanceKm,
      allowedKm: deviation.allowedKm,
      excessKm: deviation.excessKm,
      pickupFuelEighths: pickup.fuel_eighths,
      returnFuelEighths: returned.fuel_eighths,
      fuelMissingEighths: deviation.fuelMissingEighths,
      newDamages: damages,
      kinds,
      isLatestRental: latestReturnByVehicle.get(vehicleKey(returned)) === returned.id,
      resolvedAt: review?.resolved_at ?? null,
      resolvedBy: review ? review.resolver?.name ?? (review.resolved_by_role === 'admin' ? 'מנהל מערכת' : 'מנהל') : null,
      pdfUrl: returned.signed_pdf_path ? `/insp-pdf/${encodeURIComponent(token)}` : null,
      videoUrl: returned.video_path ? `/insp-video/${encodeURIComponent(token)}` : null,
    });
  }

  alerts.sort((a, b) => {
    const aCurrent = Number(a.isLatestRental && !a.resolvedAt);
    const bCurrent = Number(b.isLatestRental && !b.resolvedAt);
    return bCurrent - aCurrent || new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime();
  });
  return NextResponse.json({ data: alerts });
}

export async function setRentalAlertResolved(params: {
  returnInspectionId: string;
  resolved: boolean;
  managerId: string | null;
}): Promise<NextResponse> {
  const supabase = createAdminClient();
  const { data: inspection, error: inspectionError } = await supabase
    .from('vehicle_inspections')
    .select('id')
    .eq('id', params.returnInspectionId)
    .eq('type', 'return')
    .eq('status', 'signed')
    .maybeSingle();
  if (inspectionError || !inspection) {
    return NextResponse.json({ error: inspectionError ? 'Lookup failed' : 'Return inspection not found' }, { status: inspectionError ? 500 : 404 });
  }

  if (!params.resolved) {
    const { error } = await supabase.from('rental_alert_reviews').delete().eq('return_inspection_id', params.returnInspectionId);
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from('rental_alert_reviews').upsert(
    {
      return_inspection_id: params.returnInspectionId,
      resolved_at: new Date().toISOString(),
      resolved_by_driver_id: params.managerId,
      resolved_by_role: params.managerId ? 'manager' : 'admin',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'return_inspection_id' }
  );
  if (error) {
    console.error('[rental-alerts] resolve failed:', error.message);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
