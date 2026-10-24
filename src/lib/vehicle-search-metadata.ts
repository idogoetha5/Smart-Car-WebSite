import type { Metadata } from 'next';
import type { Vehicle } from '@/types';
import { localeAlternates } from '@/lib/seo';

/** Model-level facts only: no inferred equipment, live availability or prices. */
export function vehicleSearchMetadata(vehicle: Vehicle, locale: string, canonicalId = vehicle.id): Metadata {
  if (!vehicle.make?.trim() || !vehicle.model?.trim()) return {};
  const isHe = locale === 'he';
  const name = `${vehicle.make} ${vehicle.model}`;
  const title = isHe ? `${name} להשכרה בישראל | SmartCar` : `${name} Rental in Israel | SmartCar`;
  const gearbox = vehicle.transmission === 'AUTOMATIC' ? (isHe ? 'גיר אוטומטי' : 'automatic transmission') : vehicle.transmission === 'MANUAL' ? (isHe ? 'גיר ידני' : 'manual transmission') : '';
  const seats = Number.isInteger(vehicle.seats) && vehicle.seats > 0 ? `${vehicle.seats} ${isHe ? 'מושבים' : 'seats'}` : '';
  const specifications = [seats, gearbox].filter(Boolean).join(', ');
  const intro = `${name}${isHe ? ' להשכרה ב-SmartCar' : ' rental with SmartCar'}${specifications ? `: ${specifications}` : ''}.`;
  const description = isHe
    ? `${intro} צפו בתמונות ובפרטי הרכב ושלחו בקשה לפי תאריכים ומיקום. זמינות, מחיר ותנאים באישור נציג.`
    : `${intro} View photos and vehicle details, then request dates and locations. Availability, price and terms require confirmation.`;
  const image = vehicle.imageUrls?.[0];
  return {
    title: { absolute: title },
    description,
    alternates: localeAlternates(locale, `rental/${canonicalId}`),
    openGraph: { title, description, url: `/${locale}/rental/${canonicalId}`, siteName: 'SmartCar', locale: isHe ? 'he_IL' : 'en_US', type: 'website', ...(image ? { images: [{ url: image, alt: name }] } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
  };
}
