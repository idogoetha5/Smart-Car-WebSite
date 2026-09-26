/**
 * Cookie consent state, shared by the banner, the footer re-open control
 * and the consent-gated analytics.
 *
 * The cookies policy page states, in both locales, that preferences can be
 * changed at any time via a "Cookie Preferences" control at the bottom of
 * every page. That control did not exist: consent was written to
 * localStorage once and there was no way to revisit it. This module backs
 * the control the policy already promises.
 */

export const CONSENT_KEY = 'cookie_consent';

/** Same-tab notification after our own code writes a new choice. */
export const CONSENT_CHANGE_EVENT = 'smartcar:cookie-consent-change';

/** Custom event asking the banner to re-open for an existing visitor. */
export const REOPEN_EVENT = 'smartcar:cookie-preferences';

export type ConsentValue = 'accepted' | 'declined';

export function readConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    // Storage can throw in private mode / with cookies blocked. Treat as
    // "no decision recorded" rather than crashing the page.
    return null;
  }
}

export function writeConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
    // Native `storage` events are browser-owned and fire only in *other*
    // tabs. Dispatch a dedicated event for this tab instead of constructing
    // a synthetic StorageEvent, which has had inconsistent WebKit behavior.
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  } catch {
    // Nothing persisted means the banner will ask again next visit, which
    // is the safe outcome — we never treat a failed write as consent.
  }
}

/** Re-open the consent banner so a previous choice can be changed. */
export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}
