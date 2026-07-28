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
import { spawnSync } from 'node:child_process';

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

/**
 * Renders a scannable QR in the terminal via npx, so enrolment is "point the
 * camera at it" rather than typing 32 characters by hand. Not added to
 * package.json: it is needed once, and a permanent dependency for a one-off
 * setup step is not worth it. Falls back to the manual key if npx cannot run.
 */
function printQr(uri) {
  try {
    const r = spawnSync('npx', ['--yes', 'qrcode-terminal'], {
      input: uri, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 60_000,
    });
    if (r.status === 0 && r.stdout && r.stdout.includes('\u001b[')) {
      console.log(r.stdout);
      return true;
    }
  } catch {
    // Offline, or npx unavailable — the manual key below still works.
  }
  return false;
}

const secret = base32Encode(randomBytes(20));
const uri = `otpauth://totp/${encodeURIComponent('SmartCar:admin')}?` +
  new URLSearchParams({ secret, issuer: 'SmartCar', algorithm: 'SHA1', digits: '6', period: '30' });

console.log(`
────────────────────────────────────────────────────────────
 SmartCar — admin two-factor enrolment
────────────────────────────────────────────────────────────

 1. Open Google Authenticator and scan the square below.
    (+  →  "Scan a QR code")
`);

const scanned = printQr(uri);

console.log(`${scanned ? '' : '    (QR could not be drawn — use the key below instead)\n'}
    If scanning does not work, add it by hand instead:
      +  →  "Enter a setup key"
      Account:  SmartCar admin
      Key:      ${secret}
      Type:     Time based

 2. The live code is shown below and refreshes every second.
    Google Authenticator must show the SAME six digits.

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

// A single printed code was impossible to compare against: it rotates every
// 30 seconds, so by the time the app was open the two no longer matched even
// when enrolment was correct — which is exactly how this went wrong the first
// time. Printing it live removes the timing variable entirely.
const RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
let lastCode = '';

function tick() {
  const code = totp(secret);
  const left = 30 - Math.floor((Date.now() / 1000) % 30);
  const bar = '█'.repeat(left) + '░'.repeat(30 - left);
  const changed = code !== lastCode;
  lastCode = code;
  process.stdout.write(
    `\r  ${BOLD}${code}${RESET}  ${DIM}${bar}${RESET} ${String(left).padStart(2)}s` +
    (changed ? '   ' : '   '),
  );
}

if (process.stdout.isTTY) {
  tick();
  const timer = setInterval(tick, 1000);
  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log(`\n\n  Stopped. The secret above is still valid — add it to Vercel.\n`);
    process.exit(0);
  });
  console.log(`\n  ${DIM}(press Ctrl+C when the app shows the same code)${RESET}\n`);
} else {
  console.log(`  Current code: ${totp(secret)}\n`);
}
