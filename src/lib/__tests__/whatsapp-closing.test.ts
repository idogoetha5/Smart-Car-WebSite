import { describe, expect, it } from 'vitest';
import { closingNotice } from '@/lib/whatsapp-closing';
import { CONVERSATION_MEMORY_MS } from '@/lib/whatsapp-flow';

describe('WhatsApp conversation memory', () => {
  it('keeps a conversation for 12 hours', () => {
    expect(CONVERSATION_MEMORY_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('warns warmly that the chat is about to close, in the customer language', () => {
    expect(closingNotice('he')).toContain('חצי שעה');
    expect(closingNotice('he')).toContain('נמשיך בדיוק מאיפה שעצרנו');
    expect(closingNotice('en')).toContain('half an hour');
  });
});
