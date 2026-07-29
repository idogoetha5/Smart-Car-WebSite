import { describe, expect, it } from 'vitest';
import { quoteValidUntil } from '@/lib/quote-pdf';

describe('quoteValidUntil', () => {
  it('uses the explicit validity date when one is provided', () => {
    expect(quoteValidUntil({ date: '29.07.2026', validUntil: '15.08.2026' }))
      .toBe('15.08.2026');
  });

  it('uses the same 30-day default for the PDF and the outgoing email', () => {
    expect(quoteValidUntil({ date: '29.07.2026' })).toBe('28.08.2026');
  });
});
