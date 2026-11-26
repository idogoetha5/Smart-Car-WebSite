// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RentalQuoteData } from '@/lib/rental-quote';

const draft = vi.hoisted(() => vi.fn());
vi.mock('@/lib/use-quote-draft', () => ({ useQuoteDraft: draft }));
vi.mock('next-intl', () => ({ useLocale: () => 'he' }));
import BookingConfirmationsPage from '@/app/[locale]/admin/(protected)/booking-confirmations/page';
import { RentalQuoteBuilder } from '@/app/[locale]/admin/(protected)/rental-quotes/page';

let root: Root;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;
const currentData = () => draft.mock.calls.at(-1)![1] as RentalQuoteData;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }));
  vi.stubGlobal('fetch', fetchMock);
  draft.mockReset();
  draft.mockReturnValue({ discard: vi.fn(), storageError: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('dedicated booking confirmation flow', () => {
  it('opens directly as a confirmation with an independent draft and no quote switch', async () => {
    await act(async () => root.render(createElement(BookingConfirmationsPage)));
    expect(container.querySelector('h1')?.textContent).toBe('אישור הזמנה סופי');
    expect(currentData().documentMode).toBe('confirmation');
    expect(draft.mock.calls.at(-1)![0]).toBe('rental-confirmation');
    expect(container.textContent).not.toContain('הפוך לאישור הזמנה');
    expect(container.textContent).toContain('אישור הזמנה חדש');
    expect(container.querySelector('#rental-vehicles')?.className).not.toContain('lg:block');
  });

  it('keeps the original rental quotation flow available', async () => {
    await act(async () => root.render(createElement(RentalQuoteBuilder, { adminLocale: 'en' })));
    expect(currentData().documentMode).toBe('quote');
    expect(draft.mock.calls.at(-1)![0]).toBe('rental');
    expect(container.textContent).toContain('Create as booking confirmation and deal summary');
    expect(container.querySelector('#rental-vehicles')?.className).toContain('lg:block');
  });

  it('blocks skipping required details and sends the restored document as a confirmation', async () => {
    await act(async () => root.render(createElement(BookingConfirmationsPage)));
    const review = Array.from(container.querySelectorAll('nav button')).find(b => b.textContent?.includes('בדיקה ושליחה'))!;
    await act(async () => (review as HTMLButtonElement).click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('יש למלא');
    expect(fetchMock.mock.calls.every(args => args[0] === '/api/admin/vehicles')).toBe(true);

    const restore = draft.mock.calls.at(-1)![3] as (data: RentalQuoteData) => void;
    await act(async () => restore({
      ...currentData(), documentMode: 'quote', customerName: 'Fictional test', customerPhone: '0501234567',
      pickupLocation: 'תל אביב', returnLocation: 'הרצליה', insuranceCoverage: 'כיסוי שסוכם לבדיקה',
      vehicles: [{ ...currentData().vehicles[0], name: 'Test car', dailyPrice: 200 }],
    }));
    expect(currentData().documentMode).toBe('confirmation');
    await act(async () => (review as HTMLButtonElement).click());
    expect(container.textContent).toContain('האישור מוכן לבדיקה');
    const popup = { opener: null, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes('whatsapp') ? { whatsappUrl: 'https://wa.me/972501234567?text=test' } : [] }));
    const send = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('שליחת האישור ב־WhatsApp')).at(-1)!;
    await act(async () => send.click());
    const sent = fetchMock.mock.calls.find(args => args[0] === '/api/admin/rental-quote-whatsapp')!;
    expect(sent).toBeDefined();
    expect(JSON.parse(sent[1].body).documentMode).toBe('confirmation');
    expect(JSON.parse(sent[1].body).customerName).toBe('Fictional test');
    expect(popup.location.href).toContain('https://wa.me/');
  });
});
