/**
 * TOTP (RFC 6238) for the admin login — Google Authenticator compatible.
 *
 * Written against Web Crypto rather than pulling in a library, because
 * admin-auth.ts already runs on the Edge runtime via the proxy and most TOTP
 * packages assume Node's crypto. One HMAC and some bit shuffling is not worth
 * a dependency that might not run where it is needed.
 *
 * This is a second factor, not a replacement for the password. The shared
 * password stays; the code proves the person also holds the phone that was
 * enrolled. That matters here because a single shared password currently opens
 * every booking and customer record, and a leaked password is otherwise the
 * whole story.
 */

const DIGITS = 6;
const PERIOD = 30; // seconds
/** Accept the neighbouring windows so a slightly wrong clock still works. */
const SKEW = 1;

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decodes a base32 secret as Google Authenticator writes it. */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const idx = B32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('invalid base32 character in TOTP secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** A fresh 20-byte secret, the size RFC 4226 recommends for HMAC-SHA1. */
export function generateSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  // 8-byte big-endian counter.
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);

  const key = await crypto.subtle.importKey(
    'raw',
    secret as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' }, // SHA-1 is what authenticator apps use
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));

  // Dynamic truncation, RFC 4226 §5.4.
  const offset = sig[sig.length - 1] & 0x0f;
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** The code for a given moment. Exported so tests can pin the clock. */
export async function generateTotp(secretB32: string, atMs = Date.now()): Promise<string> {
  return hotp(base32Decode(secretB32), Math.floor(atMs / 1000 / PERIOD));
}

/**
 * Constant-time-ish comparison. The codes are short and low-entropy, so this
 * matters less than for a signature, but there is no reason to leak position.
 */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a submitted code, allowing one window either side for clock drift.
 *
 * Does NOT protect against replay within the same 30-second window — that
 * needs a store of recently-used codes, which is a follow-up. Given the code
 * is a second factor behind a password and expires in 30 seconds, this is the
 * standard trade-off, but it is a real gap and is written down rather than
 * left implied.
 */
export async function verifyTotp(
  secretB32: string,
  submitted: string,
  atMs = Date.now(),
): Promise<boolean> {
  const code = String(submitted ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;

  const secret = base32Decode(secretB32);
  const counter = Math.floor(atMs / 1000 / PERIOD);

  for (let drift = -SKEW; drift <= SKEW; drift++) {
    if (equal(await hotp(secret, counter + drift), code)) return true;
  }
  return false;
}

/** The otpauth:// URI to turn into a QR code when enrolling. */
export function enrolmentUri(secretB32: string, account = 'admin', issuer = 'SmartCar'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
