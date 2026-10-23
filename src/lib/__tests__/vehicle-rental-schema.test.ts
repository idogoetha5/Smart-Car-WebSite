import { describe, expect, it } from 'vitest';
import type { Vehicle } from '@/types';
import { rentalSchemaJson, vehicleRentalSchema } from '@/lib/vehicle-rental-schema';

const vehicle = {
  id: 'x2', make: 'BMW', model: 'X2', year: 2026, seats: 5,
  transmission: 'AUTOMATIC', pricePerDay: 1060,
  displayPricePerDay: 850, minimumDailyPrice: 950,
  imageUrls: ['/images/x2.webp'], descriptionHe: '', descriptionEn: ' ',
} as Vehicle;

describe('rental structured data follows public display without changing booking', () => {
  for (const locale of ['he', 'en']) {
    it(`describes the ${locale} rental and the configured advertised price`, () => {
      const before = JSON.stringify(vehicle);
      const schema = vehicleRentalSchema(vehicle, locale, 'https://www.smartcar.co.il');
      expect(schema.name).toBe('BMW X2');
      expect(schema.description).toContain('BMW X2');
      expect(schema.offers.price).toBe(850);
      expect(schema.offers.priceSpecification?.price).toBe(850);
      expect(schema.offers.businessFunction).toBe('http://purl.org/goodrelations/v1#LeaseOut');
      expect(schema.offers.url).toBe(`https://www.smartcar.co.il/${locale}/rental/x2`);
      expect(JSON.stringify(vehicle)).toBe(before);
      expect(vehicle.pricePerDay).toBe(1060);
      expect(vehicle.minimumDailyPrice).toBe(950);
    });
  }
  it('keeps the normal price when no separate display price exists', () => {
    expect(vehicleRentalSchema({ ...vehicle, displayPricePerDay: null }, 'he', 'https://www.smartcar.co.il').offers.price).toBe(1060);
  });
  it('does not invent a free or nonnumeric price for incomplete records', () => {
    for (const pricePerDay of [0, -1, NaN]) {
      expect(vehicleRentalSchema({ ...vehicle, displayPricePerDay: null, pricePerDay }, 'en', 'https://www.smartcar.co.il').offers).not.toHaveProperty('price');
    }
  });
  it('escapes HTML script closure without changing the parsed description', () => {
    const schema = vehicleRentalSchema({ ...vehicle, descriptionHe: '</script><script>alert(1)</script>' }, 'he', 'https://www.smartcar.co.il');
    const json = rentalSchemaJson(schema);
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(schema)));
  });
});
