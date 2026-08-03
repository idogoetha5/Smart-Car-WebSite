import type { Vehicle } from '@/types';

export interface PricingSeason {
  id: string;
  nameHe: string;
  nameEn: string;
  /** ISO 'YYYY-MM-DD'. When recursAnnually, only the month/day portion is read — the year is a placeholder. */
  startDate: string;
  endDate: string;
  recursAnnually: boolean;
  /** Default % applied fleet-wide in this season, e.g. 13 or -10. */
  adjustmentPercent: number;
  /**
   * Optional fleet-wide fixed price/day, an alternative to adjustmentPercent.
   * When set, it wins over adjustmentPercent for any vehicle with no
   * per-vehicle override in this season — see priceForSeason(). Null on
   * every season created before this field existed, so old seasons keep
   * using adjustmentPercent exactly as before.
   */
  fixedPrice: number | null;
  /** Highest wins when two seasons' ranges overlap on the same date. */
  priority: number;
  isActive: boolean;
}

export interface VehiclePriceOverride {
  id: string;
  vehicleId: string;
  seasonId: string;
  /** Exactly one of fixedPrice/adjustmentPercent is set. */
  fixedPrice: number | null;
  adjustmentPercent: number | null;
}

export interface PricingConfig {
  seasons: PricingSeason[];
  overrides: VehiclePriceOverride[];
}

function monthDay(dateStr: string): number {
  // 'YYYY-MM-DD' -> MMDD as a number, so wraparound compares cleanly.
  const [, m, d] = dateStr.split('-');
  return Number(m) * 100 + Number(d);
}

function matchesDate(season: PricingSeason, dateStr: string): boolean {
  if (season.recursAnnually) {
    const md = monthDay(dateStr);
    const start = monthDay(season.startDate);
    const end = monthDay(season.endDate);
    // Wraps New Year's, e.g. Dec 15 -> Feb 28 (start > end).
    if (start > end) return md >= start || md <= end;
    return md >= start && md <= end;
  }
  return dateStr >= season.startDate && dateStr <= season.endDate;
}

/**
 * On overlap, the highest priority wins; ties prefer the more specific
 * (non-recurring, e.g. a one-off holiday) season over a recurring one.
 */
export function resolveSeason(date: Date, seasons: PricingSeason[]): PricingSeason | null {
  const dateStr = date.toISOString().split('T')[0];
  const candidates = seasons.filter(s => s.isActive && matchesDate(s, dateStr));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return Number(a.recursAnnually) - Number(b.recursAnnually);
  });
  return candidates[0];
}

/** Percent-based adjustments round to the nearest ₪10 — a clean sticker price, matching how explicit fixed prices are always chosen. */
function roundToTen(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * Resolution order once a season is known: (1) a per-vehicle override for
 * that season, fixed price or percent — either form fully replaces the
 * season default; (2) the season's own fleet-wide fixed price, if set;
 * (3) the season's fleet-wide percent; a season with neither an override
 * nor a fixed price behaves exactly as before this field existed.
 *
 * Exported (not just used inside getSeasonalPrice) so the admin pricing UI
 * can show "what would this vehicle cost in season X" for a season that
 * isn't necessarily active today, without re-deriving it through a date.
 */
export function priceForSeason(
  vehicle: Pick<Vehicle, 'id' | 'pricePerDay'>,
  season: PricingSeason,
  overrides: VehiclePriceOverride[]
): number {
  const override = overrides.find(
    o => o.vehicleId === vehicle.id && o.seasonId === season.id
  );
  if (override?.fixedPrice != null) return override.fixedPrice;
  if (override?.adjustmentPercent != null) {
    return roundToTen(vehicle.pricePerDay * (1 + override.adjustmentPercent / 100));
  }
  if (season.fixedPrice != null) return season.fixedPrice;
  return roundToTen(vehicle.pricePerDay * (1 + season.adjustmentPercent / 100));
}

export function getSeasonalPrice(
  vehicle: Pick<Vehicle, 'id' | 'pricePerDay'>,
  config: PricingConfig,
  date?: Date
): number {
  const season = resolveSeason(date ?? new Date(), config.seasons);
  if (!season) return vehicle.pricePerDay;
  return priceForSeason(vehicle, season, config.overrides);
}

/**
 * Sums the correct per-day seasonal rate across the full rental range,
 * instead of pricing every day at the pickup date's season. A booking
 * that starts in June and ends in July must be charged the summer rate
 * for the July days, not the regular rate for the whole stay.
 */
export function getSeasonalPriceRange(
  vehicle: Pick<Vehicle, 'id' | 'pricePerDay'>,
  config: PricingConfig,
  pickupDate: Date,
  dropoffDate: Date
): { subtotal: number; days: number; avgPricePerDay: number; sameSeasonThroughout: boolean } {
  const days = Math.max(
    1,
    Math.ceil((dropoffDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  let subtotal = 0;
  let firstSeasonKey: string | null = null;
  let sameSeasonThroughout = true;

  for (let i = 0; i < days; i++) {
    const day = new Date(pickupDate);
    day.setDate(day.getDate() + i);
    const seasonKey = resolveSeason(day, config.seasons)?.id ?? 'regular';
    if (firstSeasonKey === null) firstSeasonKey = seasonKey;
    else if (seasonKey !== firstSeasonKey) sameSeasonThroughout = false;
    subtotal += getSeasonalPrice(vehicle, config, day);
  }

  return { subtotal, days, avgPricePerDay: Math.round(subtotal / days), sameSeasonThroughout };
}
