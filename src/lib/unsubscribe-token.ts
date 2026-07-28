import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Opaque, signed unsubscribe tokens.
 *
 * The old link was `/api/newsletter/unsubscribe?email=someone@example.com`.
 * That put a customer's address in a URL, which lands in browser history,
 * server logs, referrer headers and any intermediary that touches the
 * request — and it let anyone unsubscribe any address they could guess.
 *
 * A token carries the address in a form only this server can read, and only
 * this server could have issued.
 *
 * Deliberately NOT given an expiry. An unsubscribe link has to keep working
 * in a mail someone opens a year later; a dead link means a customer who
 * wants out cannot get out, which is worse than the link being long-lived.
 * The token authorises exactly one narrow action on one address.
 */

const SEP = '.';
/** Domain separation, so a token can never be replayed as another kind. */
const PURPOSE = 'newsletter-unsubscribe:v1';

function secret(): string {
  const value = process.env.NEWSLETTER_UNSUB_SECRET || process.env.ADMIN_COOKIE_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[unsubscribe-token] NEWSLETTER_UNSUB_SECRET or ADMIN_COOKIE_SECRET must be set in production',
      );
    }
    return 'dev-only-insecure-secret';
  }
  return value;
}

const b64url = (buf: Buffer) => buf.toString('base64url');

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(`${PURPOSE}${SEP}${payload}`).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length must be compared separately; timingSafeEqual throws on a mismatch.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Token for a one-click unsubscribe link. Safe to put in an email. */
export function createUnsubscribeToken(email: string): string {
  const payload = b64url(Buffer.from(email.trim().toLowerCase(), 'utf8'));
  return `${payload}${SEP}${sign(payload)}`;
}

export type UnsubscribeTokenResult =
  | { valid: true; email: string }
  | { valid: false; reason: 'malformed' | 'bad_signature' };

export function verifyUnsubscribeToken(token: string | undefined | null): UnsubscribeTokenResult {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'malformed' };

  const parts = token.split(SEP);
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };

  const [payload, signature] = parts;
  if (!payload || !signature) return { valid: false, reason: 'malformed' };

  if (!safeEqual(signature, sign(payload))) return { valid: false, reason: 'bad_signature' };

  let email: string;
  try {
    email = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!email.includes('@')) return { valid: false, reason: 'malformed' };

  return { valid: true, email };
}
