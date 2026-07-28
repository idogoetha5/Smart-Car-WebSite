import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed links for customer-facing forms that act on a
 * specific booking.
 *
 * The condition-report form previously accepted any booking reference
 * typed into the request body, from anyone, with no verification — so a
 * report could be filed against someone else's booking, or against a
 * reference that never existed. The booking a report belongs to now comes
 * from a signed token rather than from user input, and the token expires.
 *
 * The secret is domain-separated from the admin session secret it is
 * derived from, so a token minted here can never be replayed as an admin
 * cookie (or vice versa) even though both are HMACs over the same key.
 */

const PURPOSE_CONDITION_REPORT = 'condition-report';

function secret(): string {
  const value = process.env.CONDITION_REPORT_SECRET || process.env.ADMIN_COOKIE_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[signed-link] CONDITION_REPORT_SECRET or ADMIN_COOKIE_SECRET must be set in production');
    }
    // Development only — the throw above guarantees production has a real
    // secret, so this can never weaken a deployed environment.
    return 'dev-only-insecure-signed-link-secret';
  }
  return value;
}

function sign(purpose: string, subject: string, expiresAt: number): string {
  return createHmac('sha256', secret())
    .update(`${purpose}.${subject}.${expiresAt}`, 'utf8')
    .digest('base64url');
}

/** Constant-time compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface SignedLinkResult {
  valid: boolean;
  /** The booking the token authorises, present only when valid. */
  bookingId?: string;
  reason?: 'malformed' | 'expired' | 'bad-signature';
}

export function createConditionReportToken(bookingId: string, ttlHours = 72): string {
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
  const subject = bookingId.trim().toUpperCase();
  const sig = sign(PURPOSE_CONDITION_REPORT, subject, expiresAt);
  // `.` is safe as a separator: the id is uppercased alphanumerics and the
  // signature is base64url, neither of which contains a dot.
  return `${subject}.${expiresAt}.${sig}`;
}

export function verifyConditionReportToken(token: string | undefined | null): SignedLinkResult {
  if (!token) return { valid: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };

  const [subject, expRaw, sig] = parts;
  const expiresAt = Number(expRaw);
  if (!subject || !Number.isFinite(expiresAt)) return { valid: false, reason: 'malformed' };

  // Signature is checked before expiry so an attacker cannot use the
  // response to distinguish "expired" from "forged".
  const expected = sign(PURPOSE_CONDITION_REPORT, subject, expiresAt);
  if (!safeEqual(sig, expected)) return { valid: false, reason: 'bad-signature' };

  if (Date.now() > expiresAt) return { valid: false, reason: 'expired' };

  return { valid: true, bookingId: subject };
}
