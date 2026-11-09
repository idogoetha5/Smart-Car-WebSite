import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

// Owner decisions, 2026-11-09: (1) a dashboard warning light goes straight to a representative,
// with no technical advice from the bot; (2) the bot does not discuss prices — the final price is
// set with a SmartCar representative.
function chat(initial: RebuildState | null, modelReply: string, locale: 'he' | 'en' = 'he') {
  let state = initial ?? ({ version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] } as RebuildState);
  const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: modelReply, source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-owner-rules', input, store), readTurn };
}

describe('warning light goes straight to a representative', () => {
  it.each([
    ['he', 'נדלקה לי נורה צהובה בלוח, מה זה אומר?'],
    ['he', 'נורת שמן נדלקה באמצע הנסיעה'],
    ['en', 'Hi, I am renting one of your cars and a yellow tyre pressure light just came on. Is it dangerous?'],
    ['en', 'check engine light is on in the rental'],
  ] as const)('hands off with the office number and no technical advice: %s', async (locale, input) => {
    const c = chat(null, 'Please inflate the tyres to the recommended pressure.', locale);
    const result = await c.send(input);
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('service_issue');
    expect(result.reply).toContain('09-9509757');
    expect(result.reply).not.toMatch(/inflate|לנפח|recommended pressure/);
    expect(c.readTurn).not.toHaveBeenCalled();
  });
  it('does not repeat the alert on a follow-up warning-light message', async () => {
    const c = chat(null, 'x');
    await c.send('נדלקה לי נורה צהובה בלוח');
    const again = await c.send('הנורה עדיין דלוקה, נדלקה שוב נורה אדומה בלוח');
    expect(again.escalate).toBe(false);
  });
  it.each(['מה קורה אם נדלקת נורה בזמן השכירות?', 'what if a warning light comes on during the rental?'])('keeps hypotheticals advisory: %s', async input => {
    const result = await chat(null, 'בזמן השכירות פנו לנציג.').send(input);
    expect(result.escalate).toBeFalsy();
  });
});

describe('no price talk', () => {
  it.each([
    'רכב קומפקטי יוצא בערך 250 ₪ ליום.',
    'Two small cars are usually cheaper than one large car.',
    'A compact costs around 300 NIS per day.',
  ])('rejects model price wording: %s', async modelReply => {
    const he = /[א-ת]/u.test(modelReply);
    const result = await chat(null, modelReply, he ? 'he' : 'en').send(he ? 'כמה בערך זה עולה ליום?' : 'how much is it roughly per day?');
    expect(result.reply).not.toBe(modelReply);
    expect(result.reply).toMatch(/נסגר סופית מול נציג SmartCar|final price is set with a SmartCar representative/);
  });
  it('still allows the approved indicative deposit', async () => {
    const reply = 'For a compact car, the indicative deposit is ₪1,500 on a credit card in the renter’s name.';
    const result = await chat(null, reply, 'en').send('how much is the deposit?');
    expect(result.reply).toBe(reply);
  });
});
