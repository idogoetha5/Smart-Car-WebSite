import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import { validateFactPatches } from '@/lib/whatsapp-fact-patch';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

function chat(initial: RebuildState | null, reading: (input: string) => BotReading) {
  let state = initial;
  const create = vi.fn(async () => 'SIM-FACTS');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async input => reading(input));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-fact-integration', input, store), create, readTurn };
}
const base = (reply: string): BotReading => ({ route: 'explore', direction: 'none', fields: {}, reply, source: 'gemini', model: 'controlled-evidenced-fixture', groundedContext: true });
const set = (field: string, evidence: string, value: object, stance = 'selected') => ({ field, operation: 'set', stance, evidence, value });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T09:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('evidenced understanding reaches canonical rental memory', () => {
  it('keeps the natural garage enquiry through selected duration/branches and yes plus name', async () => {
    const c = chat(null, input => ({ ...base(input.includes('מהרצליה') ? 'הזכאות והתנאים של נהג נוסף ייבדקו לפני אישור. האם תרצה שנתחיל להכין את פרטי הבקשה?' : 'אפשר להמשיך לברר כאן. איזה סוג רכב יתאים לכם?'),
      factPatches: input.includes('מהרצליה') ? validateFactPatches([
        set('rentalPickupBranch', 'מהרצליה ולהחזיר שם', { branch: 'herzliya' }),
        set('rentalReturnBranch', 'מהרצליה ולהחזיר שם', { branch: 'herzliya' }),
        set('rentalVehicleCategory', 'נלך על קטן', { category: 'compact' }),
      ], input) : [],
    }));
    for (const input of [
      'אהלן יש מצב לרכב כזה לכמה ימים? שלי נכנס למוסך ואני עוד לא יודע מתי יוציאו אותו',
      'אבל זה הקטע שאין לי תאריך להחזרה.. אני צריך להגיע לעבודה מחר. אולי אקח ליומיים ואז נראה? זה אפשרי או שאני מסתבך?',
      'אני בהרצליה. לא צריך איזה משהו מפואר רק שלא יהיה יקר. כמה בערך? ואשתי יכולה לנהוג גם או שצריך לעשות משהו בשביל זה?',
      'מחר כמו שאמרתי 🙂 בוא נלך על קטן ליומיים, מהרצליה ולהחזיר שם. רגע אשתי בת 23 ואני 31, זה משנה את מה שאמרת?',
    ]) await c.send(input);
    const result = await c.send('כן יאללה. קוראים לי איתי בדיקה. רק שלא תסגור לי משהו יקר בלי להגיד לי, אני רוצה קודם לדעת מה ההצעה');
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-11-09', returnDate: '2026-11-11', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי', driverAgeRange: '24-plus', customerName: 'איתי בדיקה' });
    expect(c.create).not.toHaveBeenCalled();
    expect(JSON.stringify(c.readTurn.mock.calls)).not.toContain('איתי בדיקה');
  });

  it('accepts a new evidenced SUV choice and revised total rather than requiring the old regex phrasing', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_confirm', locale: 'en', booking: { pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: 'Herzliya', returnLocation: 'Tel Aviv', vehicleNeed: 'compact car', passengers: 2, luggage: 1, driverAgeRange: '24-plus', customerName: 'Private Test' }, history: [] }, input => ({
      ...base('We can check space in the actual model before confirmation.'),
      factPatches: validateFactPatches([
        set('rentalVehicleCategory', "I'd take the SUV", { category: 'suv' }),
        set('rentalPassengers', 'five travellers in total', { number: 5 }),
        set('rentalLuggage', 'two bags', { number: 2 }),
      ], input),
    }));
    const result = await c.send("I'd take the SUV. Actually there will be five travellers in total and two bags.");
    expect(result.state.booking).toMatchObject({ vehicleNeed: 'SUV', passengers: 5, luggage: 2 });
    expect(result.reply).toContain('Passengers: 5');
    expect(result.reply).toContain('https://www.smartcar.co.il/en/privacy');
    expect(c.create).not.toHaveBeenCalled();
  });

  it.each(['What if we needed space for five passengers?', 'Can that car fit five passengers?'])('does not treat a discussion-only count proposal as a correction: %s', async input => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: { passengers: 2 }, history: [] }, input => ({ ...base('Suitability depends on the actual model.'), factPatches: validateFactPatches([set('rentalPassengers', 'five passengers', { number: 5 }, 'hypothetical')], input) }));
    const result = await c.send(input);
    expect(result.state.booking.passengers).toBe(2);
    expect(result.escalate).toBe(false);
    expect(c.create).not.toHaveBeenCalled();
  });

  it('keeps service advice non-actionable even when the model classifies human', async () => {
    const c = chat({ version: 2, phase: 'service', step: 'menu', locale: 'en', booking: {}, history: [] }, () => ({ ...base('Any extension needs prior approval and may change the price.'), route: 'human', factPatches: [] }));
    const result = await c.send('If I needed another day, would the rate stay the same? No change request yet.');
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
    expect(c.create).not.toHaveBeenCalled();
  });

  it('retains an evidenced word budget when a later what-if contains a different number', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, interest: 'sale', history: [] }, input => ({ ...base('We can keep discussing the options.'), route: 'sale', factPatches: validateFactPatches([set('commercialBudget', 'My budget is sixty thousand shekels', { number: 60000, currency: 'ILS' })], input) }));
    const original = await c.send("My budget is sixty thousand shekels, maybe a bit less if possible. I don't want a callback yet.");
    expect(original.state.commercial?.budget?.amount).toBe(60000);
    const hypothetical = await c.send("And if I could stretch the budget to 90000 shekels, would an SUV be worth considering? That's a what-if — keep my original budget for now.");
    expect(hypothetical.state.commercial?.budget?.amount).toBe(60000);
    expect(hypothetical.escalate).toBe(false);
  });
});
