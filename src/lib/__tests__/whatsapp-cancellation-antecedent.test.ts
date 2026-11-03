import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM',
    readTurn: async () => ({ route: 'service', direction: 'none', reply: '', fields: {}, source: 'gemini', model: 'service-test' }),
  };
  return (message: string) => getRebuiltBotReply('fictional-cancel', message, store);
}

describe('cancellation object before cancel and corrections after handoff', () => {
  it('routes the exact Hebrew existing-booking cancel-it request and keeps outcome/refund conditional', async () => {
    const send = conversation();
    const first = await send('יש לי הזמנה קיימת ואני רוצה לבטל אותה, לא לשנות תאריכים. מה צריך לעשות?');
    expect(first.reply).toContain('מספר ההזמנה');
    expect(first.escalate).toBe(false);
    const reference = await send('לא שינוי. אני מבקש ביטול ההזמנה. מספר ההזמנה שלי הוא 654321. האם עכשיו זה מבוטל?');
    expect(reference.reply).toContain('בקשת ביטול');
    expect(reference.reply).toContain('עדיין לא אושר');
    expect(reference.escalate).toBe(true);
    const refund = await send('והכסף יוחזר אוטומטית? אני לא רוצה לעשות הזמנה חדשה, רק לבטל את הקיימת.');
    expect(refund.reply).toContain('אינם מתבצעים אוטומטית');
    expect(refund.reply).not.toContain('בקשת השינוי');
    const fee = await send('יש עלות או דמי ביטול?');
    expect(fee.reply).toContain('תלויים בתנאי ההזמנה');
  });

  it('allows a cancellation correction to replace an earlier date-change handoff', async () => {
    const send = conversation();
    await send('יש לי הזמנה קיימת ואני רוצה לשנות את תאריך ההחזרה');
    const result = await send('לא שינוי. אני מבקש ביטול ההזמנה. מספר ההזמנה שלי הוא 654321. האם עכשיו זה מבוטל?');
    expect(result.reply).toContain('רשמתי בקשת ביטול');
    expect(result.reply).toContain('ההזמנה נשארת בתוקף');
  });

  it('recognizes English cancel-it after an existing booking antecedent', async () => {
    const send = conversation();
    const result = await send('I have an existing booking and I want to cancel it, not change dates.');
    expect(result.reply).toContain('cancellation request');
    expect(result.reply).toContain('booking reference');
    const reference = await send('My booking reference is 654321.');
    expect(reference.reply).toContain('cancellation');
  });

  it.each([
    'אני לא רוצה לבטל את ההזמנה, רק לשנות את יום ההחזרה',
    'I do not want to cancel my booking, I want to extend the return date.',
  ])('respects an explicit refusal to cancel: %s', async message => {
    const result = await conversation()(message);
    expect(result.reply).not.toMatch(/בקשת הביטול|cancellation request/i);
  });
});
