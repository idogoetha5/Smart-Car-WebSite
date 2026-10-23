import type { Vehicle } from '@/types';
import { vehicleSearchMetadata } from '@/lib/vehicle-search-metadata';

/** Describe the advertised rental, not an outright car sale or a booking quote. */
export function vehicleRentalSchema(vehicle: Vehicle, locale: string, baseUrl: string) {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const editorial = locale === 'he' ? vehicle.descriptionHe : vehicle.descriptionEn;
  const description = editorial?.trim() || vehicleSearchMetadata(vehicle, locale).description || name;
  // Same display-price precedence as VehicleCard. Never feed this promotional
  // value into the booking calculator: its separate floor/season rules remain.
  const advertisedPrice = vehicle.displayPricePerDay ?? vehicle.pricePerDay;
  const hasPrice = Number.isFinite(advertisedPrice) && advertisedPrice > 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: vehicle.imageUrls?.[0] ?? undefined,
    brand: { '@type': 'Brand', name: vehicle.make },
    offers: {
      '@type': 'Offer',
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      ...(hasPrice ? {
        price: advertisedPrice,
        priceCurrency: 'ILS',
        priceSpecification: { '@type': 'UnitPriceSpecification', price: advertisedPrice, priceCurrency: 'ILS', unitText: 'DAY' },
      } : {}),
      url: new URL(`/${locale}/rental/${vehicle.id}`, baseUrl).href,
      seller: { '@type': 'AutoRental', name: 'SmartCar' },
    },
  };
}

/** JSON embedded in an HTML script must not allow a description to close it. */
export function rentalSchemaJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
