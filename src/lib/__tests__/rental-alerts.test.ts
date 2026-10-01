import { describe, expect, it } from 'vitest';
import type { DamageMark } from '../inspection-damage';
import { newDamageMarks, rentalDaysBetween } from '../rental-alerts';
import { mileageAllowanceKm } from '../inspection-deviation';

function mark(overrides: Partial<DamageMark> = {}): DamageMark {
  return { n: 1, view: 'front', x: 0.4, y: 0.5, kind: 'scratch', note: '', ...overrides };
}

describe('newDamageMarks', () => {
  it('does not report the same pickup damage again when the return tap moved slightly', () => {
    expect(newDamageMarks([mark()], [mark({ n: 2, x: 0.43, y: 0.52 })])).toEqual([]);
  });

  it('reports damage that only appears in the return', () => {
    const returned = mark({ n: 2, view: 'rear', kind: 'dent' });
    expect(newDamageMarks([mark()], [returned])).toEqual([returned]);
  });

  it('keeps two distant damages on the same vehicle side separate', () => {
    const returned = mark({ n: 2, x: 0.75, y: 0.75 });
    expect(newDamageMarks([mark()], [returned])).toEqual([returned]);
  });
});

describe('rental duration and mileage tiers', () => {
  it('rounds a partial rental day up before applying the tier', () => {
    const days = rentalDaysBetween('2026-10-01T08:00:00Z', '2026-10-02T09:00:00Z', 1);
    expect(days).toBe(2);
    expect(mileageAllowanceKm(days)).toBe(400);
  });

  it('uses 220 km per day after day 7', () => {
    expect(mileageAllowanceKm(rentalDaysBetween(null, null, 8))).toBe(1760);
    expect(mileageAllowanceKm(rentalDaysBetween(null, null, 30))).toBe(6600);
  });

  it('uses 2,500 km for each started 30-day period above day 30', () => {
    expect(mileageAllowanceKm(rentalDaysBetween(null, null, 31))).toBe(5000);
  });
});
