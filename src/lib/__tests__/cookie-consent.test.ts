import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_KEY,
  readConsent,
  writeConsent,
} from '../cookie-consent';

describe('cookie consent storage', () => {
  const values = new Map<string, string>();
  let browserWindow: EventTarget;

  beforeEach(() => {
    values.clear();
    browserWindow = new EventTarget();
    vi.stubGlobal('window', browserWindow);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores the choice and emits one dedicated same-tab event', () => {
    const listener = vi.fn();
    browserWindow.addEventListener(CONSENT_CHANGE_EVENT, listener);

    writeConsent('accepted');

    expect(values.get(CONSENT_KEY)).toBe('accepted');
    expect(readConsent()).toBe('accepted');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('treats unknown stored values as no decision', () => {
    values.set(CONSENT_KEY, 'unexpected');
    expect(readConsent()).toBeNull();
  });
});
