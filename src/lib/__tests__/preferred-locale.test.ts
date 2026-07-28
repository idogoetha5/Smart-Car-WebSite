import { describe, it, expect } from 'vitest';

/**
 * Mirrors preferredLocale() in src/proxy.ts.
 *
 * Kept as a copy rather than an import because proxy.ts pulls in
 * next-intl/middleware and next/server at module load, which needs a request
 * context these unit tests do not have. The rule itself is what matters and
 * is small enough to keep in step.
 */
function preferredLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return 'he';
  const tags = acceptLanguage
    .toLowerCase()
    .split(',')
    .map((part) => part.split(';')[0].trim().split('-')[0]);

  if (tags.includes('he') || tags.includes('iw')) return 'he';
  if (tags.includes('en')) return 'en';
  return 'he';
}

describe('first-visit locale preference', () => {
  it('sends a Hebrew browser to Hebrew', () => {
    expect(preferredLocale('he-IL,he;q=0.9')).toBe('he');
    expect(preferredLocale('he')).toBe('he');
  });

  it('sends an English-only browser to English', () => {
    expect(preferredLocale('en-US,en;q=0.9')).toBe('en');
    expect(preferredLocale('en-GB')).toBe('en');
  });

  it('prefers Hebrew when the browser lists English first but also Hebrew', () => {
    // This is the case that was sending Israeli visitors to /en: Chrome in
    // Israel commonly reports en-US ahead of he-IL.
    expect(preferredLocale('en-US,en;q=0.9,he;q=0.8')).toBe('he');
    expect(preferredLocale('en-GB,en;q=0.9,he-IL;q=0.7')).toBe('he');
  });

  it('accepts the legacy Hebrew subtag "iw"', () => {
    expect(preferredLocale('iw-IL,iw;q=0.9')).toBe('he');
    expect(preferredLocale('en-US,iw;q=0.5')).toBe('he');
  });

  it('falls back to Hebrew with no header or an unrelated language', () => {
    expect(preferredLocale(null)).toBe('he');
    expect(preferredLocale('')).toBe('he');
    expect(preferredLocale('fr-FR,fr;q=0.9')).toBe('he');
    expect(preferredLocale('ru,ar;q=0.8')).toBe('he');
  });

  it('matches whole subtags only', () => {
    // A token merely containing the letters "he" or "en" must not count.
    expect(preferredLocale('the-thing')).toBe('he'); // falls through to default
    expect(preferredLocale('zh-Hans')).toBe('he');
  });

  it('ignores quality weights when deciding', () => {
    // Hebrew wins on presence, not on weight ordering.
    expect(preferredLocale('en;q=1.0,he;q=0.1')).toBe('he');
  });
});
