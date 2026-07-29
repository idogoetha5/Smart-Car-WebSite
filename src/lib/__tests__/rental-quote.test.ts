import { describe, expect, it } from 'vitest';
import { formatLocationForCustomer } from '@/lib/location-display';
import {
  calculateRentalDays,
  calculateRentalQuoteTotals,
  generateRentalQuoteHTML,
  normalizeWhatsAppPhone,
  type RentalQuoteData,
} from '@/lib/rental-quote';
import { validRentalQuoteData } from '@/lib/rental-quote-validation';

const quote: RentalQuoteData = {
  quoteNumber: 'R123456',
  date: '2026-07-29',
  validUntil: '2026-08-05',
  locale: 'he',
  documentMode: 'quote',
  customerName: 'עידו גויטע',
  customerPhone: '050-123-4567',
  customerEmail: '',
  pickupDate: '2026-08-01',
  returnDate: '2026-08-04',
  pickupTime: '09:00',
  returnTime: '09:00',
  pickupLocation: 'הרצליה',
  returnLocation: 'תל אביב',
  vehicles: [
    {
      name: 'Toyota Aygo X',
      year: '2026',
      category: 'Mini',
      imageUrl: 'https://example.com/car.png',
      dailyPrice: 200,
      quantity: 2,
    },
  ],
  extras: [
    {
      id: 'driver',
      labelHe: 'נהג נוסף',
      labelEn: 'Additional driver',
      price: 25,
      billing: 'day',
      quantity: 1,
      selected: true,
    },
    {
      id: 'delivery',
      labelHe: 'מסירה',
      labelEn: 'Delivery',
      price: 100,
      billing: 'flat',
      quantity: 1,
      selected: true,
    },
  ],
  deliveryFee: 50,
  discount: 25,
  vatMode: 'excluded',
  mileageAllowance: '250 ק״מ ליום',
  insuranceCoverage: 'כיסוי ביטוחי מורחב',
  deposit: '₪2,000',
  deductible: '₪1,500',
  fuelPolicy: 'מלא־מלא',
  notes: 'נשמח לעמוד לרשותכם.',
};

describe('rental quotation calculations', () => {
  it('counts rental days and never returns less than one day', () => {
    expect(calculateRentalDays('2026-08-01', '2026-08-04')).toBe(3);
    expect(calculateRentalDays('2026-08-01', '2026-08-01')).toBe(1);
  });

  it('calculates vehicles, daily extras, flat extras, discount and VAT', () => {
    expect(calculateRentalQuoteTotals(quote)).toEqual({
      days: 3,
      vehicles: 1_200,
      extras: 175,
      subtotal: 1_400,
      vat: 252,
      total: 1_652,
    });
  });

  it('does not add VAT when the price already includes it', () => {
    const totals = calculateRentalQuoteTotals({
      ...quote,
      vatMode: 'included',
    });
    expect(totals.vat).toBe(0);
    expect(totals.total).toBe(1_400);
  });
});

describe('rental quotation customer delivery', () => {
  it('normalizes Israeli WhatsApp numbers', () => {
    expect(normalizeWhatsAppPhone('050-123-4567')).toBe('972501234567');
    expect(normalizeWhatsAppPhone('+972 50 123 4567')).toBe('972501234567');
    expect(normalizeWhatsAppPhone('123')).toBeNull();
  });

  it('capitalizes branch IDs and free-form English city names', () => {
    expect(formatLocationForCustomer('herzliya')).toBe('Herzliya');
    expect(formatLocationForCustomer('tel aviv airport')).toBe(
      'Tel Aviv Airport'
    );
  });

  it('renders the requested vehicle, logo and safely escapes customer text', () => {
    const html = generateRentalQuoteHTML({
      ...quote,
      customerName: '<script>alert(1)</script>',
    });
    expect(html).toContain('Toyota Aygo X');
    expect(html).toContain('SmartCar');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders a complete matching English quotation', () => {
    const html = generateRentalQuoteHTML({ ...quote, locale: 'en' });
    expect(html).toContain('Car Rental Quotation');
    expect(html).toContain('Pick-up');
    expect(html).toContain('Thank you for choosing SmartCar');
  });
});

describe('rental quotation insurance coverage', () => {
  it('prints the exact coverage the representative chose, in both languages', () => {
    const hebrew = generateRentalQuoteHTML({
      ...quote,
      insuranceCoverage: 'ביטול השתתפות עצמית',
    });
    expect(hebrew).toContain('כיסוי ביטוחי');
    expect(hebrew).toContain('ביטול השתתפות עצמית');

    const english = generateRentalQuoteHTML({
      ...quote,
      locale: 'en',
      insuranceCoverage: 'Deductible waiver',
    });
    expect(english).toContain('Insurance coverage');
    expect(english).toContain('Deductible waiver');
  });

  it('keeps free-form coverage text and escapes it', () => {
    const html = generateRentalQuoteHTML({
      ...quote,
      insuranceCoverage: 'מורחב + <נהג צעיר>',
    });
    expect(html).toContain('מורחב + &lt;נהג צעיר&gt;');
  });

  it('shows a dash rather than a vague default when the deductible is empty', () => {
    const html = generateRentalQuoteHTML({ ...quote, deductible: '' });
    expect(html).toContain('השתתפות עצמית');
    expect(html).not.toContain('לפי הכיסוי הביטוחי שנבחר');
  });
});

describe('rental quotation request validation', () => {
  it('accepts a complete quotation and a complete confirmation', () => {
    expect(validRentalQuoteData(quote)).toBe(true);
    expect(
      validRentalQuoteData({ ...quote, documentMode: 'confirmation' })
    ).toBe(true);
  });

  it('rejects a request with no insurance coverage', () => {
    expect(validRentalQuoteData({ ...quote, insuranceCoverage: '' })).toBe(false);
    expect(validRentalQuoteData({ ...quote, insuranceCoverage: '   ' })).toBe(false);
    expect(
      validRentalQuoteData({ ...quote, insuranceCoverage: 'x'.repeat(241) })
    ).toBe(false);
  });

  it('rejects an unknown document mode', () => {
    expect(validRentalQuoteData({ ...quote, documentMode: 'invoice' })).toBe(false);
    const withoutMode: Record<string, unknown> = { ...quote };
    delete withoutMode.documentMode;
    expect(validRentalQuoteData(withoutMode)).toBe(false);
  });
});

describe('rental document mode', () => {
  it('renders a quotation with the not-a-booking disclaimer', () => {
    const hebrew = generateRentalQuoteHTML({ ...quote, documentMode: 'quote' });
    expect(hebrew).toContain('הצעת מחיר להשכרת רכב');
    expect(hebrew).toContain('אינה מהווה אישור הזמנה');
    expect(hebrew).not.toContain('אישור הזמנה וסיכום עסקה');

    const english = generateRentalQuoteHTML({
      ...quote,
      locale: 'en',
      documentMode: 'quote',
    });
    expect(english).toContain('Car Rental Quotation');
    expect(english).toContain('not a booking confirmation');
  });

  it('renders a booking confirmation without any quotation disclaimer', () => {
    const hebrew = generateRentalQuoteHTML({
      ...quote,
      documentMode: 'confirmation',
    });
    expect(hebrew).toContain('אישור הזמנה וסיכום עסקה');
    expect(hebrew).toContain(
      'מסמך זה מסכם את פרטי ההזמנה שאושרו מול נציג SmartCar.'
    );
    expect(hebrew).not.toContain('אינה מהווה אישור הזמנה');
    expect(hebrew).not.toContain('הצעת מחיר להשכרת רכב');

    const english = generateRentalQuoteHTML({
      ...quote,
      locale: 'en',
      documentMode: 'confirmation',
    });
    expect(english).toContain('Booking Confirmation and Deal Summary');
    expect(english).toContain(
      'This document summarizes the booking details approved with a SmartCar representative.'
    );
    expect(english).not.toContain('not a booking confirmation');
    expect(english).not.toContain('Car Rental Quotation');
  });

  it('keeps the same prices and vehicles in both modes', () => {
    const asQuote = calculateRentalQuoteTotals({
      ...quote,
      documentMode: 'quote',
    });
    const asConfirmation = calculateRentalQuoteTotals({
      ...quote,
      documentMode: 'confirmation',
    });
    expect(asConfirmation).toEqual(asQuote);
    expect(
      generateRentalQuoteHTML({ ...quote, documentMode: 'confirmation' })
    ).toContain('Toyota Aygo X');
  });
});
