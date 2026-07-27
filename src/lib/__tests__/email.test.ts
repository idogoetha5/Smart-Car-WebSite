import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail } from '../email';

describe('normalizeEmail', () => {
  it('lowercases so a differently-cased login still matches stored rows', () => {
    expect(normalizeEmail('Ido.Goetha@Example.COM')).toBe('ido.goetha@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEmail('  a@b.com  ')).toBe('a@b.com');
    expect(normalizeEmail('\ta@b.com\n')).toBe('a@b.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail(' A@B.com ');
    expect(normalizeEmail(once)).toBe(once);
  });

  it('handles null/undefined without throwing', () => {
    expect(normalizeEmail(undefined as unknown as string)).toBe('');
    expect(normalizeEmail(null as unknown as string)).toBe('');
  });

  // The vulnerability this replaced: with ilike(), '%' and '_' are
  // wildcards, so these addresses could widen a lookup to other
  // customers' bookings. Normalization must not strip them — they are
  // passed to an exact eq() match, where they are literal characters.
  it('preserves SQL LIKE wildcards verbatim (they are literal under eq)', () => {
    expect(normalizeEmail('%@example.com')).toBe('%@example.com');
    expect(normalizeEmail('a_b@example.com')).toBe('a_b@example.com');
    expect(normalizeEmail('%')).toBe('%');
  });

  it('does NOT strip plus-tags — they are different mailboxes', () => {
    expect(normalizeEmail('user+tag@example.com')).toBe('user+tag@example.com');
    expect(normalizeEmail('user+tag@example.com')).not.toBe('user@example.com');
  });

  it('does NOT strip dots in the local part', () => {
    expect(normalizeEmail('first.last@example.com')).toBe('first.last@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts ordinary addresses regardless of case or padding', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('  A@B.CO.IL ')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('@b.com')).toBe(false);
  });
});
