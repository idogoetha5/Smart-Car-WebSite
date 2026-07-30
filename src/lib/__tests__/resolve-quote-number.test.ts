import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveUniqueQuoteNumber } from '@/lib/quote-history';

let rows: Record<string, { customer_email: string }>;
let nextGenerated: string[];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => ({ data: rows[value] ?? null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/quote-pdf', () => ({
  generateQuoteNumber: () => nextGenerated.shift() ?? '999999',
  quoteValidUntil: () => '2026-08-01',
}));

beforeEach(() => {
  rows = {};
  nextGenerated = [];
});

describe('resolveUniqueQuoteNumber', () => {
  it('keeps a candidate that is not taken', async () => {
    await expect(resolveUniqueQuoteNumber('482913', 'a@x.com')).resolves.toBe('482913');
  });

  it('keeps the candidate when the existing row is the same customer resaving', async () => {
    rows['482913'] = { customer_email: 'A@X.com' };
    await expect(resolveUniqueQuoteNumber('482913', ' a@x.com ')).resolves.toBe('482913');
  });

  it('draws a fresh number when a different customer already holds it', async () => {
    rows['482913'] = { customer_email: 'someone-else@x.com' };
    nextGenerated = ['111111'];
    await expect(resolveUniqueQuoteNumber('482913', 'a@x.com')).resolves.toBe('111111');
  });

  it('keeps retrying past repeated collisions', async () => {
    rows['482913'] = { customer_email: 'someone-else@x.com' };
    rows['111111'] = { customer_email: 'also-someone-else@x.com' };
    nextGenerated = ['111111', '222222'];
    await expect(resolveUniqueQuoteNumber('482913', 'a@x.com')).resolves.toBe('222222');
  });
});
