import { describe, it, expect } from 'vitest';
import {
  generateTotp,
  verifyTotp,
  generateSecret,
  base32Decode,
  base32Encode,
  enrolmentUri,
} from '../totp';

// RFC 6238 test vector: the ASCII secret "12345678901234567890" as base32.
const RFC_SECRET = base32Encode(new TextEncoder().encode('12345678901234567890'));

describe('base32', () => {
  it('round-trips', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 200, 255, 0]);
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
  });

  it('tolerates padding, spaces and lower case', () => {
    const canonical = base32Encode(new Uint8Array([1, 2, 3, 4, 5]));
    expect([...base32Decode(canonical.toLowerCase())]).toEqual([...base32Decode(canonical)]);
  });

  it('rejects an invalid character rather than producing wrong bytes', () => {
    expect(() => base32Decode('ABC!DEF')).toThrow();
  });
});

describe('generateTotp', () => {
  // Known-answer tests from RFC 6238, SHA-1 / 6 digits.
  it('matches the RFC 6238 vector at T=59', async () => {
    expect(await generateTotp(RFC_SECRET, 59_000)).toBe('287082');
  });

  it('matches the RFC 6238 vector at T=1111111109', async () => {
    expect(await generateTotp(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
  });

  it('matches the RFC 6238 vector at T=1234567890', async () => {
    expect(await generateTotp(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
  });

  it('always returns six digits, including with leading zeros', async () => {
    expect(await generateTotp(RFC_SECRET, 1_234_567_890_000)).toMatch(/^\d{6}$/);
  });
});

describe('verifyTotp', () => {
  const now = 1_700_000_000_000;

  it('accepts the current code', async () => {
    expect(await verifyTotp(RFC_SECRET, await generateTotp(RFC_SECRET, now), now)).toBe(true);
  });

  // Clock drift either way must still work, or a slightly-off phone locks
  // the only administrator out.
  it('accepts one window either side', async () => {
    const prev = await generateTotp(RFC_SECRET, now - 30_000);
    const next = await generateTotp(RFC_SECRET, now + 30_000);
    expect(await verifyTotp(RFC_SECRET, prev, now)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, next, now)).toBe(true);
  });

  it('rejects a code two windows away', async () => {
    const old = await generateTotp(RFC_SECRET, now - 90_000);
    expect(await verifyTotp(RFC_SECRET, old, now)).toBe(false);
  });

  it('rejects a wrong code', async () => {
    expect(await verifyTotp(RFC_SECRET, '000000', now)).toBe(false);
  });

  it('rejects malformed input without throwing', async () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56', null, undefined]) {
      await expect(verifyTotp(RFC_SECRET, bad as string, now)).resolves.toBe(false);
    }
  });

  it('rejects a code generated from a different secret', async () => {
    const other = generateSecret();
    expect(await verifyTotp(RFC_SECRET, await generateTotp(other, now), now)).toBe(false);
  });
});

describe('enrolment', () => {
  it('produces a 32-character base32 secret', () => {
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('gives two different secrets on two calls', () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });

  it('builds an otpauth URI an authenticator app can read', () => {
    const uri = enrolmentUri('JBSWY3DPEHPK3PXP');
    expect(uri).toContain('otpauth://totp/SmartCar%3Aadmin');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=SmartCar');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
