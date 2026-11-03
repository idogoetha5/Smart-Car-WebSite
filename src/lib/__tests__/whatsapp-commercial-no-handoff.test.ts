import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM',
    readTurn: async () => ({ route: 'human', direction: 'none', reply: 'A representative will call.', fields: {}, source: 'gemini', model: 'misclassified-human' }),
  };
  return (message: string) => getRebuiltBotReply('fictional-no-handoff', message, store);
}

describe('explicit negated commercial handoff', () => {
  it('keeps the exact Hebrew preference/refusal advisory and allows a later positive request', async () => {
    const send = conversation();
    await send('אני רוצה לקנות רכב, תקציב 70000');
    const refused = await send('נראה לי שנעדיף משפחתי, אבל אני עוד לא בוחר דגם. אל תעביר לנציג עדיין, רק תשמור את הכיוון.');
    expect(refused.escalate).toBe(false);
    expect(refused.state.handedOff).not.toBe(true);
    expect(refused.state.humanHandoffDeferred).toBe(true);
    const comparison = await send('אל תשלח לנציג, מה ההבדל בין קטן למשפחתי?');
    expect(comparison.reply).toMatch(/קומפקטי/);
    expect(comparison.reply).toMatch(/משפחתית/);
    expect(comparison.escalate).toBe(false);
    const accepted = await send('עכשיו תעביר את הפרטים לנציג בבקשה.');
    expect(accepted.escalate).toBe(true);
    expect(accepted.state.humanHandoffDeferred).toBe(false);
    const deferredAgain = await send('אמרתי לא להעביר לנציג, אני רוצה להמשיך כאן.');
    expect(deferredAgain.escalate).toBe(false);
    expect(deferredAgain.state.handedOff).toBe(false);
    expect(deferredAgain.state.handoffAt).toBe(accepted.state.handoffAt);
    expect(deferredAgain.reply).toContain('הפנייה הקודמת עשויה כבר להיות אצל הצוות');
    expect(deferredAgain.reply).not.toContain('ביטלתי');
    const advice = await send('אפשר לראות רכב לפני שאני מחליט?');
    expect(advice.escalate).toBe(false);
    expect(advice.reply).not.toMatch(/נציג.*יחזור/);
  });

  it.each([
    'Do not pass this to a representative yet. What is included?',
    'Do not send the details to the team yet. What is included?',
    "Don't contact me yet. What is included?",
    "Don't call me yet. What is included?",
  ])('answers a same-turn question while respecting a negated English handoff: %s', async message => {
    const send = conversation();
    await send('I am considering leasing for two years, 15000 km annually, compact car.');
    const result = await send(message);
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
    expect(result.reply).toMatch(/included|cover|services|payment/i);
    expect(result.reply).not.toMatch(/representative will follow up/i);
  });

  it('answers a polite indefinite-car viewing question together with commitment clarification', async () => {
    const send = conversation();
    await send('I want to buy a car for city trips and two children at weekends. My budget is 70000 shekels.');
    const result = await send('A stroller and a couple of bags sometimes. Could I view a car before deciding, and does leaving my details here commit me to buy?');
    expect(result.reply).toContain('arrange a viewing');
    expect(result.reply).toContain('subject to availability');
    expect(result.reply).toContain('does not commit you');
    expect(result.escalate).toBe(false);
  });
});
