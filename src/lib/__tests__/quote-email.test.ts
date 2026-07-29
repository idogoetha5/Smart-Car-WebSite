import { describe, expect, it } from 'vitest';
import { buildQuoteEmailContent } from '@/lib/quote-email';

describe('buildQuoteEmailContent', () => {
  it('builds matching HTML and plain-text quote details', () => {
    const content = buildQuoteEmailContent({
      customerName: 'ישראל ישראלי',
      quoteNumber: 'SC-123',
      validUntil: '28.08.2026',
      officePhone: '09-9509757',
      officeEmail: 'office@smartcar.co.il',
    });

    expect(content.subject).toContain('SC-123');
    expect(content.text).toContain('ישראל ישראלי');
    expect(content.text).toContain('28.08.2026');
    expect(content.html).toContain('ישראל ישראלי');
    expect(content.html).toContain('28.08.2026');
    expect(content.html).toContain('src="cid:smartcar-logo"');
    expect(content.html).toContain('alt="SmartCar"');
  });

  it('escapes user-controlled values in the HTML version', () => {
    const content = buildQuoteEmailContent({
      customerName: '<img src=x onerror=alert(1)>',
      quoteNumber: 'Q&1',
      validUntil: '28.08.2026',
      officePhone: '09-9509757',
      officeEmail: 'office@smartcar.co.il',
    });

    expect(content.html).not.toContain('<img src=x');
    expect(content.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(content.html).toContain('Q&amp;1');
  });
});
