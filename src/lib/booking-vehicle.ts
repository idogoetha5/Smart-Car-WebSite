export interface BookingVehicleSource {
  custom_vehicle_name?: string | null;
  /** Plate typed in for a car that isn't in the fleet list. */
  custom_license_plate?: string | null;
  vehicle?: { make: string; model: string; license_plate?: string | null } | null;
}

export function bookingVehicleName(booking?: BookingVehicleSource | null): string {
  if (booking?.vehicle) return `${booking.vehicle.make} ${booking.vehicle.model}`.trim();
  const name = booking?.custom_vehicle_name?.trim();
  if (name) return name;
  // Only a plate was entered — the plate is shown next to this.
  return booking?.custom_license_plate?.trim() ? 'רכב' : '—';
}

export function bookingLicensePlate(booking?: BookingVehicleSource | null): string {
  const plate = booking?.vehicle?.license_plate?.trim() || booking?.custom_license_plate?.trim();
  return plate || '—';
}

/** Digits only — Israeli plates are compared without dashes or spaces. */
export function normalizePlate(plate: string | null | undefined): string {
  return (plate ?? '').replace(/\D/g, '');
}
