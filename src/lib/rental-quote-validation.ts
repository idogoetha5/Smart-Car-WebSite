import type { RentalQuoteData } from '@/lib/rental-quote';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export function validRentalQuoteData(value: unknown): value is RentalQuoteData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RentalQuoteData>;

  return Boolean(
    data.quoteNumber?.trim() &&
      data.quoteNumber.length <= 40 &&
      data.customerName?.trim() &&
      data.customerName.length <= 160 &&
      data.customerPhone?.trim() &&
      data.customerPhone.length <= 30 &&
      data.pickupDate &&
      DATE_PATTERN.test(data.pickupDate) &&
      data.returnDate &&
      DATE_PATTERN.test(data.returnDate) &&
      data.returnDate >= data.pickupDate &&
      data.pickupTime &&
      TIME_PATTERN.test(data.pickupTime) &&
      data.returnTime &&
      TIME_PATTERN.test(data.returnTime) &&
      data.pickupLocation?.trim() &&
      data.pickupLocation.length <= 240 &&
      data.returnLocation?.trim() &&
      data.returnLocation.length <= 240 &&
      (data.locale === 'he' || data.locale === 'en') &&
      (data.documentMode === 'quote' || data.documentMode === 'confirmation') &&
      (data.vatMode === 'included' ||
        data.vatMode === 'excluded' ||
        data.vatMode === 'not_applicable') &&
      Array.isArray(data.vehicles) &&
      data.vehicles.length >= 1 &&
      data.vehicles.length <= 4 &&
      data.vehicles.some((vehicle) => vehicle?.name?.trim()) &&
      Array.isArray(data.extras) &&
      data.extras.length <= 12 &&
      data.insuranceCoverage?.trim() &&
      data.insuranceCoverage.length <= 240
  );
}
