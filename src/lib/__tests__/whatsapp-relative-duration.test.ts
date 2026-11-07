import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat(withLocationReading = false) {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'SIM-DURATION');
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn: async input => withLocationReading ? { route: 'explore', direction: 'none', fields: input.includes('מהרצליה') ? { pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' } } : {}, source: 'gemini', model: 'controlled-location-fixture', reply: 'האם תרצה שנתחיל להכין את פרטי הבקשה?' } : null };
  return { send: (input: string) => getRebuiltBotReply('fictional-relative-duration', input, store), create };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T09:00:00Z')); });
afterEach(() => vi.useRealTimers());
describe('explicit relative pickup plus chosen rental duration', () => {
  it('retains all selected facts through the complete failed live opening and private-name turn', async () => {
    const c = chat(true);
    for (const input of [
      'אהלן יש מצב לרכב כזה לכמה ימים? שלי נכנס למוסך ואני עוד לא יודע מתי יוציאו אותו',
      'אבל זה הקטע שאין לי תאריך להחזרה.. אני צריך להגיע לעבודה מחר. אולי אקח ליומיים ואז נראה? זה אפשרי או שאני מסתבך?',
      'אני בהרצליה. לא צריך איזה משהו מפואר רק שלא יהיה יקר. כמה בערך? ואשתי יכולה לנהוג גם או שצריך לעשות משהו בשביל זה?',
      'מחר כמו שאמרתי 🙂 בוא נלך על קטן ליומיים, מהרצליה ולהחזיר שם. רגע אשתי בת 23 ואני 31, זה משנה את מה שאמרת?',
    ]) await c.send(input);
    const result = await c.send('כן יאללה. קוראים לי איתי בדיקה. רק שלא תסגור לי משהו יקר בלי להגיד לי, אני רוצה קודם לדעת מה ההצעה');
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-11-08', returnDate: '2026-11-10', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי', driverAgeRange: '24-plus', customerName: 'איתי בדיקה' });
    expect(c.create).not.toHaveBeenCalled();
  });
  it.each([
    ['מחר כמו שאמרתי 🙂 בוא נלך על קטן ליומיים, מהרצליה ולהחזיר שם. רגע אשתי בת 23 ואני 31, זה משנה את מה שאמרת?', '2026-11-08', '2026-11-10'],
    ["Tomorrow, let's go with a compact car for two days, from Herzliya and return there.", '2026-11-08', '2026-11-10'],
    ['מחרתיים לשלושה ימים', '2026-11-09', '2026-11-12'],
    ['Today for one day', '2026-11-07', '2026-11-08'],
    ['I want to rent from tomorrow for 12 days.', '2026-11-08', '2026-11-20'],
  ])('derives both dates from supplied facts: %s', async (input, pickupDate, returnDate) => {
    const c = chat();
    expect((await c.send(input)).state.booking).toMatchObject({ pickupDate, returnDate });
    expect(c.create).not.toHaveBeenCalled();
  });
  it.each([
    'אולי אקח מחר ליומיים, עוד לא החלטתי.',
    'Maybe I will rent from tomorrow for two days.',
    'אני לא אקח מחר ליומיים.',
    'Can my wife be an additional driver tomorrow for two days?',
    'I need a car tomorrow but might keep it for two days.',
    'אני טס מחר ליומיים',
    'I am flying tomorrow for two days.',
  ])('does not turn uncertainty or another service duration into a chosen return: %s', async input => {
    expect((await chat().send(input)).state.booking.returnDate).toBeUndefined();
  });
  it('handles a year boundary using calendar arithmetic', async () => {
    vi.setSystemTime(new Date('2026-12-30T09:00:00Z'));
    expect((await chat().send('Tomorrow for two days')).state.booking).toMatchObject({ pickupDate: '2026-12-31', returnDate: '2027-01-02' });
  });
  it.each([
    ['אשתי בת 23 ואני 31', '24-plus'],
    ['My wife is aged 23 and I am 31', '24-plus'],
    ['אני בן 31 אבל הנהגת הראשית בת 23', '21-23'],
  ])('keeps the caller/main driver age distinct from another adult: %s', async (input, driverAgeRange) => {
    expect((await chat().send(input)).state.booking.driverAgeRange).toBe(driverAgeRange);
  });
  it('retains return-there wording without accepting its negation', async () => {
    const c = chat();
    await c.send('אני רוצה לשכור רכב קטן. איסוף בהרצליה מחר ליומיים');
    const declined = await c.send('לא להחזיר שם');
    expect(declined.state.booking.returnLocation).toBeUndefined();
    const accepted = await c.send('בעצם נחזיר שם');
    expect(accepted.state.booking.returnLocation).toBe('הרצליה');
  });
  it.each([
    'אני רוצה לשכור היום ליומיים. איסוף בהרצליה היום, החזרה בתל אביב מחרתיים.',
    'I want to rent today for two days. Pickup in Herzliya today, return in Tel Aviv day after tomorrow.',
  ])('keeps relative timing out of location values: %s', async input => {
    const result = await chat().send(input);
    expect(result.state.booking.pickupLocation).toBe(/[א-ת]/u.test(input) ? 'הרצליה' : 'Herzliya');
    expect(result.state.booking.returnLocation).toBe(/[א-ת]/u.test(input) ? 'תל אביב' : 'Tel Aviv');
  });
});
