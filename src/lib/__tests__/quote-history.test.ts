import { describe, expect, it } from 'vitest';
import { quotePdfFilename, safeQuotePart } from '@/lib/quote-history';

describe('quote history filenames', () => {
  it('keeps Hebrew names while removing unsafe path characters', () => {
    expect(safeQuotePart('עידו גויטע / בדיקה')).toBe('עידו_גויטע_בדיקה');
  });

  it('builds a stable PDF filename from the customer and quote number', () => {
    expect(
      quotePdfFilename({
        customerName: 'עידו גויטע',
        quoteNumber: 'SC/123',
      })
    ).toBe('SmartCar_Quote_עידו_גויטע_SC_123.pdf');
  });
});
