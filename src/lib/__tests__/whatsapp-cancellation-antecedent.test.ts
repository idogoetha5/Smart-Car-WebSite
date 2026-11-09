import { describe, expect, it, vi } from 'vitest';
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
  it.each([
    ['הבנתי. כדי לקבל החזר צריך שאשלח כאן מספר אשראי מלא או קוד אבטחה?', 'he'],
    ['הביטול כבר אושר וההחזר בוצע, או שצריך לשלוח CVV או מספר אשראי?', 'he'],
    ['Do I need to send my full credit card number or security code to get a refund?', 'en'],
    ['Has cancellation been approved, and should I send a CVV or CVC for the refund?', 'en'],
  ] as const)('retains the conditional refund answer and adds the payment privacy warning: %s', async (input, locale) => {
    const create = vi.fn(async () => 'unexpected');
    const readTurn = vi.fn(async () => null);
    const state: RebuildState = { version: 2, phase: 'service', step: 'menu', locale, booking: {}, serviceReference: '654321', handedOff: true, handoffAt: new Date().toISOString(), handoffKind: 'booking_change', history: [{ from: 'customer', text: locale === 'he' ? 'אני רוצה לבטל את ההזמנה' : 'I want to cancel my booking' }] };
    const result = await getRebuiltBotReply('fictional-refund-privacy', input, {
      isSimulation: true, loadState: async () => state, saveState: async () => {}, activeBooking: async () => null,
      createRentalRequest: create, readTurn,
    });
    expect(result.source).toBe('local');
    expect(result.reply).toMatch(locale === 'he' ? /(?:אישור|אושר|לבדיקה|יבדוק|אוטומטית)/ : /confirm|review|automatically/i);
    expect(result.reply).toMatch(locale === 'he' ? /אין צורך לשלוח.{0,60}(?:אשראי|כרטיס)/ : /Do not send a full (?:credit )?card number/i);
    expect(result.reply).toMatch(/קוד אבטחה|security code|CVV|CVC/i);
    expect(result.reply).not.toMatch(/ההזמנה נשארת בתוקף|booking remains in effect/i);
    expect(result.state.serviceReference).toBe('654321');
    expect(create).not.toHaveBeenCalled();
    expect(readTurn).not.toHaveBeenCalled();
  });

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
    expect(fee.reply).toMatch(/תלויים בתנאי ההזמנה|הנציג יבדוק את ההזמנה ואת מועד הביטול בפועל/);
  });

  it('allows a cancellation correction to replace an earlier date-change handoff', async () => {
    const send = conversation();
    await send('יש לי הזמנה קיימת ואני רוצה לשנות את תאריך ההחזרה');
    const result = await send('לא שינוי. אני מבקש ביטול ההזמנה. מספר ההזמנה שלי הוא 654321. האם עכשיו זה מבוטל?');
    expect(result.reply).toContain('רשמתי בקשת ביטול');
    expect(result.reply).toContain('הביטול עדיין לא אושר במסגרת השיחה הזו');
    expect(result.reply).not.toContain('ההזמנה נשארת בתוקף');
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
