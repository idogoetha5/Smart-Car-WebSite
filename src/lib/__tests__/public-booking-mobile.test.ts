// @vitest-environment happy-dom
import { act, createElement, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Vehicle } from '@/types';
import BookingForm from '@/components/booking/BookingForm';

const mocks = vi.hoisted(() => ({ locale: 'he', push: vi.fn() }));
vi.mock('next-intl', () => ({ useLocale: () => mocks.locale, useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/usePricingConfig', () => ({ usePricingConfig: () => ({ config: { seasons: [], overrides: [] } }) }));
vi.mock('@/components/booking/AvailabilityChecker', () => ({ AvailabilityChecker: () => null }));
vi.mock('@/components/ui/DatePickerInput', () => ({ default: ({ value, onChange, fieldLabel }: { value: string; onChange: (value: string) => void; fieldLabel: string }) => createElement('input', { 'aria-label': fieldLabel, value, onChange: (e: { target: { value: string } }) => onChange(e.target.value) }) }));
vi.mock('@/components/ui/Turnstile', () => ({ default: function Token({ onSuccess }: { onSuccess: (token: string) => void }) {
  const success = useRef(onSuccess);
  useEffect(() => { success.current('mock-token'); }, []); // Test-only token, no external verification.
  return null;
} }));

let host: HTMLDivElement;
let root: Root;
const vehicle = { id: 'test-vehicle', make: 'Toyota', model: 'Aygo X', pricePerDay: 250, dailyPrice: 250 } as unknown as Vehicle;
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes(text))!;
const visibleSection = () => host.querySelector<HTMLElement>('section:not([hidden])')!;
const airportVisible = () => [...host.querySelectorAll('p')].some(p => p.textContent?.includes('סכום התוספת ייקבע') && !p.closest('[hidden]'));
async function render(initialLocation = 'herzliya', dates = true) {
  await act(async () => root.render(createElement(BookingForm, { vehicle, initialLocation, initialReturnLocation: 'telaviv', initialPickupDate: dates ? '2030-01-10' : '', initialReturnDate: dates ? '2030-01-13' : '' })));
}
async function setField(selector: string, value: string) {
  const node = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(text: string) { await act(async () => button(text).click()); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.locale = 'he';
  for (const name of ['localStorage', 'sessionStorage']) {
    const values = new Map<string, string>();
    vi.stubGlobal(name, { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { id: 'test-only' }, emailSent: true }), { status: 200 })));
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('public staged rental request', () => {
  it('shows the airport surcharge only for an airport pickup or return, including before dates', async () => {
    await render('herzliya', false);
    expect(airportVisible()).toBe(false);
    const pickup = host.querySelector<HTMLSelectElement>('#pickup-location')!;
    const dropoff = host.querySelector<HTMLSelectElement>('#dropoff-location')!;
    await act(async () => { pickup.value = 'airport'; pickup.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(airportVisible()).toBe(true);
    expect(host.querySelectorAll('[role="note"]')).toHaveLength(1);
    await act(async () => { pickup.value = 'herzliya'; pickup.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(airportVisible()).toBe(false);
    await act(async () => { dropoff.value = 'airport'; dropoff.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(airportVisible()).toBe(true);
  });
  it('does not advance past missing rental details or send a request on an early submit', async () => {
    await render('', false);
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(visibleSection().getAttribute('aria-label')).toBe('פרטי ההשכרה');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves every customer field, dates, times, extras, notes and consents through back navigation and submits once', async () => {
    await render('airport');
    expect(host.textContent).toContain('זה אינו המחיר הסופי');
    expect(host.textContent).not.toContain('לצפייה במחיר הסופי');
    await click('המשך לפרטים אישיים');
    expect(visibleSection().getAttribute('aria-label')).toBe('פרטים אישיים');
    expect(host.querySelectorAll('[role="note"]')).toHaveLength(0);
    await setField('[name="customerName"]', 'Test Customer');
    await setField('[name="customerEmail"]', 'test@example.com');
    await setField('[name="customerPhone"]', '+972501234567');
    await setField('[name="customerIdNumber"]', 'AB123456');
    await setField('[name="notes"]', 'Test-only note');
    await click('המשך לתוספות וסיכום');
    expect(visibleSection().getAttribute('aria-label')).toBe('תוספות וסיכום');
    expect(host.querySelectorAll('[role="note"]')).toHaveLength(0);
    const extra = [...visibleSection().querySelectorAll('label')].find(l => l.textContent?.includes('נהג נוסף'))!.querySelector('input')!;
    await act(async () => extra.click());
    await setField('#additional-driver-name', 'Extra Test Driver');
    await click('חזרה');
    expect(host.querySelector<HTMLInputElement>('[name="customerName"]')!.value).toBe('Test Customer');
    await click('המשך לתוספות וסיכום');
    expect(host.querySelector<HTMLInputElement>('#additional-driver-name')!.value).toBe('Extra Test Driver');
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLInputElement>('[name="agreeTerms"]')!.click());
    await act(async () => host.querySelector<HTMLInputElement>('[name="marketingConsent"]')!.click());
    await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/bookings');
    expect(JSON.parse(options!.body as string)).toMatchObject({ vehicleId: 'test-vehicle', customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '+972501234567', customerIdNumber: 'AB123456', notes: 'Test-only note', pickupDate: '2030-01-10', dropoffDate: '2030-01-13', pickupLocation: 'airport', dropoffLocation: 'telaviv', pickup_time: '09:00', return_time: '09:00', extras: ['driver'], additionalDriverName: 'Extra Test Driver', agreeTerms: true, marketingConsent: true, locale: 'he', turnstileToken: 'mock-token' });
  });
  it('provides the same non-final estimate and airport warning in English', async () => {
    mocks.locale = 'en'; await render('airport');
    expect(host.textContent).toContain('This is not the final price');
    expect(host.textContent).toContain('surcharge will be agreed with your representative');
    expect(button('Continue to your details')).toBeDefined();
  });
});
