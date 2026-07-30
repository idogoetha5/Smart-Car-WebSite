import { describe, expect, it } from 'vitest';
import { resolveVehicleImageUrl, VEHICLE_BUCKET_URL } from '@/lib/car-images';

const YARIS = 'toyota_yaris_2025_white_corrected_front_3_4_front.png';

describe('resolveVehicleImageUrl', () => {
  it('rescues the /images/vehicles path that 404s on the live card', () => {
    expect(resolveVehicleImageUrl(`/images/vehicles/${YARIS}`)).toBe(
      `${VEHICLE_BUCKET_URL}/${YARIS}`
    );
  });

  it('resolves a bare filename against the vehicles bucket', () => {
    expect(resolveVehicleImageUrl(YARIS)).toBe(`${VEHICLE_BUCKET_URL}/${YARIS}`);
    expect(resolveVehicleImageUrl(`vehicles/${YARIS}`)).toBe(`${VEHICLE_BUCKET_URL}/${YARIS}`);
  });

  it('leaves absolute URLs untouched', () => {
    const url = `${VEHICLE_BUCKET_URL}/${YARIS}`;
    expect(resolveVehicleImageUrl(url)).toBe(url);
    expect(resolveVehicleImageUrl('https://example.com/a/b/car.png')).toBe(
      'https://example.com/a/b/car.png'
    );
  });

  it('leaves other local assets alone', () => {
    expect(resolveVehicleImageUrl('/images/hero-car.webp')).toBe('/images/hero-car.webp');
  });

  it('treats empty and whitespace values as no image', () => {
    expect(resolveVehicleImageUrl(null)).toBeNull();
    expect(resolveVehicleImageUrl(undefined)).toBeNull();
    expect(resolveVehicleImageUrl('')).toBeNull();
    expect(resolveVehicleImageUrl('   ')).toBeNull();
  });

  it('encodes spaces in a filename', () => {
    expect(resolveVehicleImageUrl('toyota yaris.png')).toBe(
      `${VEHICLE_BUCKET_URL}/toyota%20yaris.png`
    );
  });
});
