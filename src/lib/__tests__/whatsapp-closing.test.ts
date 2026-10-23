import { describe, expect, it } from 'vitest';
import { closingNotice, sendClosingNotices } from '@/lib/whatsapp-closing';

describe('conversation memory does not expire on inactivity', () => {
  it('never sends the retired automatic-deletion warning', async () => {
    await expect(sendClosingNotices()).resolves.toEqual({ checked: 0, sent: 0 });
  });
  it('does not falsely tell customers their details will be erased', () => {
    expect(closingNotice('he')).not.toMatch(/יימחקו|תיסגר|חצי שעה/);
    expect(closingNotice('en')).not.toMatch(/clear|close|half an hour/);
  });
});
