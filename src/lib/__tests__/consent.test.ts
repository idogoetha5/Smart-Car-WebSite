import { describe, it, expect } from 'vitest';
import {
  termsConsent,
  marketingConsent,
  normalizeLocale,
  TERMS_VERSION,
} from '../consent';

/**
 * These import the real functions the API routes use, so a regression fails
 * the build rather than quietly filing the wrong sentence as someone's
 * agreement.
 */
describe('normalizeLocale', () => {
  it('recognises English', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('EN')).toBe('en');
  });

  it('falls back to Hebrew for anything else', () => {
    expect(normalizeLocale('he')).toBe('he');
    expect(normalizeLocale('fr')).toBe('he');
    expect(normalizeLocale('')).toBe('he');
    expect(normalizeLocale(undefined)).toBe('he');
    expect(normalizeLocale(null)).toBe('he');
    expect(normalizeLocale(42)).toBe('he');
  });
});

describe('termsConsent', () => {
  it('gives the English customer the English sentence', () => {
    const c = termsConsent('en');
    expect(c.locale).toBe('en');
    expect(c.text).toContain('Terms of Use');
    expect(c.text).not.toMatch(/[֐-׿]/);
  });

  it('gives the Hebrew customer the Hebrew sentence', () => {
    const c = termsConsent('he');
    expect(c.locale).toBe('he');
    expect(c.text).toMatch(/[֐-׿]/);
  });

  // The bug this replaces: both locales hashed the Hebrew text, so an English
  // customer's record evidenced wording they never saw.
  it('hashes the two languages differently', () => {
    expect(termsConsent('en').hash).not.toBe(termsConsent('he').hash);
  });

  it('is stable for the same locale', () => {
    expect(termsConsent('he').hash).toBe(termsConsent('he').hash);
  });

  it('carries the version', () => {
    expect(termsConsent('he').version).toBe(TERMS_VERSION);
  });
});

describe('marketingConsent', () => {
  it('differs by language', () => {
    expect(marketingConsent('en').hash).not.toBe(marketingConsent('he').hash);
    expect(marketingConsent('en').text).toContain('unsubscribe');
  });

  it('is not the same record as the terms consent', () => {
    expect(marketingConsent('he').hash).not.toBe(termsConsent('he').hash);
  });
});
