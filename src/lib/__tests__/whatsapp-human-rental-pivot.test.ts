import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat(seed: RebuildState | null = null) {
  let state = seed;
  const create = vi.fn(async () => 'SIM');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async input => ({ route: /להשכיר|ממחר|סניף|גיל|השם/.test(input) || state?.phase === 'booking' ? 'book' : /לקנות|משפחתית/.test(input) ? 'sale' : 'human', direction: 'none', fields: {}, reply: 'אפשר להמשיך לברר כאן.', source: 'gemini', model: 'test' }));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-human-pivot', input, store), create, readTurn };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T10:00:00Z')); });
afterEach(() => vi.useRealTimers());
describe('human sale-to-rental pivot', () => {
  it('starts rental intake from להשכיר and retains family needs instead of sale budget', async () => {
    const c = chat();
    await c.send('שלום, אני מעוניין לקנות רכב מהצי שלכם.');
    await c.send('מחפש משפחתית בסביבות 65 אלף שקלים, עם מקום לשני ילדים ועגלה.');
    const pivot = await c.send('אני רוצה להשכיר רכב בעצם');
    expect(pivot.state.phase).toBe('booking');
    expect(pivot.state.interest).toBeUndefined();
    const pivotContext = c.readTurn.mock.calls.find(call => call[0] === 'אני רוצה להשכיר רכב בעצם')?.[1];
    expect(pivotContext?.phase).toBe('booking');
    expect(pivotContext?.conversation?.interest).toBeUndefined();
    expect(pivotContext?.known.commercialBudget).toBeUndefined();
    expect(pivot.state.booking.vehicleNeed).toMatch(/משפחתי/);
    const dates = await c.send('ממחר עד 16/12');
    expect(dates.state.booking).toMatchObject({ pickupDate: '2026-11-07', returnDate: '2026-12-16' });
    await c.send('סניף הרצליה');
    const location = await c.send('באותו סניף');
    expect(location.state.booking).toMatchObject({ pickupLocation: 'הרצליה', returnLocation: 'הרצליה' });
    expect(location.state.step).toBe('rental_age');
    const details = await c.send('מה פרטי ההשכרה שלי? עכשיו ההזמנה שעשיתי איתך העברת אותה?');
    expect(details.reply).toContain('07/11/2026');
    expect(details.reply).toContain('16/12/2026');
    expect(details.reply).toContain('הרצליה');
    expect(details.reply).toMatch(/משפחתי/);
    expect(details.reply).toMatch(/טרם נשלחה|עדיין לא נשלחה/);
    expect(details.reply).toMatch(/קבוצת הגיל/);
    expect(details.escalate).toBe(false);
    expect(c.create).not.toHaveBeenCalled();
    const contacts = await c.send('אני בן 35. השם הוא רוני בדיקה, המייל שלי roni@example.invalid.');
    expect(contacts.state.booking).toMatchObject({ driverAgeRange: '24-plus', customerName: 'רוני בדיקה', customerEmail: 'roni@example.invalid' });
    expect(contacts.state.step).toBe('rental_confirm');
    expect(JSON.stringify(c.readTurn.mock.calls)).not.toMatch(/רוני בדיקה|roni@example.invalid/);
    const confirmed = await c.send('אני מאשר');
    expect(confirmed.state.completedRequestId).toBe('SIM');
    expect(c.create).toHaveBeenCalledTimes(1);
    const receipt = await c.send('תזכיר לי בבקשה את כל הפרטים המעודכנים, והאם הרכב כבר מובטח לי?');
    expect(receipt.reply).toContain('07/11/2026');
    expect(receipt.reply).toContain('16/12/2026');
    expect(receipt.reply).toContain('הרצליה');
    expect(receipt.reply).toMatch(/לא אושר רכב/);
    expect(receipt.reply).not.toMatch(/לאילו תאריכים|באיזה תאריך/);
    expect(receipt.state.phase).toBe('explore');
    expect((await c.send('אני מאשר')).state.completedRequestId).toBe('SIM');
    expect(c.create).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['he', 'אפשר סיכום של הבקשה?', /לא אושר רכב/],
    ['en', 'Could you recap the updated booking details? Is the car guaranteed?', /No real booking|no car was confirmed/],
    ['en', 'Please run through my rental details again.', /No real booking|no car was confirmed/],
  ] as const)('recalls a corrected sent snapshot without reopening intake: %s %s', async (locale, message, status) => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [], completedRequestId: 'SIM', completedRental: { pickupDate: '2026-11-07', returnDate: '2026-12-17', pickupLocation: 'Herzliya', returnLocation: 'Tel Aviv', vehicleNeed: 'family car', passengers: 4, luggage: 2 } });
    const result = await c.send(message);
    expect(result.reply).toContain('07/11/2026');
    expect(result.reply).toContain('17/12/2026');
    expect(result.reply).toContain('Tel Aviv');
    expect(result.reply).toMatch(status);
    expect(result.reply).not.toMatch(/What dates|לאילו תאריכים/);
    expect(result.state.booking).toEqual({});
    expect(c.create).not.toHaveBeenCalled();
    await c.send(locale === 'he' ? 'אפשר להסביר מה כולל הביטוח?' : 'Can you explain what insurance covers?');
    const context = c.readTurn.mock.calls.at(-1)?.[1];
    expect(context?.known).toMatchObject({ pickupDate: '2026-11-07', returnDate: '2026-12-17', pickupLocation: 'Herzliya', returnLocation: 'Tel Aviv', passengers: 4, luggage: 2 });
    expect(context?.conversation?.completedRequest).toBe(true);
  });
  it('handles the English sale-to-rental switch with both private contacts in one turn', async () => {
    const c = chat();
    await c.send('I want to buy a family car. My budget is 65000 shekels.');
    const switched = await c.send('Actually I want to rent a car instead. My name is Riley Demo. My email is riley@example.invalid.');
    expect(switched.state.phase).toBe('booking');
    expect(switched.state.interest).toBeUndefined();
    expect(switched.state.booking).toMatchObject({ vehicleNeed: 'family car', customerName: 'Riley Demo', customerEmail: 'riley@example.invalid' });
    const dates = await c.send('From tomorrow until 16 December 2026');
    expect(dates.state.booking).toMatchObject({ pickupDate: '2026-11-07', returnDate: '2026-12-16' });
    for (const aside of ['insurance', 'Thank you', 'yes please']) expect((await c.send(aside)).state.booking.pickupLocation).toBeUndefined();
    await c.send('Herzliya');
    const location = await c.send('The same branch');
    expect(location.state.booking).toMatchObject({ pickupLocation: 'Herzliya', returnLocation: 'Herzliya' });
    expect(JSON.stringify(c.readTurn.mock.calls)).not.toMatch(/Riley Demo|riley@example.invalid/);
  });
  it.each(['אני לא רוצה להשכיר רכב כרגע', 'אני רוצה להשכיר לכם את הרכב שלי'])('does not start renter intake for refusal or an owner offering their own car: %s', async message => {
    const c = chat();
    const result = await c.send(message);
    expect(result.state.phase).not.toBe('booking');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('does not save an I-am discussion statement as a customer name', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_name', locale: 'en', booking: { pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: 'Herzliya', returnLocation: 'Herzliya', vehicleNeed: 'family car', driverAgeRange: '24-plus' }, history: [{ from: 'bot', text: 'What name should I put on the request?' }] });
    expect((await c.send('I am still comparing.')).state.booking.customerName).toBeUndefined();
  });
  it.each([['explore', 'האם תרצה שנחבר אותך לנציג שיעבור איתך על פרטי ההשכרה שלך?'], ['explore', 'האם תרצה שנעביר את הפנייה לנציג כדי לעבור יחד על הנתונים?'], ['booking', 'האם תרצה שנחבר אותך לנציג שיעבור איתך על פרטי ההשכרה שלך?']] as const)('accepts yes to a real handoff offer once: %s %s', async (phase, offer) => {
    const c = chat({ version: 2, phase, step: phase === 'booking' ? 'rental_dates' : 'menu', locale: 'he', booking: {}, history: [{ from: 'bot', text: offer }] });
    const yes = await c.send('כן');
    expect(yes.escalate).toBe(true);
    expect(yes.state.handedOff).toBe(true);
    expect(yes.reply).not.toContain('האם תרצה');
  });
});
