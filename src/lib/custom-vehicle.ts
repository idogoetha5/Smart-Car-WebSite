import type { createAdminClient } from '@/lib/supabase/server';
import { normalizePlate } from '@/lib/booking-vehicle';

type Admin = ReturnType<typeof createAdminClient>;

export interface VehicleInput {
  vehicleId: string;
  customVehicleName: string;
  customLicensePlate: string;
}

export type ResolvedVehicle =
  | { ok: true; vehicleId: string | null; customVehicleName: string | null; customLicensePlate: string | null }
  | { ok: false; status: number; error: string };

export function readVehicleInput(body: Record<string, unknown> | null): VehicleInput {
  return {
    vehicleId: String(body?.vehicleId ?? '').trim(),
    customVehicleName: String(body?.customVehicleName ?? '').trim().slice(0, 120),
    customLicensePlate: String(body?.customLicensePlate ?? '').trim().slice(0, 20),
  };
}

/**
 * The car for a new field job: a fleet vehicle, or one typed in by hand
 * (licence plate required, name optional). A typed plate that matches
 * a fleet car is linked to that car, so it shows with its real name.
 */
export async function resolveVehicle(
  supabase: Admin,
  input: VehicleInput,
  /** Drivers must enter a plate; managers/admin assigning ahead may not know it yet. */
  options: { requirePlate: boolean } = { requirePlate: true }
): Promise<ResolvedVehicle> {
  const { vehicleId, customVehicleName, customLicensePlate } = input;
  const { requirePlate } = options;

  if (vehicleId) {
    const { data, error } = await supabase.from('vehicles').select('id, license_plate').eq('id', vehicleId).maybeSingle();
    if (error) {
      console.error('[custom-vehicle] vehicle lookup failed:', error.message);
      return { ok: false, status: 500, error: 'שגיאת שרת' };
    }
    if (!data) return { ok: false, status: 404, error: 'הרכב לא נמצא' };
    // Every job needs a plate: a fleet car without one takes the typed plate on the booking.
    if (!(data as { license_plate: string | null }).license_plate?.trim()) {
      if (!customLicensePlate && requirePlate) return { ok: false, status: 400, error: 'לרכב הזה אין מספר רישוי במערכת — יש לכתוב אותו' };
      return { ok: true, vehicleId, customVehicleName: null, customLicensePlate: customLicensePlate || null };
    }
    return { ok: true, vehicleId, customVehicleName: null, customLicensePlate: null };
  }

  if (requirePlate ? !customLicensePlate : !customLicensePlate && !customVehicleName) {
    return {
      ok: false,
      status: 400,
      error: requirePlate ? 'יש לבחור רכב מהרשימה, או לכתוב את מספר הרישוי' : 'יש לבחור רכב, או לכתוב מספר רישוי או שם רכב',
    };
  }

  const plateDigits = normalizePlate(customLicensePlate);
  if (plateDigits.length >= 5) {
    const { data, error } = await supabase.from('vehicles').select('id, license_plate').not('license_plate', 'is', null);
    if (error) {
      console.error('[custom-vehicle] plate lookup failed:', error.message);
    } else {
      const match = (data ?? []).find((v: { id: string; license_plate: string | null }) => normalizePlate(v.license_plate) === plateDigits);
      if (match) return { ok: true, vehicleId: match.id, customVehicleName: null, customLicensePlate: null };
    }
  }

  return {
    ok: true,
    vehicleId: null,
    customVehicleName: customVehicleName || null,
    customLicensePlate: customLicensePlate || null,
  };
}
