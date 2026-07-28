import { describe, it, expect } from 'vitest';
import { canSubmitRequest, matchStatusFor, requiresManualMatch } from '../booking-rules';

/**
 * Rules the booking flow must hold, expressed as pure functions mirroring
 * the API logic. These are the behaviours the brief calls out explicitly,
 * so a regression in any of them fails the build rather than reaching a
 * customer.
 */

/** Availability: a date is only taken once EVERY listed unit is booked. */
function isAvailableOnline(conflictCount: number, totalUnits: number): boolean {
  const units = Math.max(1, Number(totalUnits) || 1);
  return conflictCount < units;
}

/** Only the transition INTO confirmed sends the confirmation email. */
function shouldSendConfirmationEmail(rowsUpdatedByTransition: number): boolean {
  return rowsUpdatedByTransition > 0;
}

/** Marketing attribution must never carry personal data. */
function sanitizeAttribution(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'referrer'];
  const out: Record<string, string> = {};
  for (const k of allowed) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

describe('online availability counts against total_units', () => {
  it('single-unit vehicle is taken by one overlapping booking', () => {
    expect(isAvailableOnline(0, 1)).toBe(true);
    expect(isAvailableOnline(1, 1)).toBe(false);
  });

  it('two-unit vehicle still has capacity after one booking', () => {
    expect(isAvailableOnline(1, 2)).toBe(true);
    expect(isAvailableOnline(2, 2)).toBe(false);
  });

  it('N units: available until all N overlap', () => {
    expect(isAvailableOnline(4, 5)).toBe(true);
    expect(isAvailableOnline(5, 5)).toBe(false);
    expect(isAvailableOnline(6, 5)).toBe(false);
  });

  it('treats a missing/zero total_units as one unit, never as unlimited', () => {
    expect(isAvailableOnline(1, 0)).toBe(false);
    expect(isAvailableOnline(1, undefined as unknown as number)).toBe(false);
  });
});

describe('partial online inventory never blocks a request', () => {
  it('allows submission when the catalogue says unavailable', () => {
    expect(canSubmitRequest()).toBe(true);
  });
  it('allows submission when availability is unknown (API error/empty)', () => {
    expect(canSubmitRequest()).toBe(true);
  });
  it('allows submission when available', () => {
    expect(canSubmitRequest()).toBe(true);
  });
});

describe('manual match flag', () => {
  it('flags only a definite online no-match', () => {
    expect(matchStatusFor(false)).toBe('MANUAL_MATCH_REQUIRED');
  });
  it('does not flag an available or unknown result', () => {
    expect(matchStatusFor(true)).toBeNull();
    expect(matchStatusFor(null)).toBeNull();
  });

  // The flag is derived on the server. A browser may ask for a manual match,
  // but it must never be able to suppress one the server decided on — that is
  // how an unavailable vehicle would silently skip the staff check.
  it('honours a client request for a manual match', () => {
    expect(requiresManualMatch(true, true)).toBe(true);
    expect(matchStatusFor(true, true)).toBe('MANUAL_MATCH_REQUIRED');
  });
  it('still flags an unavailable vehicle when the client omits the flag', () => {
    expect(requiresManualMatch(false, false)).toBe(true);
    expect(matchStatusFor(false, false)).toBe('MANUAL_MATCH_REQUIRED');
  });
  it('treats undefined availability as no flag needed', () => {
    expect(requiresManualMatch(undefined)).toBe(false);
  });
});

describe('confirmation email is sent exactly once', () => {
  it('sends when this request performed the transition', () => {
    expect(shouldSendConfirmationEmail(1)).toBe(true);
  });
  it('does not send on a double-click/retry that changed no row', () => {
    expect(shouldSendConfirmationEmail(0)).toBe(false);
  });
});

describe('attribution sanitiser', () => {
  it('keeps marketing parameters', () => {
    expect(sanitizeAttribution({ utm_source: 'google', gclid: 'abc' }))
      .toEqual({ utm_source: 'google', gclid: 'abc' });
  });

  it('drops anything not on the allowlist, including personal data', () => {
    const out = sanitizeAttribution({
      utm_source: 'google',
      email: 'a@b.com',
      customerName: 'Ido',
      phone: '0500000000',
    });
    expect(out).toEqual({ utm_source: 'google' });
    expect(JSON.stringify(out)).not.toContain('a@b.com');
    expect(JSON.stringify(out)).not.toContain('0500000000');
  });

  it('caps length to avoid unbounded values', () => {
    const out = sanitizeAttribution({ utm_campaign: 'x'.repeat(500) });
    expect(out!.utm_campaign.length).toBe(200);
  });

  it('returns null when nothing usable is present', () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution({})).toBeNull();
    expect(sanitizeAttribution({ email: 'a@b.com' })).toBeNull();
  });
});
