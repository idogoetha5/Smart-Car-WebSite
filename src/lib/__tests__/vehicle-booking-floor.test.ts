import { describe, expect, it } from 'vitest';
import { getSeasonalPrice, getSeasonalPriceRange, minimumRentalTotal, rentalDurationDiscount, cappedRentalCoupon, type PricingConfig, type PricingSeason } from '../seasonal';
import { mapRow } from '../db/vehicles';

const vehicle = { id: 'x2', pricePerDay: 1060, minimumDailyPrice: 950, displayPricePerDay: 850 };
const winter: PricingSeason = { id: 'winter', nameHe: 'חורף', nameEn: 'Winter', startDate: '2000-12-15', endDate: '2000-02-28', adjustmentPercent: -10, fixedPrice: null, priority: 0, isActive: true, recursAnnually: true };
const summer = { ...winter, id: 'summer', startDate: '2000-07-01', endDate: '2000-08-31', adjustmentPercent: 13 };
const config: PricingConfig = { seasons: [winter, summer], overrides: [] };

describe('separate vehicle display price and online rental floor', () => {
  it('maps both explicit public fields without changing the actual base', () => {
    expect(mapRow({ price_per_day: 1060, display_price_per_day: '850.00', minimum_daily_price: '950.00' })).toMatchObject({ pricePerDay: 1060, displayPricePerDay: 850, minimumDailyPrice: 950 });
    expect(mapRow({ price_per_day: 250 })).toMatchObject({ displayPricePerDay: null, minimumDailyPrice: null });
  });
  it('uses actual base and existing seasonal percentages, never the advertised price', () => {
    expect(getSeasonalPrice(vehicle, config, new Date('2030-01-10'))).toBe(950);
    expect(getSeasonalPrice(vehicle, config, new Date('2030-05-10'))).toBe(1060);
    expect(getSeasonalPrice(vehicle, config, new Date('2030-07-10'))).toBe(1200);
  });
  it('enforces the floor for low percentage/fixed season overrides and global prices', () => {
    expect(getSeasonalPrice(vehicle, { seasons: [{ ...winter, fixedPrice: 100 }], overrides: [] }, new Date('2030-01-10'))).toBe(950);
    for (const override of [{ fixedPrice: 100, adjustmentPercent: null }, { fixedPrice: null, adjustmentPercent: -99 }]) {
      expect(getSeasonalPrice(vehicle, { ...config, overrides: [{ id: 'o', vehicleId: 'x2', seasonId: 'winter', ...override }] }, new Date('2030-01-10'))).toBe(950);
    }
  });
  it('limits long-rental discounts for 14/30/60 days without changing ordinary vehicles', () => {
    for (const [days, pct] of [[14, 7], [30, 10], [60, 15]]) {
      const subtotal = days * 950;
      expect(rentalDurationDiscount(vehicle, subtotal, days, pct)).toBe(0);
      expect(rentalDurationDiscount({}, subtotal, days, pct)).toBe(Math.round(subtotal * pct / 100));
      expect(subtotal - rentalDurationDiscount(vehicle, subtotal, days, pct)).toBeGreaterThanOrEqual(minimumRentalTotal(vehicle, days));
    }
    expect(rentalDurationDiscount(vehicle, 1200 * 60, 60, 15)).toBe(10800);
  });
  it('prices each day of a mixed-season stay with the same floor', () => {
    expect(getSeasonalPriceRange(vehicle, config, new Date('2030-06-30'), new Date('2030-07-02')).subtotal).toBe(2260);
  });
  it('caps fixed/percentage coupon savings at the same minimum, leaving other vehicles alone', () => {
    expect(cappedRentalCoupon(vehicle, 28500, 30, 5000)).toBe(0);
    expect(cappedRentalCoupon(vehicle, 30000, 30, 5000)).toBe(1500);
    expect(cappedRentalCoupon({}, 30000, 30, 5000)).toBe(5000);
  });
});
