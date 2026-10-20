// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VehicleGallery from '@/components/vehicle/VehicleGallery';
const state = vi.hoisted(() => ({ locale: 'he' }));
vi.mock('next-intl', () => ({ useLocale: () => state.locale }));
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }) }));
let host: HTMLDivElement;
let root: Root;
const image = () => host.querySelector('img')!;
async function click(label: string) { await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click()); }
async function swipe(dx: number, dy = 0) {
  const area = image().parentElement!;
  await act(async () => {
    area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 100, clientY: 100 }));
    area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', clientX: 100 + dx, clientY: 100 + dy }));
  });
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); state.locale = 'he';
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(VehicleGallery, { images: ['/a.webp','/b.webp','/c.webp'], alt: 'Test car' })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
describe('vehicle photo gallery', () => {
  it('opens the selected image in a modal, wraps next/previous, and restores body scrolling on close', async () => {
    await click('הצגת תמונה 3 מתוך 3');
    await click('הגדלת תמונת הרכב למסך מלא');
    expect(host.querySelector('dialog')!.open).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    const next = [...host.querySelectorAll('dialog button')].find(x=>x.textContent==='הבאה') as HTMLButtonElement;
    await act(async () => next.click());
    expect(image().getAttribute('src')).toBe('/a.webp');
    const close = [...host.querySelectorAll('dialog button')].find(x=>x.textContent?.includes('סגירה')) as HTMLButtonElement;
    await act(async () => close.click());
    expect(host.querySelector('dialog')!.open).toBe(false);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('recognises horizontal RTL swipes but not page scrolling, and does not open a modal after a swipe', async () => {
    await swipe(65, 90); expect(image().getAttribute('src')).toBe('/a.webp');
    await swipe(65); expect(image().getAttribute('src')).toBe('/b.webp');
    await click('הגדלת תמונת הרכב למסך מלא'); expect(host.querySelector('dialog')!.open).toBe(false);
    await click('הגדלת תמונת הרכב למסך מלא'); expect(host.querySelector('dialog')!.open).toBe(true);
  });
  it('supports keyboard navigation and LTR swipe direction', async () => {
    await act(async () => image().parentElement!.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowLeft', bubbles:true })));
    expect(image().getAttribute('src')).toBe('/b.webp');
    state.locale = 'en';
    await act(async () => root.render(createElement(VehicleGallery, { images:['/a.webp','/b.webp','/c.webp'], alt:'Test car' })));
    await swipe(-65); expect(image().getAttribute('src')).toBe('/c.webp');
  });
});
