import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Vehicle } from '@/types';
import { canonicalVehicles, preferredVehicleId } from '@/lib/vehicle-canonical';
import { vehicleSearchMetadata } from '@/lib/vehicle-search-metadata';

const state = vi.hoisted(() => ({ fleet: vi.fn() }));
vi.mock('@/lib/rental-page-data', () => ({ getRentalPageVehicles: state.fleet }));
import sitemap from '@/app/sitemap';

const original: Vehicle = {
  id: 'original', make: 'BMW', model: 'X2', year: 2026, category: 'LUXURY',
  transmission: 'AUTOMATIC', fuelType: 'GASOLINE', seats: 5, doors: 4,
  pricePerDay: 1060, displayPricePerDay: 850, minimumDailyPrice: 950,
  pricePerMonth: 0, depositAmount: 1000, mileageLimit: 200,
  imageUrls: ['/front.webp', '/rear.webp'], features: ['Panoramic roof'],
  descriptionHe: 'תיאור', descriptionEn: 'Description', totalUnits: 1,
  isAvailable: true, isFeatured: false, createdAt: '2026-01-01', updatedAt: '2026-10-24',
};
const duplicate: Vehicle = { ...original, id: 'duplicate', colorHe: 'אפור', colorEn: 'Gray', createdAt: '2026-02-01' };

beforeEach(() => state.fleet.mockReset().mockResolvedValue([duplicate, original]));

describe('conservative public model canonical URLs', () => {
  it('selects the same existing oldest URL regardless of query order without mutating records', () => {
    const before = JSON.stringify([duplicate, original]);
    expect(preferredVehicleId(duplicate, [duplicate, original])).toBe(original.id);
    expect(preferredVehicleId(original, [original, duplicate])).toBe(original.id);
    expect(canonicalVehicles([duplicate, original])).toEqual([original]);
    expect(JSON.stringify([duplicate, original])).toBe(before);
  });
  it('breaks creation-date ties deterministically', () => {
    const sameDate = { ...duplicate, createdAt: original.createdAt };
    expect(preferredVehicleId(sameDate, [sameDate, original])).toBe(original.id);
    expect(preferredVehicleId(sameDate, [original, sameDate])).toBe(original.id);
  });
  it.each([
    ['year', 2025], ['category', 'SUV'], ['seats', 7], ['doors', 5],
    ['transmission', 'MANUAL'], ['fuelType', 'HYBRID'], ['pricePerDay', 1100],
    ['displayPricePerDay', 900], ['minimumDailyPrice', 1000], ['pricePerMonth', 9000],
    ['depositAmount', 2000], ['mileageLimit', 150], ['imageUrls', ['/different.webp']],
    ['features', ['Different equipment']], ['descriptionHe', 'אחר'],
    ['descriptionEn', 'Different'], ['totalUnits', 2], ['isAvailable', false],
  ] as [keyof Vehicle, unknown][] )('keeps a different %s independent', (field, value) => {
    const changed = { ...duplicate, [field]: value } as Vehicle;
    expect(preferredVehicleId(changed, [original, changed])).toBe(changed.id);
    expect(canonicalVehicles([original, changed])).toHaveLength(2);
  });
  it('fails safely to self when inventory is missing or stale', () => {
    expect(preferredVehicleId(duplicate, [])).toBe(duplicate.id);
    expect(preferredVehicleId(duplicate, [original])).toBe(duplicate.id);
    expect(preferredVehicleId({ ...duplicate, pricePerDay: 2000 }, [duplicate, original])).toBe(duplicate.id);
  });
  it.each(['he', 'en'])('aligns %s canonical, same-language alternates and share URL', locale => {
    const result = vehicleSearchMetadata(duplicate, locale, preferredVehicleId(duplicate, [original, duplicate]));
    expect(result.alternates).toEqual({ canonical: `/${locale}/rental/original`, languages: {
      he: '/he/rental/original', en: '/en/rental/original', 'x-default': '/he/rental/original',
    } });
    expect(result.openGraph).toMatchObject({ url: `/${locale}/rental/original` });
    expect(duplicate.id).toBe('duplicate');
    expect(duplicate.minimumDailyPrice).toBe(950);
  });
  it('lists both languages of preferred pages only, retaining distinct offers', async () => {
    const different = { ...duplicate, id: 'different-price', pricePerDay: 2000 };
    state.fleet.mockResolvedValue([duplicate, original, different]);
    const routes = await sitemap();
    const rental = routes.filter(route => /\/rental\//.test(route.url));
    expect(rental).toHaveLength(4);
    expect(rental.some(route => route.url.endsWith('/duplicate'))).toBe(false);
    expect(rental.filter(route => route.url.endsWith('/original'))).toHaveLength(2);
    expect(rental.filter(route => route.url.endsWith('/different-price'))).toHaveLength(2);
  });
});
