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
  it('keeps the new-driver decline when Gemini asks for a name after the customer explicitly says they are new', async () => {
    const state: RebuildState = { version: 2, phase: 'booking', step: 'rental_locations', locale: 'he', history: [
      { from: 'customer', text: 'אני בן 22 וקיבלתי רישיון לפני חודש', private: false },
      { from: 'bot', text: 'להחזיר גם בהרצליה?', private: false },
    ], booking: {
      pickupDate: '2026-12-18', returnDate: '2026-12-21', pickupLocation: 'הרצליה',
      vehicleNeed: 'רכב משפחתי', driverAgeRange: '21-23',
    } };
    const createRentalRequest = vi.fn(async () => 'unexpected');
    const result = await getRebuiltBotReply('fictional-new-driver-stale-draft',
      'כן, גם להחזיר בהרצליה. ואני נהג חדש, הרישיון שלי מלפני חודש.', {
        isSimulation: true, loadState: async () => structuredClone(state), saveState: async () => {},
        activeBooking: async () => null, createRentalRequest,
        readTurn: async () => ({ route: 'book', direction: 'family', fields: {}, source: 'gemini', model: 'test', groundedContext: true,
          reply: 'מעולה, נחזיר גם בהרצליה. באיזה שם תרצו שנרשום את ההזמנה?' }),
      });
    expect(result.state.newDriverStatus).toBe('yes');
    expect(result.reply).toMatch(/אין לנו רכבים זמינים לנהגים חדשים בתאריכים/u);
    expect(result.reply).not.toMatch(/באיזה שם/u);
    expect(result.state.phase).toBe('explore');
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('lets Gemini phrase the unavailable-new-driver answer without changing its meaning or creating a request', async () => {
    const state: RebuildState = { version: 2, phase: 'booking', step: 'rental_new_driver', locale: 'he', history: [], booking: {
      pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: 'הרצליה', returnLocation: 'הרצליה',
      vehicleNeed: 'רכב משפחתי', driverAgeRange: '21-23', customerName: 'לקוח בדיקה',
    } };
    const createRentalRequest = vi.fn(async () => 'unexpected');
    const natural = 'אני מצטער, בתאריכים שביקשתם אין רכבים זמינים לנהגים חדשים.';
    const store: RebuildStore = { isSimulation: true, loadState: async () => structuredClone(state), saveState: async () => {},
      activeBooking: async () => null, createRentalRequest, readTurn: async () => null,
      rewordTurn: async () => ({ route: 'book', direction: 'none', fields: {}, source: 'gemini', model: 'test', reply: natural, rephrased: true }),
    };
    const answer = await getRebuiltBotReply('fictional-new-driver', 'כן, אני נהג חדש', store);
    expect(answer.reply).toBe(natural);
    expect(answer.state.newDriverStatus).toBe('yes');
    expect(answer.escalate).toBe(false);
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('accepts a natural new-driver answer with the eligibility before the unavailable car', async () => {
    const state: RebuildState = { version: 2, phase: 'booking', step: 'rental_new_driver', locale: 'he', history: [], booking: {
      pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: 'הרצליה', returnLocation: 'הרצליה',
      vehicleNeed: 'רכב משפחתי', driverAgeRange: '21-23', customerName: 'לקוח בדיקה',
    } };
    const natural = 'לנהגים חדשים לצערי לא נוכל להציע רכב בתאריכים שציינתם.';
    const result = await getRebuiltBotReply('fictional-new-driver', 'כן, אני נהג חדש', {
      isSimulation: true, loadState: async () => structuredClone(state), saveState: async () => {},
      activeBooking: async () => null, createRentalRequest: async () => { throw new Error('must not create request'); },
      readTurn: async () => null,
      rewordTurn: async () => ({ route: 'book', direction: 'none', fields: {}, source: 'gemini', model: 'test', reply: natural, rephrased: true }),
    });
    expect(result.reply).toBe(natural);
  });

  it('rejects a Gemini rewording that offers a car to an ineligible new driver', async () => {
    const state: RebuildState = { version: 2, phase: 'booking', step: 'rental_new_driver', locale: 'he', history: [], booking: {
      pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: 'הרצליה', returnLocation: 'הרצליה',
      vehicleNeed: 'רכב משפחתי', driverAgeRange: '21-23', customerName: 'לקוח בדיקה',
    } };
    const result = await getRebuiltBotReply('fictional-new-driver', 'כן, אני נהג חדש', {
      isSimulation: true, loadState: async () => structuredClone(state), saveState: async () => {},
      activeBooking: async () => null, createRentalRequest: async () => { throw new Error('must not create request'); },
      readTurn: async () => null,
      rewordTurn: async () => ({ route: 'book', direction: 'none', fields: {}, source: 'gemini', model: 'test',
        reply: 'כן, יש לנו רכב זמין לנהגים חדשים בתאריכים שביקשתם.', rephrased: true }),
    });
    expect(result.reply).toMatch(/אין לנו רכבים זמינים לנהגים חדשים/u);
    expect(result.reply).not.toMatch(/כן, יש לנו רכב זמין/u);
  });

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
    { turns: ["Hi, I'd like help with the Mazda 2", "I'm 22 and have had my licence for 18 months. I have no dates yet. What should I check about young-driver terms and the deposit?", "There are two of us with one small suitcase. I'm still comparing: is a compact sensible, or should I choose a family car? Please leave the dates open for now.", "Let's start a request for a compact car. Pick up in Tel Aviv on 10 December 2026 and return it to the same place on 12 December 2026. I'll be the driver, still age 22.", 'My name is Casey Demo. No email please. Actually, I choose a family car instead of the compact. Does that guarantee a particular model, or is it just the group?', 'No, I am not a new driver. Does that guarantee a particular model, or is it just the group?'], vehicle: 'family car', name: 'Casey Demo', place: 'Tel Aviv', conditional: /not guaranteed.*unless SmartCar explicitly confirms/i, bags: 'Bags: 1' },
    { turns: ['שלום, אשמח לעזרה לגבי Mazda 2', 'אני בן 22 עם רישיון שנה וחצי. אין לי עדיין תאריכים. מה צריך לבדוק לגבי נהג צעיר ופיקדון?', 'אנחנו שניים עם מזוודה קטנה אחת. אני עדיין משווה רכב קומפקטי או משפחתי? נשאיר את התאריכים פתוחים לעת עתה.', 'אני רוצה להתחיל בקשה לרכב קומפקטי. איסוף בתל אביב ב-10 בדצמבר 2026 והחזרה לאותו מקום ב-12 בדצמבר 2026. אני הנהג בן 22.', 'השם הוא קייסי בדיקה. בלי מייל. בעצם אבחר רכב משפחתי במקום הקומפקטי. האם זה מבטיח דגם ספציפי או רק הקטגוריה?', 'לא, אני לא נהג חדש. האם זה מבטיח דגם ספציפי או רק הקטגוריה?'], vehicle: 'רכב משפחתי', name: 'קייסי בדיקה', place: 'תל אביב', conditional: /אינו מובטח אלא אם SmartCar מאשרת/u, bags: 'מזוודות: 1' },
  ])('retains the exact customer changes and keeps identity out of the model: $name', async scenario => {
    const chat = conversation();
    let result;
    for (const turn of scenario.turns) result = await chat.send(turn);
    expect(result!.state.step).toBe('rental_extras');
    expect(result!.state.booking).toMatchObject({ vehicleNeed: scenario.vehicle, passengers: 2, luggage: 1, customerName: scenario.name, driverAgeRange: '21-23', pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: scenario.place, returnLocation: scenario.place });
    expect(result!.state.booking.customerEmail).toBeUndefined();
    expect(result!.reply).toMatch(scenario.conditional);
    expect(result!.escalate).not.toBe(true);
    const summary = await chat.send(/[א-ת]/u.test(scenario.name) ? 'לא, בלי תוספות' : 'No extras');
    expect(summary.reply).toContain(scenario.bags);
    expect(summary.reply).toContain('21–23');
    expect(summary.escalate).toBe(true);
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
