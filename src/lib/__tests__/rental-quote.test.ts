import { describe, expect, it } from 'vitest';
import { formatLocationForCustomer } from '@/lib/location-display';
import {
  calculateRentalDays,
  calculateRentalQuoteTotals,
  generateRentalQuoteHTML,
  normalizeWhatsAppPhone,
  type RentalQuoteData,
} from '@/lib/rental-quote';

const quote: RentalQuoteData = {
  quoteNumber: 'R123456',
  date: '2026-07-29',
  validUntil: '2026-08-05',
  locale: 'he',
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
  deposit: '₪2,000',
  deductible: 'לפי הכיסוי הביטוחי שנבחר',
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
