import type { Metadata } from 'next';
import type { Vehicle } from '@/types';
import { localeAlternates } from '@/lib/seo';

/**
 * Short vehicle-type label for search titles/descriptions. Model-level facts
 * only: no inferred equipment, live availability or prices.
 */
function vehicleType(vehicle: Vehicle, isHe: boolean): string {
  const seats = Number.isInteger(vehicle.seats) ? vehicle.seats : 0;
  const he: Record<string, string> = {
    MINI: 'רכב מיני', ECONOMY: 'רכב קטן', COMPACT: 'רכב קטן', ECONOMY_COMPACT: 'רכב קטן', SEDAN: 'רכב סדאן',
    CROSSOVER: 'קרוסאובר', SUV: 'רכב SUV', LUXURY: 'רכב יוקרה', VAN: seats >= 7 ? `רכב ${seats} מקומות` : 'ואן',
    COMMERCIAL: 'רכב מסחרי', ELECTRIC: 'רכב חשמלי',
  };
  const en: Record<string, string> = {
    MINI: 'Mini Car', ECONOMY: 'Small Car', COMPACT: 'Small Car', ECONOMY_COMPACT: 'Small Car', SEDAN: 'Sedan',
    CROSSOVER: 'Crossover', SUV: 'SUV', LUXURY: 'Luxury Car', VAN: seats >= 7 ? `${seats}-Seater` : 'Van',
    COMMERCIAL: 'Commercial Vehicle', ELECTRIC: 'Electric Car',
  };
  const base = (isHe ? he : en)[vehicle.category as string] ?? '';
  if (!base) return '';
  if (vehicle.category !== 'ELECTRIC' && vehicle.fuelType === 'HYBRID') return isHe ? `${base} היברידי` : `Hybrid ${base}`;
  if (vehicle.category !== 'ELECTRIC' && vehicle.fuelType === 'ELECTRIC') return isHe ? `${base} חשמלי` : `Electric ${base}`;
  return base;
}

/** True when another listed model page shares this make/model but not its year. */
function needsYear(vehicle: Vehicle, fleet: readonly Vehicle[]): boolean {
  if (!vehicle.year) return false;
  const key = (v: Vehicle) => `${v.make} ${v.model}`.trim().toLowerCase();
  return fleet.some(other => other.id !== vehicle.id && other.isAvailable && key(other) === key(vehicle) && other.year && other.year !== vehicle.year);
}

export function vehicleSearchMetadata(vehicle: Vehicle, locale: string, canonicalId = vehicle.id, fleet: readonly Vehicle[] = []): Metadata {
  if (!vehicle.make?.trim() || !vehicle.model?.trim()) return {};
  const isHe = locale === 'he';
  const name = `${vehicle.make} ${vehicle.model}`;
  const titleName = needsYear(vehicle, fleet) ? `${name} ${vehicle.year}` : name;
  const type = vehicleType(vehicle, isHe);
  const title = isHe
    ? `${titleName} להשכרה${type ? ` – ${type}` : ''} | SmartCar`
    : `${titleName} Rental${type ? ` – ${type}` : ' in Israel'} | SmartCar`;
  const gearbox = vehicle.transmission === 'AUTOMATIC' ? (isHe ? 'גיר אוטומטי' : 'automatic transmission') : vehicle.transmission === 'MANUAL' ? (isHe ? 'גיר ידני' : 'manual transmission') : '';
  const seats = Number.isInteger(vehicle.seats) && vehicle.seats > 0 ? `${vehicle.seats} ${isHe ? 'מושבים' : 'seats'}` : '';
  const specifications = [type, seats, gearbox].filter(Boolean).join(', ');
  const intro = isHe
    ? `השכרת ${name} ב-SmartCar${specifications ? `: ${specifications}` : ''}.`
    : `${name} rental with SmartCar${specifications ? `: ${specifications}` : ''}.`;
  const description = isHe
    ? `${intro} ראו תמונות ומפרט, בחרו תאריכים ושלחו בקשה – איסוף מסניף או מסירה עד הבית בכל הארץ.`
    : `${intro} See photos and specs, pick your dates and send a request – collect from a branch or get it delivered anywhere in Israel.`;
  const image = vehicle.imageUrls?.[0];
  return {
    title: { absolute: title },
    description,
    alternates: localeAlternates(locale, `rental/${canonicalId}`),
    openGraph: { title, description, url: `/${locale}/rental/${canonicalId}`, siteName: 'SmartCar', locale: isHe ? 'he_IL' : 'en_US', type: 'website', ...(image ? { images: [{ url: image, alt: name }] } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
  };
}
