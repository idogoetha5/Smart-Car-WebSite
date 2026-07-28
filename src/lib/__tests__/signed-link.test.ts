import { describe, it, expect, beforeAll } from 'vitest';
import { createConditionReportToken, verifyConditionReportToken } from '../signed-link';

beforeAll(() => {
  process.env.CONDITION_REPORT_SECRET = 'test-secret-for-signed-link-tests';
});

describe('condition report signed links', () => {
  it('round-trips a booking id', () => {
    const token = createConditionReportToken('abc12345');
    const result = verifyConditionReportToken(token);
    expect(result.valid).toBe(true);
    // Normalised to uppercase so the id matches however it was passed in.
    expect(result.bookingId).toBe('ABC12345');
  });

  it('rejects a token with a tampered booking id', () => {
    const token = createConditionReportToken('ABC12345');
    const [, exp, sig] = token.split('.');
    const forged = `OTHER999.${exp}.${sig}`;
    const result = verifyConditionReportToken(forged);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad-signature');
  });

  it('rejects a token whose expiry was extended', () => {
    const token = createConditionReportToken('ABC12345');
    const [subject, exp, sig] = token.split('.');
    const extended = `${subject}.${Number(exp) + 86_400_000}.${sig}`;
    expect(verifyConditionReportToken(extended).valid).toBe(false);
  });

  it('rejects an expired token', () => {
    // Negative TTL puts the expiry in the past while keeping the signature
    // valid, which is the case a signature check alone would let through.
    const token = createConditionReportToken('ABC12345', -1);
    const result = verifyConditionReportToken(token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('reports a forged signature rather than expiry for an expired forgery', () => {
    // Signature is checked first, so the response can't be used to tell
    // "this booking exists but the link expired" from "this is forged".
    const forged = `ABC12345.${Date.now() - 1000}.not-a-real-signature`;
    expect(verifyConditionReportToken(forged).reason).toBe('bad-signature');
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'nonsense', 'a.b', 'a.b.c.d']) {
      const r = verifyConditionReportToken(bad);
      expect(r.valid).toBe(false);
    }
    expect(verifyConditionReportToken(undefined).valid).toBe(false);
    expect(verifyConditionReportToken(null).valid).toBe(false);
  });

  it('never returns a booking id for an invalid token', () => {
    const bad = verifyConditionReportToken('ABC12345.9999999999999.wrong');
    expect(bad.valid).toBe(false);
    expect(bad.bookingId).toBeUndefined();
  });
});
