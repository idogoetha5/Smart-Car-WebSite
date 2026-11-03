// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WhatsAppSimulator from '@/components/whatsapp/WhatsAppSimulator';

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  })));
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(WhatsAppSimulator)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('releases a stalled composer with an error and allows a retry without losing the conversation', async () => {
  const quick = [...host.querySelectorAll('button')].find(button => button.textContent === 'ליסינג')!;
  await act(async () => quick.click());
  expect(host.querySelector('input')!.disabled).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(host.querySelector('input')!.disabled).toBe(false);
  expect(host.textContent).toContain('אפשר לנסות שוב');
  expect(host.querySelector('[role="log"]')!.textContent).toContain('ליסינג');
  expect(host.querySelector('[aria-label="SmartCar כותב"]')).toBeNull();
});

it('cancels an in-flight request on reset without adding an error to the new conversation', async () => {
  const quick = [...host.querySelectorAll('button')].find(button => button.textContent === 'ליסינג')!;
  await act(async () => quick.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="איפוס שיחה"]')!.click());
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(host.querySelector('input')!.disabled).toBe(false);
  expect(host.textContent).not.toContain('הסימולציה אינה זמינה');
  expect(host.textContent).not.toContain('אני מתעניין בליסינג');
});
