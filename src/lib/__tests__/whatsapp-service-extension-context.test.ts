import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation(locale: 'he' | 'en') {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => { throw new Error('Existing rental service must not create a new rental'); },
    readTurn: async () => ({ route: 'service', direction: 'none', reply: locale === 'en' ? 'Please send your booking reference.' : 'מה מספר ההזמנה?', fields: {}, source: 'gemini', model: 'test' }),
  };
  return (message: string) => getRebuiltBotReply('fictional-service-test', message, store);
}

describe('existing rental extension context and approval', () => {
  it('retains a corrected English extension with its reference and clearly answers approval plus price', async () => {
    const send = conversation('en');
    await send('Hi, I have a rental booking and may need to return the car two days later. Is that something I can arrange here?');
    const clarified = await send('My booking reference is 123456. Actually just one extra day, not two. Has the extension been approved, and will I be charged the same daily price?');
    expect(clarified.state.handoffKind).toBe('booking_change');
    expect(clarified.reply).toMatch(/not (?:yet )?(?:approved|confirmed)|only after.*confirm/i);
    expect(clarified.reply).toMatch(/price|rate|charge/i);
    expect(clarified.reply).not.toMatch(/please (?:send|provide).*reference|what is.*reference/i);
    expect(clarified.state.history.some(entry => entry.from === 'customer' && entry.text.includes('123456') && entry.text.includes('one extra day'))).toBe(true);
    const followup = await send('So should I assume I can return it tomorrow? I need a clear answer about approval and the price, not another reference request.');
    expect(followup.state.handoffKind).toBe('booking_change');
    expect(followup.reply).toMatch(/not (?:yet )?(?:approved|confirmed)|only after.*confirm/i);
    expect(followup.reply).toMatch(/price|rate|charge/i);
    expect(followup.reply).not.toMatch(/please (?:send|provide).*reference|what is.*reference/i);
  });

  it('keeps the analogous Hebrew service change distinct from a general service issue', async () => {
    const send = conversation('he');
    await send('יש לי הזמנת השכרה ואני אולי צריך להחזיר את הרכב יומיים מאוחר יותר. אפשר לסדר את זה כאן?');
    const clarified = await send('מספר ההזמנה שלי הוא 123456. בעצם רק יום נוסף ולא יומיים. האם ההארכה אושרה והמחיר היומי נשאר אותו מחיר?');
    expect(clarified.state.handoffKind).toBe('booking_change');
    expect(clarified.reply).toMatch(/לא אושר|רק לאחר.*אישור/);
    expect(clarified.reply).toMatch(/מחיר|עלות|תשלום/);
    expect(clarified.reply).not.toMatch(/מה מספר ההזמנה|שלחו.*מספר ההזמנה/);
    const followup = await send('אז להניח שאפשר להחזיר מחר? אני צריך תשובה ברורה לגבי האישור והמחיר, כבר מסרתי מספר הזמנה.');
    expect(followup.state.handoffKind).toBe('booking_change');
    expect(followup.reply).toMatch(/לא אושר|רק לאחר.*אישור/);
    expect(followup.reply).toMatch(/מחיר|עלות|תשלום/);
    expect(followup.reply).not.toMatch(/מה מספר ההזמנה|שלחו.*מספר ההזמנה/);
    expect(followup.state.history.some(entry => entry.from === 'customer' && entry.text.includes('123456') && entry.text.includes('יום נוסף'))).toBe(true);
  });
});
