import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';
import { cardBrand, expiryValid, formatCardNumber, luhnValid } from './card';
import { decryptCard, encryptCard, encryptionConfigured } from './crypto';

describe('card validation', () => {
  it('luhn', () => {
    expect(luhnValid('4580 0000 0000 0000')).toBe(true);
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('5555555555554444')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
    expect(luhnValid('1234')).toBe(false);
  });
  it('brand and format', () => {
    expect(cardBrand('4111111111111111')).toBe('visa');
    expect(cardBrand('5555555555554444')).toBe('mastercard');
    expect(cardBrand('378282246310005')).toBe('amex');
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
  });
  it('expiry', () => {
    const now = new Date(2026, 10, 11);
    expect(expiryValid('11', '26', now)).toBe(true);
    expect(expiryValid('10', '26', now)).toBe(false);
    expect(expiryValid('13', '27', now)).toBe(false);
    expect(expiryValid('01', '2030', now)).toBe(true);
  });
});

describe('card encryption', () => {
  beforeAll(() => { process.env.CARD_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });
  it('round-trips and never contains the number in clear', () => {
    expect(encryptionConfigured()).toBe(true);
    const secret = { number: '4111111111111111', expMonth: '08', expYear: '28', holderName: 'Test', holderIdType: 'il' as const, holderId: '123456782' };
    const ct = encryptCard(secret);
    expect(ct).not.toContain('4111');
    expect(decryptCard(ct)).toEqual(secret);
  });
  it('rejects tampering', () => {
    const ct = encryptCard({ number: '4111111111111111', expMonth: '08', expYear: '28', holderName: '', holderIdType: 'il', holderId: '1' });
    const parts = ct.split('.');
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    expect(() => decryptCard(parts.join('.'))).toThrow();
  });
});
