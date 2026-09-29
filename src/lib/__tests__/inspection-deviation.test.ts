import { describe, expect, it } from 'vitest';
import { calculateInspectionDeviation, mileageAllowanceKm } from '../inspection-deviation';

describe('mileageAllowanceKm', () => {
  it('uses the published allowance tiers', () => {
    expect(mileageAllowanceKm(1)).toBe(200);
    expect(mileageAllowanceKm(7)).toBe(1400);
    expect(mileageAllowanceKm(8)).toBe(1760);
    expect(mileageAllowanceKm(30)).toBe(6600);
    expect(mileageAllowanceKm(31)).toBe(5000);
  });
});

describe('calculateInspectionDeviation', () => {
  it('reports no deviation when return mileage and fuel are within the pickup baseline', () => {
    const result = calculateInspectionDeviation(
      { odometerKm: 10_000, fuelEighths: 8 },
      { odometerKm: 10_150, fuelEighths: 8 },
      1
    );

    expect(result.hasDeviation).toBe(false);
    expect(result.distanceKm).toBe(150);
    expect(result.warnings).toEqual([]);
  });

  it('flags mileage above the booking allowance and missing fuel', () => {
    const result = calculateInspectionDeviation(
      { odometerKm: 10_000, fuelEighths: 8 },
      { odometerKm: 10_275, fuelEighths: 4 },
      1
    );

    expect(result.hasDeviation).toBe(true);
    expect(result.excessKm).toBe(75);
    expect(result.fuelMissingEighths).toBe(4);
    expect(result.warnings).toHaveLength(2);
  });

  it('flags an odometer rollback', () => {
    const result = calculateInspectionDeviation(
      { odometerKm: 10_000, fuelEighths: 6 },
      { odometerKm: 9_950, fuelEighths: 6 },
      2
    );

    expect(result.hasDeviation).toBe(true);
    expect(result.warnings[0]).toContain('נמוכה');
  });

  it('does not invent a deviation when no signed pickup baseline exists', () => {
    const result = calculateInspectionDeviation(null, { odometerKm: 5_000, fuelEighths: 2 }, 1);
    expect(result.hasDeviation).toBe(false);
    expect(result.distanceKm).toBeNull();
  });
});
