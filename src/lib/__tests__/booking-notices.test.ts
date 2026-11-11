import { describe, it, expect } from 'vitest';
import { getBookingNotices, isShabbat } from '../booking-notices';

describe('booking notices', () => {
  it('detects Saturday dates', () => {
    expect(isShabbat('2026-11-14')).toBe(true);
    expect(isShabbat('2026-11-13')).toBe(false);
    expect(isShabbat('')).toBe(false);
  });
  it('warns when the return date is on Shabbat', () => {
    const n = getBookingNotices({ isHe: true, pickupDate: '2026-11-11', returnDate: '2026-11-14' });
    expect(n).toHaveLength(1);
    expect(n[0]).toContain('תאריך ההחזרה חל בשבת');
  });
  it('shows the 150 airport surcharge only for the airport', () => {
    expect(getBookingNotices({ isHe: true, pickupLocation: 'telaviv', returnLocation: 'herzliya' })).toHaveLength(0);
    const n = getBookingNotices({ isHe: false, pickupLocation: 'telaviv', returnLocation: 'airport' });
    expect(n[0]).toContain('₪150');
  });
});
