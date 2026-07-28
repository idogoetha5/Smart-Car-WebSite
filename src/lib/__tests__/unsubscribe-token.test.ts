import { describe, it, expect } from 'vitest';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../unsubscribe-token';

describe('unsubscribe tokens', () => {
  it('round-trips an address', () => {
    const token = createUnsubscribeToken('customer@example.com');
    const result = verifyUnsubscribeToken(token);
    expect(result).toEqual({ valid: true, email: 'customer@example.com' });
  });

  it('normalises case and surrounding space', () => {
    const result = verifyUnsubscribeToken(createUnsubscribeToken('  Customer@Example.COM '));
    expect(result.valid && result.email).toBe('customer@example.com');
  });

  // The point of the token: the address must not be readable from the URL.
  it('does not expose the address in plain text', () => {
    const token = createUnsubscribeToken('customer@example.com');
    expect(token).not.toContain('customer@example.com');
    expect(token).not.toContain('@');
  });

  it('rejects a tampered payload', () => {
    const token = createUnsubscribeToken('customer@example.com');
    const [, signature] = token.split('.');
    const forged = `${Buffer.from('victim@example.com', 'utf8').toString('base64url')}.${signature}`;
    expect(verifyUnsubscribeToken(forged)).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects a tampered signature', () => {
    const [payload] = createUnsubscribeToken('customer@example.com').split('.');
    expect(verifyUnsubscribeToken(`${payload}.notarealsignature`)).toEqual({
      valid: false,
      reason: 'bad_signature',
    });
  });

  it('rejects malformed input without throwing', () => {
    for (const bad of ['', 'nodot', 'a.b.c', null, undefined]) {
      expect(() => verifyUnsubscribeToken(bad as string)).not.toThrow();
      expect(verifyUnsubscribeToken(bad as string).valid).toBe(false);
    }
  });

  it('gives different addresses different tokens', () => {
    expect(createUnsubscribeToken('a@example.com')).not.toBe(
      createUnsubscribeToken('b@example.com'),
    );
  });
});
