import { describe, it, expect } from 'vitest';
import { bookingRequestSchema, BOOKING_EXTRAS } from '../validations';

/**
 * These run against the schema the route actually imports. The point of the
 * change under test is that `POST /api/bookings` stopped reading raw body
 * fields, so a test that re-declared its own shape would prove nothing.
 */

/** The smallest payload a genuine booking sends. */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: 'c10c8e31714c6435c801d2ca80bc11c64',
    customerName: 'ישראל ישראלי',
    customerEmail: 'customer@example.com',
    customerPhone: '+972501234567',
    pickupDate: '2026-09-01',
    dropoffDate: '2026-09-03',
    pickupLocation: 'הרצליה',
    dropoffLocation: 'הרצליה',
    agreeTerms: true as const,
    ...overrides,
  };
}

describe('bookingRequestSchema', () => {
  it('accepts what the booking form actually posts', () => {
    // Mirrors the real submit body, including the fields the server
    // deliberately ignores — those must not be rejected.
    const result = bookingRequestSchema.safeParse(
      validPayload({
        customerIdNumber: '123456789',
        notes: 'נא להתקשר לפני האיסוף',
        marketingConsent: true,
        extras: ['baby_seat', 'insurance'],
        additionalDriverName: undefined,
        locale: 'he',
        pickup_time: '09:00',
        return_time: '10:30',
        manualMatchRequired: false,
        attribution: { utm_source: 'google', gclid: 'abc123' },
        totalPrice: 620,
        pricePerDay: 290,
        turnstileToken: 'x'.repeat(300),
      }),
    );
    expect(result.success).toBe(true);
  });

  describe('fields that used to bypass validation entirely', () => {
    it('rejects an add-on the server cannot price', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ extras: ['baby_seat', 'free_upgrade'] }),
      );
      expect(result.success).toBe(false);
    });

    it('keeps every add-on the pricing table knows', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ extras: [...BOOKING_EXTRAS] }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects a locale outside the two the site has consent text for', () => {
      // A bogus locale used to reach termsConsent(), which decides which
      // wording gets hashed into the consent ledger.
      const result = bookingRequestSchema.safeParse(validPayload({ locale: 'ru' }));
      expect(result.success).toBe(false);
    });

    it('rejects a malformed pickup time', () => {
      const result = bookingRequestSchema.safeParse(validPayload({ pickup_time: '9am' }));
      expect(result.success).toBe(false);
    });

    it('rejects a non-boolean manual-match flag', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ manualMatchRequired: 'yes' }),
      );
      expect(result.success).toBe(false);
    });

    it('caps the length of an additional driver name', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ additionalDriverName: 'a'.repeat(101) }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe('strictness', () => {
    it('rejects a key nobody declared', () => {
      // The mass-assignment guard: an attacker adding a column name to the
      // payload must not get a request that merely ignores it.
      const result = bookingRequestSchema.safeParse(
        validPayload({ status: 'CONFIRMED' }),
      );
      expect(result.success).toBe(false);
    });

    it('still lets the honeypot field through so the route can catch it', () => {
      const result = bookingRequestSchema.safeParse(validPayload({ _website: '' }));
      expect(result.success).toBe(true);
    });

    it('drops nothing it accepted — parsed data carries the add-ons', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ extras: ['driver'], additionalDriverName: 'דנה כהן' }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extras).toEqual(['driver']);
        expect(result.data.additionalDriverName).toBe('דנה כהן');
      }
    });
  });

  describe('rules that were already enforced stay enforced', () => {
    it('requires the terms checkbox', () => {
      const result = bookingRequestSchema.safeParse(validPayload({ agreeTerms: false }));
      expect(result.success).toBe(false);
    });

    it('requires drop-off after pickup', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ pickupDate: '2026-09-05', dropoffDate: '2026-09-02' }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects an unparseable phone number', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ customerPhone: '12345' }),
      );
      expect(result.success).toBe(false);
    });

    it('accepts a real overseas number, since tourists book from abroad', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ customerPhone: '+13107753347' }),
      );
      expect(result.success).toBe(true);
    });

    it('caps free-text notes rather than accepting an unbounded body', () => {
      const result = bookingRequestSchema.safeParse(
        validPayload({ notes: 'x'.repeat(2001) }),
      );
      expect(result.success).toBe(false);
    });
  });
});
