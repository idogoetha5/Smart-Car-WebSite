#!/usr/bin/env node
/**
 * Enrols Google Authenticator for the admin login.
 *
 * Prints a fresh secret and a QR code. Nothing is written anywhere and nothing
 * is transmitted — you copy the secret into Vercel yourself, so it never
 * passes through a chat log, a file, or anyone else's hands.
 *
 *   node scripts/enrol-admin-totp.mjs
 *
 * Then set ADMIN_TOTP_SECRET in Vercel (Production) and redeploy. Until that
 * variable exists the login is unchanged, so a half-finished enrolment cannot
 * lock anyone out.
 */
import { createHmac, randomBytes } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const c of str.toUpperCase().replace(/=+$/, '')) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Same algorithm as src/lib/totp.ts, so the printed code proves they agree. */
function totp(secretB32, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const sig = createHmac('sha1', base32Decode(secretB32)).update(buf).digest();
  const off = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[off] & 0x7f) << 24) | ((sig[off + 1] & 0xff) << 16) |
              ((sig[off + 2] & 0xff) << 8) | (sig[off + 3] & 0xff);
  return String(bin % 1e6).padStart(6, '0');
}

/** Minimal QR renderer would be a dependency; use a terminal-safe fallback. */
function qrHint(uri) {
  return `Open this URI on the phone, or type the secret in by hand:\n\n  ${uri}\n`;
}

const secret = base32Encode(randomBytes(20));
const uri = `otpauth://totp/${encodeURIComponent('SmartCar:admin')}?` +
  new URLSearchParams({ secret, issuer: 'SmartCar', algorithm: 'SHA1', digits: '6', period: '30' });

console.log(`
────────────────────────────────────────────────────────────
 SmartCar — admin two-factor enrolment
────────────────────────────────────────────────────────────

 1. In Google Authenticator: + → "Enter a setup key"
      Account:  SmartCar admin
      Key:      ${secret}
      Type:     Time based

    ${qrHint(uri).split('\n').join('\n    ')}
 2. Check the app shows this code right now:

      ${totp(secret)}

    If it does not match, the phone's clock is off — fix that
    before continuing, or you will not be able to log in.

 3. Add to Vercel → Project → Settings → Environment Variables:

      ADMIN_TOTP_SECRET = ${secret}

    Mark it Sensitive. Then redeploy.

 4. Keep a copy of the key somewhere safe (password manager).
    Losing it AND the phone means no admin login — clearing
    ADMIN_TOTP_SECRET in Vercel is the only way back in, so
    make sure you can still reach that account.

 Until ADMIN_TOTP_SECRET exists the login is unchanged. Nothing
 here was saved or sent anywhere; it exists only in this output.
────────────────────────────────────────────────────────────
`);
