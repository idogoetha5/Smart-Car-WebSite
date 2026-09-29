import { describe, expect, it } from 'vitest';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';

describe('booking vehicle display', () => {
  it('uses the fleet vehicle when one is linked', () => {
    const booking = {
      vehicle: { make: 'Toyota', model: 'Corolla', license_plate: '12-345-67' },
      custom_vehicle_name: 'Ignored',
    };

    expect(bookingVehicleName(booking)).toBe('Toyota Corolla');
    expect(bookingLicensePlate(booking)).toBe('12-345-67');
  });

  it('uses the manually entered vehicle when there is no fleet vehicle', () => {
    const booking = {
      vehicle: null,
      custom_vehicle_name: 'Ford Transit 98-765-43',
    };

    expect(bookingVehicleName(booking)).toBe('Ford Transit 98-765-43');
    expect(bookingLicensePlate(booking)).toBe('—');
  });

  it('returns a display placeholder for missing values', () => {
    expect(bookingVehicleName(null)).toBe('—');
    expect(bookingLicensePlate(null)).toBe('—');
  });
});
