export interface BookingVehicleSource {
  custom_vehicle_name?: string | null;
  vehicle?: { make: string; model: string; license_plate?: string | null } | null;
}

export function bookingVehicleName(booking?: BookingVehicleSource | null): string {
  if (booking?.vehicle) return `${booking.vehicle.make} ${booking.vehicle.model}`.trim();
  return booking?.custom_vehicle_name?.trim() || '—';
}

export function bookingLicensePlate(booking?: BookingVehicleSource | null): string {
  const plate = booking?.vehicle?.license_plate;
  return plate?.trim() || '—';
}
