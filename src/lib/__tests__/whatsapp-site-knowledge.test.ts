import { describe, expect, it } from 'vitest';
import { getSiteKnowledge, pageText } from '@/lib/whatsapp-site-knowledge';
import { safeAcknowledgement } from '@/lib/whatsapp-gemini';

describe('WhatsApp site knowledge', () => {
  it('always includes branches, FAQ and the office contact details', async () => {
    const text = await getSiteKnowledge();
    expect(text).toContain('הרצליה');
    expect(text).toContain('09-9509757');
    expect(text).toContain('מאיזה גיל ניתן לשכור רכב?');
  });

  it('extracts readable text from a page main element', () => {
    const html = '<html><head><script>x()</script></head><body><nav>menu</nav><main><h1>תנאים</h1><p>פיקדון&nbsp;₪1,000</p><style>.a{}</style></main></body></html>';
    expect(pageText(html)).toBe('תנאים\nפיקדון ₪1,000');
  });
});

describe('model reply guard', () => {
  const knowledge = 'פיקדון כלכלה ₪1,000. טלפון 09-9509757. אתר https://www.smartcar.co.il/he/terms';
  it('keeps numbers and links that come from the published site', () => {
    expect(safeAcknowledgement('הפיקדון לרכב כלכלי הוא ₪1,000. לפרטים: https://www.smartcar.co.il/he/terms', knowledge)).toContain('₪1,000');
    expect(safeAcknowledgement('אפשר להתקשר ל־09-9509757', knowledge)).toContain('09-9509757');
  });
  it('drops a reply with a number or link the site does not contain', () => {
    expect(safeAcknowledgement('הפיקדון הוא ₪700', knowledge)).toBe('');
    expect(safeAcknowledgement('ראו https://example.com', knowledge)).toBe('');
    expect(safeAcknowledgement('ההזמנה אושרה!', knowledge)).toBe('');
  });
});
