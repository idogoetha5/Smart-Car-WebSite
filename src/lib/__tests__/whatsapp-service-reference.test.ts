import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => 'SIM-SERVICE',
    readTurn: async () => ({ route: 'service', direction: 'none', reply: 'Please send the booking reference.', fields: {}, source: 'gemini', model: 'service-test' }),
  };
  return (message: string) => getRebuiltBotReply('fictional-service', message, store);
}

describe('existing rental change follow-up memory', () => {
  it.each([
    ['Hello, I would like to pay the deposit for booking #654321', 'I have not paid yet. Which booking reference did you keep, and have you verified that any money was received?', /has not verified payment receipt/],
    ['שלום, אני רוצה לשלם מקדמה עבור ההזמנה שלי מספר #654321', 'מה מספר ההזמנה ששמרת? עדיין לא שילמתי, האם אימתת קבלת תשלום?', /אינה מאמתת קבלת תשלום/],
  ])('recalls a supplied reference independently of provider wording and payment status: %s', async (opening, followup, status) => {
    const send = chat();
    await send(opening);
    const result = await send(followup);
    expect(result.state.serviceReference).toBe('654321');
    expect(result.reply).toContain('654321');
    expect(result.reply).toMatch(status);
    expect(result.reply).not.toMatch(/Please send the booking reference|do not retain booking references/);
    expect(result.escalate).toBe(false);
  });
  it('retains an English reference through changed duration, approval and price questions', async () => {
    const send = chat();
    await send('I have an existing rental. I need to return the car two days later.');
    const handoff = await send('The booking reference is 123456. I want to extend it, not cancel.');
    expect(handoff.escalate).toBe(true);
    await send('Actually only one extra day, not two. Is the change already approved?');
    const price = await send('Will the extra day be the same price?');
    expect(price.reply).toContain('previous rate is not guaranteed');
    expect(price.reply).toContain('before confirming');
    const ready = await send('What should I have ready for the person reviewing it?');
    expect(ready.reply).toContain('Your booking reference is already included');
    expect(ready.reply).not.toContain('Please send your booking reference');
  });

  it('recognizes a Hebrew reference with הוא in later preparation advice', async () => {
    const send = chat();
    await send('אני רוצה להאריך את ההזמנה הקיימת ביום');
    await send('מספר ההזמנה שלי הוא 123456');
    const result = await send('מה כדאי להכין?');
    expect(result.reply).toContain('מספר ההזמנה כבר צורף');
    expect(result.reply).not.toContain('כדאי לשלוח את מספר ההזמנה');
  });
});
