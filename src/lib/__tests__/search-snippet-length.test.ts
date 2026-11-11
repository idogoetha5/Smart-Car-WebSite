import { describe, expect, it } from 'vitest';
import { BRANCH_RENTAL_ADVICE, LEASING_CATALOG_SEARCH, NATIONAL_RENTAL_ADVICE, SERVICE_RENTAL_ADVICE } from '@/lib/public-rental-content';
import { DELIVERY_CITIES, deliverySearchCopy } from '@/lib/delivery-cities';

// Google shows roughly 60 characters of a title and ~155 of a description.
// Longer text gets cut mid-sentence; much shorter text wastes the snippet.
const entries = [
  ['leasing catalogue', LEASING_CATALOG_SEARCH],
  ['national rental', NATIONAL_RENTAL_ADVICE],
  ...Object.entries(BRANCH_RENTAL_ADVICE),
  ...Object.entries(SERVICE_RENTAL_ADVICE),
] as const;

describe('search titles and descriptions fit the result snippet', () => {
  for (const [name, copy] of entries) {
    for (const locale of ['he', 'en'] as const) {
      it(`${name} (${locale})`, () => {
        expect(copy.title[locale].length).toBeLessThanOrEqual(62);
        expect(copy.title[locale]).toMatch(/SmartCar/);
        expect(copy.description[locale].length).toBeGreaterThanOrEqual(110);
        expect(copy.description[locale].length).toBeLessThanOrEqual(170);
      });
    }
  }
  for (const city of DELIVERY_CITIES) {
    for (const locale of ['he', 'en']) {
      it(`delivery ${city.slug} (${locale})`, () => {
        const { title, description } = deliverySearchCopy(city, locale);
        expect(title.length).toBeLessThanOrEqual(65);
        expect(description.length).toBeLessThanOrEqual(175);
      });
    }
  }
});
