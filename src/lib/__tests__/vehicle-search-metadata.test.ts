import { describe, expect, it } from 'vitest';
import { vehicleSearchMetadata } from '@/lib/vehicle-search-metadata';
import type { Vehicle } from '@/types';

const vehicle = {
  id: 'vehicle-fixture', make: 'BMW', model: 'X2', year: 2026,
  seats: 5, transmission: 'AUTOMATIC', pricePerDay: 1060,
  displayPricePerDay: 850, minimumDailyPrice: 950,
  imageUrls: ['/images/vehicle-gallery/bmw-x2-gray-2026-front-v1.webp'],
} as Vehicle;

describe('vehicle search metadata covers empty and generic inventory descriptions', () => {
  for (const locale of ['he', 'en']) {
    it.each([undefined, '', ' ', 'Luxury sedan'])(`uses factual model-specific copy in ${locale} for %j`, description => {
      const metadata = vehicleSearchMetadata({ ...vehicle, descriptionHe: description, descriptionEn: description }, locale);
      expect(metadata.description).toContain('BMW X2');
      expect(metadata.description).toContain('5');
      expect(metadata.description).toContain(locale === 'he' ? 'אוטומטי' : 'automatic');
      expect(metadata.description).toContain(locale === 'he' ? 'באישור נציג' : 'require confirmation');
      expect(metadata.description).not.toMatch(/1060|950|850|2026|Luxury sedan/);
      expect(metadata.title).toEqual({ absolute: locale === 'he' ? 'BMW X2 להשכרה בישראל | SmartCar' : 'BMW X2 Rental in Israel | SmartCar' });
      expect(metadata.alternates?.canonical).toBe(`/${locale}/rental/vehicle-fixture`);
      expect(metadata.openGraph?.description).toBe(metadata.description);
      expect(metadata.twitter?.description).toBe(metadata.description);
    });
    it(`does not mutate price or vehicle data in ${locale}`, () => {
      const before = JSON.stringify(vehicle);
      vehicleSearchMetadata(vehicle, locale);
      expect(JSON.stringify(vehicle)).toBe(before);
    });
  }
  it('keeps manual transmission and missing photos honest', () => {
    const metadata = vehicleSearchMetadata({ ...vehicle, transmission: 'MANUAL', imageUrls: [] }, 'en');
    expect(metadata.description).toContain('manual transmission');
    expect(metadata.openGraph?.images).toBeUndefined();
  });
  it('does not invent specifications for incomplete records', () => {
    expect(vehicleSearchMetadata({ id: 'incomplete' } as Vehicle, 'he')).toEqual({});
    const result = vehicleSearchMetadata({ id: 'incomplete', make: 'BMW', model: 'X2' } as Vehicle, 'en');
    expect(result.description).not.toMatch(/undefined|manual|automatic|seats/);
  });
});
