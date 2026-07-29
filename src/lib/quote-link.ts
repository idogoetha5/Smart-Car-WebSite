import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short branded links for the rental documents sent to customers.
 *
 * A Supabase signed URL works, but what lands in the customer's WhatsApp is
 * a wall of storage hostname and access token — it neither reads as SmartCar
 * nor survives being forwarded or read aloud. These links carry the quote
 * number and a short HMAC instead: `https://smartcar.co.il/q/R912214-q1kx7-…`.
 *
 * The token is the whole authorisation. It names the document, expires when the
 * quotation itself does, and cannot be edited — changing the quote number or
 * pushing the expiry out invalidates the signature — so the storage bucket
 * stays private and no database table is needed to resolve a link.
 *
 * QUOTE_LINK_SECRET is deliberately its own secret: a link a customer holds
 * for a week must never be derived from the admin session key.
 */

const PURPOSE = 'rental-quote-link';
/** Used only when a quotation carries no validity date of its own. */
const FALLBACK_VALIDITY_DAYS = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
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

/** Israel's UTC offset in minutes at a given instant (handles IDT and IST). */
function israelOffsetMinutes(atMs: number): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    timeZoneName: 'longOffset',
  }).format(new Date(atMs));
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label);
  if (!match) return 180;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** The end of a calendar date in Israel, as an epoch timestamp. */
function israelEndOfDay(isoDate: string): number {
  const asUtc = Date.parse(`${isoDate}T23:59:59.999Z`);
  if (Number.isNaN(asUtc)) return Number.NaN;
  return asUtc - israelOffsetMinutes(asUtc) * 60_000;
}

/** The calendar date it currently is in Israel. */
function israelToday(now: number): string {
  return new Date(now + israelOffsetMinutes(now) * 60_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * When a document's link stops working: the end of its validity date, Israel
 * time, so a quotation valid to the 29th opens all day on the 29th.
 *
 * A quotation holds for a month, not a week — the link must not die first. With
 * no usable date to go on it falls back to 30 days out.
 *
 * A date already in the past is returned as-is rather than quietly extended:
 * the representative has to pick a real future date, and
 * `rentalQuoteValidityIsExpired` is what the send path checks before it builds
 * a link nobody could open.
 */
export function rentalQuoteLinkExpiry(
  validUntil?: string | null,
  now: number = Date.now()
): number {
  const requested = validUntil?.trim();
  if (requested && ISO_DATE.test(requested)) {
    const expiry = israelEndOfDay(requested);
    if (!Number.isNaN(expiry)) return expiry;
  }

  const fallbackDate = israelToday(
    now + FALLBACK_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  );
  return israelEndOfDay(fallbackDate);
}

/** True when a quotation's validity date has already passed in Israel. */
export function rentalQuoteValidityIsExpired(
  validUntil?: string | null,
  now: number = Date.now()
): boolean {
  return rentalQuoteLinkExpiry(validUntil, now) <= now;
}

export function createRentalQuoteLinkToken(
  quoteNumber: string,
  mode: QuoteLinkMode,
  expiresAt: number
): string {
  const reference = safeQuoteReference(quoteNumber);
  const modeChar = MODE_TO_CHAR[mode];
  // Minute resolution keeps the token short; the signature covers it, so it
  // cannot be nudged forward.
  const expiresAtMinutes = Math.floor(expiresAt / 60_000);
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
