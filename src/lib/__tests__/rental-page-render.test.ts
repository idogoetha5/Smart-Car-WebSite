import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Vehicle } from '@/types';
import { rentalSearchCriteria } from '@/lib/rental-search';

const state = vi.hoisted(() => ({ locale: 'he', fetchFleet: vi.fn(), swr: vi.fn() }));
vi.mock('@/lib/rental-page-data', () => ({ getRentalPageVehicles: state.fetchFleet }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn(), getTranslations: async () => () => 'השכרת רכב' }));
vi.mock('next-intl', () => ({ useLocale: () => state.locale, useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/usePricingConfig', () => ({ usePricingConfig: () => ({ config: { seasons: [], overrides: [] }, isLoading: false }) }));
vi.mock('swr', () => ({ default: state.swr }));

import RentalPage from '@/app/[locale]/rental/page';
import { useVehicles } from '@/hooks/useVehicles';

const car = (id: string, model: string, category: Vehicle['category']): Vehicle => ({
  id, make: 'Toyota', model, year: 2026, category, seats: 5, doors: 4,
  transmission: 'AUTOMATIC', fuelType: 'GASOLINE', pricePerDay: 300,
  pricePerMonth: 4000, depositAmount: 1000, imageUrls: [], features: [],
  isAvailable: true, isFeatured: false, totalUnits: 1, createdAt: '', updatedAt: '',
});
const fleet = [car('corolla-white', 'Corolla', 'SEDAN'), car('corolla-gray', 'Corolla', 'SEDAN'), car('van', 'Proace', 'VAN')];

beforeEach(() => {
  state.locale = 'he';
  state.fetchFleet.mockReset().mockResolvedValue(fleet);
  state.swr.mockReset().mockImplementation((_key, _fetcher, options) => ({ data: options?.fallbackData, isLoading: true, mutate: vi.fn() }));
});

describe('server-seeded rental discovery without changing dated pricing', () => {
  it('renders model links in initial undated HTML, deduplicated as before', async () => {
    const html = renderToStaticMarkup(await RentalPage({ params: Promise.resolve({ locale: 'he' }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('/he/rental/corolla-white');
    expect(html).toContain('/he/rental/van');
    expect(html).not.toContain('/he/rental/corolla-gray');
    expect(html).toContain('2');
    expect(state.fetchFleet).toHaveBeenCalledOnce();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
  it('honours the existing commercial category link in server-rendered cards', async () => {
    const html = renderToStaticMarkup(await RentalPage({ params: Promise.resolve({ locale: 'he' }), searchParams: Promise.resolve({ category: 'VAN' }) }));
    expect(html).toContain('/he/rental/van');
    expect(html).not.toContain('/he/rental/corolla-white');
    expect(html).toContain('min-h-12');
    expect(html).toContain('aria-pressed="true"');
  });
  it('leaves dated results on the existing client fetch path, not an assumed seasonal quote', async () => {
    const html = renderToStaticMarkup(await RentalPage({ params: Promise.resolve({ locale: 'he' }), searchParams: Promise.resolve({ pickup: '2026-12-20', return: '2026-12-23', pickupLocation: 'airport', returnLocation: 'telaviv' }) }));
    expect(state.fetchFleet).not.toHaveBeenCalled();
    expect(html).not.toContain('/he/rental/corolla-white');
    expect(html).not.toContain('/he/rental/van');
  });
  it('keeps browser recovery available if the server fleet read fails', async () => {
    state.fetchFleet.mockRejectedValue(new Error('fixture failure'));
    const html = renderToStaticMarkup(await RentalPage({ params: Promise.resolve({ locale: 'he' }) }));
    expect(html).toContain('<h1');
    expect(html).not.toContain('/he/rental/corolla-white');
    expect(state.swr).toHaveBeenCalledWith('/api/vehicles?available=true', expect.any(Function), undefined);
  });
  it('does not show a loading skeleton over valid seed data, while SWR still revalidates', () => {
    let result: ReturnType<typeof useVehicles> | undefined;
    function Probe() { result = useVehicles({ isAvailable: true }, fleet); return null; }
    renderToStaticMarkup(createElement(Probe));
    expect(result?.vehicles).toEqual(fleet);
    expect(result?.isLoading).toBe(false);
    const options = state.swr.mock.calls[0][2];
    expect(options).toEqual({ fallbackData: fleet });
    expect(options).not.toHaveProperty('revalidateOnMount', false);
  });
  it('preserves unseeded hook behaviour for other pages', () => {
    let result: ReturnType<typeof useVehicles> | undefined;
    function Probe() { result = useVehicles({ isAvailable: true }); return null; }
    renderToStaticMarkup(createElement(Probe));
    expect(result?.isLoading).toBe(true);
    expect(state.swr.mock.calls[0][2]).toBeUndefined();
  });
});

describe('rental URL criteria preserve existing locations and validate category', () => {
  it('preserves dates and both distinct locations', () => {
    expect(rentalSearchCriteria({ pickup: '2026-12-20', return: '2026-12-23', location: 'legacy', pickupLocation: 'airport', returnLocation: 'telaviv', category: 'VAN' })).toEqual({ pickupDate: '2026-12-20', returnDate: '2026-12-23', location: 'legacy', pickupLocation: 'airport', returnLocation: 'telaviv', category: 'VAN' });
  });
  it('preserves the old single-location fallback and first query value', () => {
    expect(rentalSearchCriteria({ location: ['כתובת אחרת', 'ignored'] })).toMatchObject({ location: 'כתובת אחרת', pickupLocation: 'כתובת אחרת', returnLocation: 'כתובת אחרת' });
  });
  it.each(['ALL', 'UNKNOWN', '<script>', 'van'])('ignores unsupported category %s', category => {
    expect(rentalSearchCriteria({ category }).category).toBe('');
  });
  it.each(['VAN', 'COMMERCIAL', 'ECONOMY_COMPACT', 'LUXURY'])('retains supported category %s', category => {
    expect(rentalSearchCriteria({ category }).category).toBe(category);
  });
});
