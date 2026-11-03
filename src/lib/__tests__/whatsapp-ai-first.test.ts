import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading, GeminiBotContext } from '@/lib/whatsapp-rebuild-gemini';
import { termsConsent } from '@/lib/consent';

function reading(reply: string, route: BotReading['route'] = 'explore'): BotReading {
  return { route, direction: 'none', reply, fields: {}, source: 'gemini', model: 'gemini-3.5-flash-lite', groundedContext: true };
}

function chat(initial: RebuildState | null = null) {
  let state = initial;
  const create = vi.fn(async () => 'SIM-AI-FIRST');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async () => null);
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, value) => { state = structuredClone(value); },
    activeBooking: async () => null, createRentalRequest: create, readTurn,
  };
  return { send: (input: string) => getRebuiltBotReply('fictional-ai-first', input, store), create, readTurn };
}

function ready(): RebuildState {
  return { version: 2, locale: 'en', phase: 'booking', step: 'rental_confirm', requestKey: 'test-request', history: [], booking: {
    pickupDate: '2027-01-10', returnDate: '2027-01-13', pickupLocation: 'Herzliya', returnLocation: 'Tel Aviv',
    vehicleNeed: 'family car', driverAgeRange: '24-plus', customerName: 'Fictional Customer', passengers: 4, luggage: 2,
  } };
}

describe('grounded AI voice with application-owned rental actions', () => {
  it.each([
    'מעולה, מה שנותר הוא לאשר את שמות הנוסעים. מה שמות כל הנוסעים?',
    'מעולה, שמרנו את פרטי הנסיעה שציינת.',
  ])('keeps the next intake question application-owned when proceeding with a request: %s', async draft => {
    const session = chat({ version: 2, locale: 'he', phase: 'explore', step: 'menu', history: [], booking: { passengers: 4, luggage: 1 } });
    session.readTurn.mockResolvedValue(reading(draft, 'book'));
    const result = await session.send('בסדר, נבחר משפחתי ונתחיל בקשה. איסוף בתל אביב ב־10 בדצמבר 2026 והחזרה בנתבג ב־14 בדצמבר 2026. אני בן 35.');
    expect(result.reply).toBe('על איזה שם לרשום את הבקשה?');
    expect(result.source).toBe('local');
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_name');
    expect(result.state.booking).toMatchObject({ passengers: 4, luggage: 1, pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'תל אביב', returnLocation: 'נתבג', vehicleNeed: 'רכב משפחתי', driverAgeRange: '24-plus' });
    expect(result.state.booking.customerName).toBeUndefined();
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it.each([
    ['We are two adults with two children and a stroller. I do not know the dates yet. What would you recommend?', 'With children and a stroller, compare a family car for extra room against a compact for easier parking. Actual stroller fit depends on the model. Is the stroller foldable?'],
    ['אנחנו זוג עם שני ילדים ועגלה. עוד מתלבטים, מה כדאי?', 'לנסיעות בעיר קטן יכול להיות נוח לחניה, ולמשפחה עם עגלה משפחתית בדרך כלל מרווחת יותר. התאמת העגלה תלויה בדגם. העגלה מתקפלת?'],
  ])('shows the unique child/stroller draft exactly without converting advice into an order: %s', async (input, draft) => {
    const session = chat();
    session.readTurn.mockResolvedValue(reading(draft));
    const result = await session.send(input);
    expect(result.reply).toBe(draft);
    expect(result.source).toBe('gemini');
    expect(result.state.booking.passengers).toBe(4);
    expect(result.state.booking.vehicleNeed).toBeUndefined();
    expect(result.state.phase).toBe('explore');
    expect(result.escalate).not.toBe(true);
    expect(session.create).not.toHaveBeenCalled();
  });

  it('uses a numerical leasing draft and supplies corrected commercial facts plus deferred handoff', async () => {
    const session = chat();
    session.readTurn.mockResolvedValue(null);
    await session.send('I am considering leasing for 36 months and 12000 km per year. No representative yet please.');
    await session.send('Actually 24 months and 15000 km per year, budget 3000 shekels monthly.');
    const draft = 'For 24 versus 36 months, compare total payments and exit conditions for the same car and 15000 km annually. Your 3000 shekel budget is a target, and any quote still needs confirmation.';
    session.readTurn.mockResolvedValue(reading(draft, 'leasing'));
    const result = await session.send('What changes between 24 and 36 months?');
    expect(result.reply).toBe(draft);
    expect(result.source).toBe('gemini');
    const context: GeminiBotContext = session.readTurn.mock.calls.at(-1)![1];
    expect(context.approvedFacts?.map(fact => fact.id)).toEqual(expect.arrayContaining(['commercial_enquiry', 'vehicle_comparison', 'insurance']));
    expect(context.conversation).toMatchObject({ interest: 'leasing', handoffDeferred: true, completedRequest: false });
    expect(context.known).toMatchObject({ commercialTermMonths: 24, commercialAnnualMileageKm: 15000, commercialBudget: 3000 });
    expect(result.escalate).not.toBe(true);
    expect(session.create).not.toHaveBeenCalled();
  });

  it('answers a side question before the canonical consent summary without losing saved rental fields', async () => {
    const initial = ready();
    const session = chat(initial);
    const draft = 'Fuel is normally returned at the same level as at pickup. The rental agreement sets the applicable fuel terms.';
    session.readTurn.mockResolvedValue(reading(draft, 'policy'));
    const result = await session.send('Before I confirm, how does returning fuel work?');
    expect(result.reply.startsWith(`${draft}\n\nHere are your request details:`)).toBe(true);
    expect(result.reply).toContain(termsConsent('en').text);
    expect(result.reply).toContain('Dates: 10/01/2027–13/01/2027');
    expect(result.reply).toContain('Name: Fictional Customer');
    expect(result.reply).toContain('https://www.smartcar.co.il/en/terms');
    expect(result.source).toBe('gemini');
    expect(result.state.booking).toEqual(initial.booking);
    expect(session.create).not.toHaveBeenCalled();
    expect(session.readTurn.mock.calls[0][1].known).not.toHaveProperty('customerName');
  });

  it.each([
    'The price is 99 shekels, guaranteed.',
    'We have a car available for your dates.',
    'I have sent the request and your booking is confirmed.',
  ])('rejects a dangerous draft and preserves the same stable local response: %s', async draft => {
    const session = chat(ready());
    session.readTurn.mockResolvedValue(reading(draft, 'policy'));
    const result = await session.send('Before I confirm, what about fuel?');
    const baseline = await chat(ready()).send('Before I confirm, what about fuel?');
    expect(result.source).toBe('local');
    expect(result.reply).toBe(baseline.reply);
    expect(result.state.booking).toEqual(ready().booking);
    expect(session.create).not.toHaveBeenCalled();
    expect(result.escalate).not.toBe(true);
  });

  it('continues with saved facts when the provider returns null after a timeout', async () => {
    const initial = ready();
    initial.step = 'rental_age';
    delete initial.booking.driverAgeRange;
    const session = chat(initial);
    session.readTurn.mockResolvedValue(null);
    const result = await session.send('How does the fuel policy work?');
    expect(result.source).toBe('local');
    expect(result.state.booking).toEqual(initial.booking);
    expect(result.reply).not.toMatch(/what dates|where.*pick.up|how many passengers/i);
    expect(session.create).not.toHaveBeenCalled();
  });

  it('ignores an earlier advisory draft on final consent and creates the request once', async () => {
    const session = chat(ready());
    session.readTurn.mockResolvedValue(reading('I have sent the request and your booking is confirmed.', 'policy'));
    await session.send('Before I confirm, what about fuel?');
    session.readTurn.mockClear();
    const confirmed = await session.send('I confirm');
    expect(confirmed.state.completedRequestId).toBe('SIM-AI-FIRST');
    expect(confirmed.source).toBe('local');
    await session.send('I confirm');
    expect(session.readTurn).not.toHaveBeenCalled();
    expect(session.create).toHaveBeenCalledTimes(1);
  });
});
