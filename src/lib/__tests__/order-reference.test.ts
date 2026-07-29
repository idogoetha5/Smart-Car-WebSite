import { describe, expect, it } from 'vitest';
import { numericOrderReference } from '@/lib/order-reference';

const BOOKING_ID = 'c6dba9b9-79b1-4552-96fd-65989f69c0f5';

describe('numericOrderReference', () => {
  it('returns a stable six-digit reference for UUID-style IDs', () => {
    const reference = numericOrderReference(BOOKING_ID);

    expect(reference).toMatch(/^\d{6}$/);
    expect(numericOrderReference(BOOKING_ID)).toBe(reference);
  });

  it('never emits letters, dashes or short values', () => {
    const ids = [
      BOOKING_ID,
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      '1',
      '',
      'AB12',
    ];

    for (const id of ids) {
      expect(numericOrderReference(id)).toMatch(/^\d{6}$/);
    }
  });

  it('gives one booking the same number across every email and payment link', () => {
    // The request email formats the id straight from the API response, the
    // confirmation and cancellation routes from the database row.
    expect(numericOrderReference(BOOKING_ID.toUpperCase())).toBe(
      numericOrderReference(BOOKING_ID)
    );
    expect(numericOrderReference(` ${BOOKING_ID} `)).toBe(
      numericOrderReference(BOOKING_ID)
    );
  });

  it('returns different references for different bookings', () => {
    expect(numericOrderReference('booking-a')).not.toBe(
      numericOrderReference('booking-b')
    );
  });
});
