import { describe, expect, it } from 'vitest';
import {
  resolveSeason,
  getSeasonalPrice,
  getSeasonalPriceRange,
  type PricingConfig,
  type PricingSeason,
} from '@/lib/seasonal';

const summer: PricingSeason = {
  id: 'season-summer', nameHe: 'קיץ', nameEn: 'Summer',
  startDate: '2000-07-01', endDate: '2000-08-31',
  recursAnnually: true, adjustmentPercent: 13, priority: 0, isActive: true,
};

const winter: PricingSeason = {
  id: 'season-winter', nameHe: 'חורף', nameEn: 'Winter',
  startDate: '2000-12-15', endDate: '2000-02-28',
  recursAnnually: true, adjustmentPercent: -10, priority: 0, isActive: true,
};

const passover2026: PricingSeason = {
  id: 'season-passover-2026', nameHe: 'פסח 2026', nameEn: 'Passover 2026',
  startDate: '2026-04-01', endDate: '2026-04-09',
  recursAnnually: false, adjustmentPercent: 13, priority: 0, isActive: true,
};

const inactiveSeason: PricingSeason = {
  ...summer, id: 'season-inactive', isActive: false,
};

const baseConfig: PricingConfig = { seasons: [summer, winter, passover2026], overrides: [] };

describe('resolveSeason', () => {
  it('matches a recurring season across the year wraparound (winter: Dec 15 -> Feb 28)', () => {
    expect(resolveSeason(new Date('2025-12-20'), [winter])?.id).toBe('season-winter');
    expect(resolveSeason(new Date('2026-01-15'), [winter])?.id).toBe('season-winter');
    expect(resolveSeason(new Date('2026-02-20'), [winter])?.id).toBe('season-winter');
  });

  it('does not match a recurring season outside its window', () => {
    expect(resolveSeason(new Date('2026-03-01'), [winter])).toBeNull();
    expect(resolveSeason(new Date('2025-12-14'), [winter])).toBeNull();
  });

  it('matches a recurring season regardless of year (summer repeats every year)', () => {
    expect(resolveSeason(new Date('2025-07-15'), [summer])?.id).toBe('season-summer');
    expect(resolveSeason(new Date('2027-08-31'), [summer])?.id).toBe('season-summer');
    expect(resolveSeason(new Date('2026-09-01'), [summer])).toBeNull();
  });

  it('matches a one-off season only on its exact dates', () => {
    expect(resolveSeason(new Date('2026-04-05'), [passover2026])?.id).toBe('season-passover-2026');
    expect(resolveSeason(new Date('2025-04-05'), [passover2026])).toBeNull();
    expect(resolveSeason(new Date('2027-04-05'), [passover2026])).toBeNull();
  });

  it('ignores inactive seasons', () => {
    expect(resolveSeason(new Date('2026-07-15'), [inactiveSeason])).toBeNull();
  });

  it('returns null when no season matches (regular pricing)', () => {
    expect(resolveSeason(new Date('2026-05-01'), baseConfig.seasons)).toBeNull();
  });

  it('on overlap, the highest priority wins', () => {
    const low: PricingSeason = { ...summer, id: 'low', priority: 0 };
    const high: PricingSeason = { ...summer, id: 'high', priority: 5 };
    expect(resolveSeason(new Date('2026-07-15'), [low, high])?.id).toBe('high');
  });

  it('on an equal-priority overlap, the non-recurring (more specific) season wins', () => {
    const recurring: PricingSeason = { ...summer, id: 'recurring', priority: 0 };
    const oneOff: PricingSeason = {
      id: 'one-off', nameHe: 'מבצע קיץ', nameEn: 'Summer special',
      startDate: '2026-07-10', endDate: '2026-07-20',
      recursAnnually: false, adjustmentPercent: 25, priority: 0, isActive: true,
    };
    expect(resolveSeason(new Date('2026-07-15'), [recurring, oneOff])?.id).toBe('one-off');
  });
});

describe('getSeasonalPrice', () => {
  const vehicle = { id: 'v1', pricePerDay: 200 };

  it('falls back to the base price when no season matches', () => {
    expect(getSeasonalPrice(vehicle, baseConfig, new Date('2026-05-01'))).toBe(200);
  });

  it('applies the season default percent, rounded to the nearest ₪10', () => {
    // 200 * 1.13 = 226 -> rounds to 230
    expect(getSeasonalPrice(vehicle, baseConfig, new Date('2026-07-15'))).toBe(230);
    // 200 * 0.9 = 180 (already a multiple of 10)
    expect(getSeasonalPrice(vehicle, baseConfig, new Date('2026-01-10'))).toBe(180);
  });

  it('a vehicle fixed-price override wins outright, used verbatim', () => {
    const config: PricingConfig = {
      seasons: [summer],
      overrides: [{ id: 'o1', vehicleId: 'v1', seasonId: 'season-summer', fixedPrice: 777, adjustmentPercent: null }],
    };
    expect(getSeasonalPrice(vehicle, config, new Date('2026-07-15'))).toBe(777);
  });

  it("a vehicle percent override replaces the season's default percent", () => {
    const config: PricingConfig = {
      seasons: [summer],
      overrides: [{ id: 'o1', vehicleId: 'v1', seasonId: 'season-summer', fixedPrice: null, adjustmentPercent: 50 }],
    };
    // 200 * 1.5 = 300
    expect(getSeasonalPrice(vehicle, config, new Date('2026-07-15'))).toBe(300);
  });

  it("an override for a different vehicle does not apply", () => {
    const config: PricingConfig = {
      seasons: [summer],
      overrides: [{ id: 'o1', vehicleId: 'other-vehicle', seasonId: 'season-summer', fixedPrice: 777, adjustmentPercent: null }],
    };
    expect(getSeasonalPrice(vehicle, config, new Date('2026-07-15'))).toBe(230);
  });
});

describe('getSeasonalPriceRange', () => {
  const vehicle = { id: 'v1', pricePerDay: 200 };

  it('prices each day at its own season rate across a boundary crossing', () => {
    // June 29 (regular, 200) + June 30 (regular, 200) + July 1 (summer, 230)
    const result = getSeasonalPriceRange(vehicle, baseConfig, new Date('2026-06-29'), new Date('2026-07-02'));
    expect(result.days).toBe(3);
    expect(result.subtotal).toBe(200 + 200 + 230);
    expect(result.sameSeasonThroughout).toBe(false);
  });

  it('reports sameSeasonThroughout true when the whole range stays in one (or no) season', () => {
    const result = getSeasonalPriceRange(vehicle, baseConfig, new Date('2026-05-01'), new Date('2026-05-05'));
    expect(result.sameSeasonThroughout).toBe(true);
    expect(result.subtotal).toBe(200 * 4);
  });
});
