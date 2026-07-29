import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short branded links for the rental documents sent to customers.
 *
 * A Supabase signed URL works, but what lands in the customer's WhatsApp is
 * a wall of storage hostname and access token — it neither reads as SmartCar
 * nor survives being forwarded or read aloud. These links carry the quote
 * number and a short HMAC instead: `https://smartcar.co.il/q/R912214-q1kx7-…`.
 *
 * The token is the whole authorisation. It names the document, expires seven
 * days out, and cannot be edited — changing the quote number or pushing the
 * expiry out invalidates the signature — so the storage bucket stays private
 * and no database table is needed to resolve a link.
 *
 * QUOTE_LINK_SECRET is deliberately its own secret: a link a customer holds
 * for a week must never be derived from the admin session key.
 */

const PURPOSE = 'rental-quote-link';
const DEFAULT_TTL_DAYS = 7;
/** 16 base36 characters — ~82 bits, far past guessing a live link. */
const SIGNATURE_LENGTH = 16;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export type QuoteLinkMode = 'quote' | 'confirmation';

const MODE_TO_CHAR: Record<QuoteLinkMode, string> = {
  quote: 'q',
  confirmation: 'c',
};
const CHAR_TO_MODE: Record<string, QuoteLinkMode> = {
  q: 'quote',
  c: 'confirmation',
};

function secret(): string {
  const value = process.env.QUOTE_LINK_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[quote-link] QUOTE_LINK_SECRET must be set in production');
    }
    // Development only — the throw above keeps a deployed environment honest.
    return 'dev-only-insecure-quote-link-secret';
  }
  return value;
}

/**
 * The reference as it appears in the URL and in the storage path.
 *
 * Restricted to alphanumerics: it is interpolated into a storage object path,
 * and the generated numbers (`R912214`) never need anything else.
 */
export function safeQuoteReference(quoteNumber: string): string {
  return quoteNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || 'quote';
}

/** Where the rental PDF for a quote number lives in the private bucket. */
export function rentalQuotePdfPath(quoteNumber: string): string {
  return `rental/${safeQuoteReference(quoteNumber)}.pdf`;
}

function sign(reference: string, modeChar: string, expiresAtMinutes: number): string {
  const digest = createHmac('sha256', secret())
    .update(`${PURPOSE}.${reference}.${modeChar}.${expiresAtMinutes}`, 'utf8')
    .digest('hex');
  // base36 rather than base64url: `-` separates the token's own parts, and
  // base64url can contain `-`, which would make the token ambiguous to parse.
  return BigInt(`0x${digest}`)
    .toString(36)
    .padStart(SIGNATURE_LENGTH, '0')
    .slice(0, SIGNATURE_LENGTH);
}

/** Constant-time compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createRentalQuoteLinkToken(
  quoteNumber: string,
  mode: QuoteLinkMode,
  ttlDays: number = DEFAULT_TTL_DAYS
): string {
  const reference = safeQuoteReference(quoteNumber);
  const modeChar = MODE_TO_CHAR[mode];
  // Minute resolution keeps the token short; the signature covers it, so it
  // cannot be nudged forward.
  const expiresAtMinutes = Math.floor(
    (Date.now() + ttlDays * 24 * 60 * 60 * 1000) / 60_000
  );
  const signature = sign(reference, modeChar, expiresAtMinutes);
  return `${reference}-${modeChar}${expiresAtMinutes.toString(36)}-${signature}`;
}

export interface QuoteLinkResult {
  valid: boolean;
  quoteNumber?: string;
  mode?: QuoteLinkMode;
  reason?: 'malformed' | 'bad-signature' | 'expired';
}

export function verifyRentalQuoteLinkToken(
  token: string | undefined | null
): QuoteLinkResult {
  if (!token || !TOKEN_PATTERN.test(token)) {
    return { valid: false, reason: 'malformed' };
  }

  const parts = token.split('-');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };

  const [reference, modeAndExpiry, signature] = parts;
  const mode = CHAR_TO_MODE[modeAndExpiry.slice(0, 1)];
  const expiresAtMinutes = Number.parseInt(modeAndExpiry.slice(1), 36);
  if (!reference || !mode || !Number.isFinite(expiresAtMinutes)) {
    return { valid: false, reason: 'malformed' };
  }

  // Signature before expiry, so the response cannot be used to tell a forged
  // token apart from one that merely aged out.
  const expected = sign(reference, MODE_TO_CHAR[mode], expiresAtMinutes);
  if (!safeEqual(signature, expected)) {
    return { valid: false, reason: 'bad-signature' };
  }

  if (Date.now() > expiresAtMinutes * 60_000) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, quoteNumber: reference, mode };
}

/** The customer-facing link: `<origin>/q/<token>`. */
export function rentalQuoteShortLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/q/${token}`;
}
