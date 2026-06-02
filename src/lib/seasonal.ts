import type { Vehicle } from '@/types';

export type Season = 'winter' | 'summer' | 'regular';

// Jewish holiday peak periods (summer pricing applies)
const PEAK_PERIODS: { start: string; end: string }[] = [
  { start: '2025-09-22', end: '2025-10-13' }, // Rosh Hashana → Sukkot
  { start: '2026-04-01', end: '2026-04-09' }, // Passover
  { start: '2026-05-21', end: '2026-05-23' }, // Shavuot
  { start: '2026-09-11', end: '2026-10-02' }, // Rosh Hashana → Sukkot
  { start: '2027-03-21', end: '2027-03-29' }, // Passover
  { start: '2027-05-09', end: '2027-05-11' }, // Shavuot
];

export function getSeason(date: Date = new Date()): Season {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = date.toISOString().split('T')[0];

  if (month === 7 || month === 8) return 'summer';

  if (PEAK_PERIODS.some(p => dateStr >= p.start && dateStr <= p.end)) return 'summer';

  if ((month === 12 && day >= 15) || month === 1 || month === 2) return 'winter';

  return 'regular';
}

// Explicit summer prices for listed vehicles. All others use the fallback: base × 1.13 rounded to ₪10.
const SUMMER_PRICES: Record<string, Record<string, number>> = {
  Kia:        { Picanto: 250, Stonic: 330, Seltos: 390, Sportage: 550, Sorento: 650, Carnival: 780 },
  Mazda:      { '2': 290, '3': 390 },
  Toyota:     { Yaris: 290, 'Yaris Cross': 390 },
  Mitsubishi: { 'Eclipse Cross': 550 },
  Nissan:     { Sentra: 390, Juke: 380 },
  Chery:      { FX: 360, 'Tiggo 4 Pro': 390, 'Tiggo 7': 490, 'Tiggo 8': 650 },
  BMW:        { X1: 850 },
  Mercedes:   { C180: 1150 },
  Chevrolet:  { Traverse: 750 },
  // Commercial & Electric (unchanged)
  Renault:    { Kangoo: 490 },
  Citroen:    { Berlingo: 390 },
  Fiat:       { Doblo: 490 },
  Ford:       { Transit: 570 },
  Hyundai:    { Ioniq: 360 },
  Seres:      { '3': 330 },
};

export function getSummerPrice(vehicle: Vehicle): number {
  const explicit = SUMMER_PRICES[vehicle.make]?.[vehicle.model];
  if (explicit) return explicit;
  // Fallback: 13% above regular, rounded to nearest 10
  return Math.round(vehicle.pricePerDay * 1.13 / 10) * 10;
}

export function getWinterPrice(vehicle: Vehicle): number {
  return Math.round(vehicle.pricePerDay * 0.9);
}

export function getSeasonalPrice(vehicle: Vehicle, date?: Date): number {
  const season = getSeason(date ?? new Date());
  if (season === 'summer') return getSummerPrice(vehicle);
  if (season === 'winter') return getWinterPrice(vehicle);
  return vehicle.pricePerDay;
}

export function getCurrentSeason(): Season {
  return getSeason(new Date());
}
