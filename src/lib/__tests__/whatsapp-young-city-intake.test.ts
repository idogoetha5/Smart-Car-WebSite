import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'unexpected');
  const readTurn = vi.fn(async (input: string) => input.startsWith("Let's start a request") ? { route: 'book' as const, direction: 'compact' as const, fields: { pickupDate: { value: '2026-12-10', evidence: '10 December 2026' }, returnDate: { value: '2026-12-12', evidence: '12 December 2026' }, vehicleNeed: { value: 'compact car', evidence: 'compact car' } }, source: 'gemini' as const, model: 'regression-test', reply: 'What name should I put on the request?' } : null);
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-young-city', input, store), create, readTurn };
}

describe('young city renter keeps luggage and answers model questions during private intake', () => {
  it.each([false, true])('answers age and deposit together when the first model draft omits age; correction available=%s', async corrected => {
    let state: RebuildState | null = null;
    const complete = 'Rental starts at age 21, subject to vehicle and insurance terms. Young-driver charges and the deposit need checking in the agreement; pickup requires a valid credit card in your name.';
    const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async (_input, context) => ({ route: 'policy', direction: 'none', fields: {}, source: 'gemini', groundedContext: true, model: 'test', reply: corrected && context.replyCorrection ? complete : 'Pickup requires a valid credit card in your name. The agreement sets the final deposit.' }));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('no request'); }, readTurn };
    const result = await getRebuiltBotReply('fictional-age-deposit', "I'm 22 and have had my licence for 18 months. I only need short trips around Tel Aviv, but I don't have dates yet. Can I rent at my age, and are young-driver terms or the deposit different?", store);
    expect(result.reply).toMatch(/21/);
    expect(result.reply).toMatch(/deposit/i);
    expect(result.reply).toMatch(/insurance/i);
    expect(result.reply).not.toMatch(/What dates/i);
    expect(result.escalate).toBe(false);
    expect(readTurn.mock.calls[1]?.[1].replyCorrection).toBe('unanswered_age_terms');
    if (corrected) { expect(result.reply).toBe(complete); expect(result.source).toBe('gemini'); }
  });
  it.each([
    { turns: ["Hi, I'd like help with the Mazda 2", "I'm 22 and have had my licence for 18 months. I have no dates yet. What should I check about young-driver terms and the deposit?", "There are two of us with one small suitcase. I'm still comparing: is a compact sensible, or should I choose a family car? Please leave the dates open for now.", "Let's start a request for a compact car. Pick up in Tel Aviv on 10 December 2026 and return it to the same place on 12 December 2026. I'll be the driver, still age 22.", 'My name is Casey Demo. No email please. Actually, I choose a family car instead of the compact. Does that guarantee a particular model, or is it just the group?'], vehicle: 'family car', name: 'Casey Demo', place: 'Tel Aviv', conditional: /not guaranteed.*unless SmartCar explicitly confirms/i, bags: 'Bags: 1' },
    { turns: ['שלום, אשמח לעזרה לגבי Mazda 2', 'אני בן 22 עם רישיון שנה וחצי. אין לי עדיין תאריכים. מה צריך לבדוק לגבי נהג צעיר ופיקדון?', 'אנחנו שניים עם מזוודה קטנה אחת. אני עדיין משווה רכב קומפקטי או משפחתי? נשאיר את התאריכים פתוחים לעת עתה.', 'אני רוצה להתחיל בקשה לרכב קומפקטי. איסוף בתל אביב ב-10 בדצמבר 2026 והחזרה לאותו מקום ב-12 בדצמבר 2026. אני הנהג בן 22.', 'השם הוא קייסי בדיקה. בלי מייל. בעצם אבחר רכב משפחתי במקום הקומפקטי. האם זה מבטיח דגם ספציפי או רק הקטגוריה?'], vehicle: 'רכב משפחתי', name: 'קייסי בדיקה', place: 'תל אביב', conditional: /אינו מובטח אלא אם SmartCar מאשרת/u, bags: 'מזוודות: 1' },
  ])('retains the exact customer changes and keeps identity out of the model: $name', async scenario => {
    const chat = conversation();
    let result;
    for (const turn of scenario.turns) result = await chat.send(turn);
    expect(result!.state.step).toBe('rental_confirm');
    expect(result!.state.booking).toMatchObject({ vehicleNeed: scenario.vehicle, passengers: 2, luggage: 1, customerName: scenario.name, driverAgeRange: '21-23', pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: scenario.place, returnLocation: scenario.place });
    expect(result!.state.booking.customerEmail).toBeUndefined();
    expect(result!.reply).toMatch(scenario.conditional);
    expect(result!.reply).toContain(scenario.bags);
    expect(result!.reply).toContain('21–23');
    expect(result!.escalate).not.toBe(true);
    expect(chat.create).not.toHaveBeenCalled();
    expect(JSON.stringify(chat.readTurn.mock.calls)).not.toContain(scenario.name);
  });

  it.each(['one small suitcase', 'one medium bag', '1 large suitcase', 'one bag'])('records bounded singular luggage: %s', async luggage => {
    const result = await conversation().send(`We are two people with ${luggage}.`);
    expect(result.state.booking.luggage).toBe(1);
  });
  it.each(['We are not bringing one small suitcase.', "We don't have one medium bag.", 'We are without one suitcase.', 'We have one small bagel.', 'We have one medium suitcaseful.'])('does not replace a known count from negation or a noun prefix: %s', async input => {
    const chat = conversation();
    await chat.send('We are two people with three bags.');
    expect((await chat.send(input)).state.booking.luggage).toBe(3);
  });
});
