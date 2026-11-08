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
  const draft = { pickupDate: '2026-11-09', returnDate: '2026-11-12', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב משפחתי', driverAgeRange: '24-plus' };
  it.each([
    ['en', "Okay, don't arrange a call yet. My colleague might drive it back for me instead. He's 25 but wasn't on the paperwork when I collected it. Can he just bring it back if I give him the keys, or does that cause a problem?", 'When you are free, let us know and we will be happy to check availability and extension options for you.'],
    ['he', 'סבבה אבל עוד לא החלטתי להאריך. אחי יכול להחזיר את הרכב במקומי אם הוא לא רשום?', 'אפשר לבדוק זמינות להארכה כשתהיו מוכנים.'],
    ['en', 'Sure, but I have another question about my return deadline first.', 'We can check availability for an extension.'],
  ] as const)('never treats a conversational service acknowledgement as rental consent: %s', async (locale, input, lastReply) => {
    const c = chat({ version: 2, phase: 'service', step: 'menu', locale, booking: {}, history: [{ from: 'bot', text: lastReply }] }, () => ({ ...base(locale === 'he' ? 'כל נהג צריך להיות רשום בחוזה לפני הנהיגה.' : 'Every driver must be registered on the agreement before driving.'), route: 'service' }));
    const result = await c.send(input);
    expect(result.state.phase).toBe('service');
    expect(result.state.step).toBe('menu');
    expect(result.reply).not.toMatch(/What date would you like to pick up|באיזה תאריך|מתי תרצו לאסוף/);
    expect(result.escalate).toBe(false);
    expect(c.create).not.toHaveBeenCalled();
  });
  it.each([
    'I already have the car, I am not picking up another one. I am asking whether my colleague can return the one I am using.',
    'This is about my existing booking. My question was about an additional driver, not new rental dates. Please answer that first.',
    'הרכב כבר אצלי, זו ההזמנה הקיימת. שאלתי אם אחי יכול להחזיר במקומי, לא על השכרה חדשה',
  ])('escapes an incorrect rental intake after an explicit existing-service correction: %s', async input => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_dates', locale: /[א-ת]/u.test(input) ? 'he' : 'en', booking: {}, history: [{ from: 'bot', text: 'What date would you like to pick up the car?' }] }, () => ({ ...base('The driver must be registered before driving.'), route: 'service' }));
    const result = await c.send(input);
    expect(result.state.phase).toBe('service');
    expect(result.reply).not.toContain('What date would you like to pick up');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('still allows an explicitly requested new rental from a service discussion', async () => {
    const c = chat({ version: 2, phase: 'service', step: 'menu', locale: 'en', booking: {}, history: [] }, () => ({ ...base('We can start a separate rental request.'), route: 'book' }));
    const result = await c.send('I want to rent a family car for a separate trip');
    expect(result.state.phase).toBe('booking');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('lets the current model interpretation escape intake without requiring a memorised correction phrase', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_dates', locale: 'en', booking: {}, history: [{ from: 'bot', text: 'What date would you like to pick up the car?' }] }, () => ({ ...base('An unregistered colleague must not drive it before being added to the agreement.'), route: 'service' }));
    const result = await c.send("That's not what I meant. We're talking about the one I'm driving around in, and whether Sam can take it back for me.");
    expect(result.state.phase).toBe('service');
    expect(result.reply).not.toContain('What date would you like to pick up');
    expect(result.escalate).toBe(false);
    expect(c.readTurn).toHaveBeenCalled();
    expect(c.create).not.toHaveBeenCalled();
  });
  it('allows Gemini to understand a compound acknowledgement instead of skipping the entire message', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [{ from: 'bot', text: 'Would you like us to check availability for a rental request?' }] }, () => ({ ...base('We can discuss the car you are currently using.'), route: 'service' }));
    const result = await c.send("Okay, but that's about the one I'm driving now, not collecting a different car.");
    expect(c.readTurn).toHaveBeenCalled();
    expect(result.state.phase).toBe('service');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('does not turn a reference volunteered with a policy question into a handoff', async () => {
    const c = chat({ version: 2, phase: 'service', step: 'menu', locale: 'en', booking: {}, history: [] }, () => ({ ...base('An additional driver must be registered before driving.'), route: 'service' }));
    const result = await c.send('My booking reference is 654321. Which licence does my friend need to bring to be added as a driver?');
    expect(result.state.serviceReference).toBe('654321');
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
    expect(c.create).not.toHaveBeenCalled();
  });
  it('answers the natural day-and-place question after a simulated submission without creating again', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, completedRequestId: 'SIM-EXISTING', completedRental: { ...draft }, history: [] }, () => base('No new action.'));
    const result = await c.send('רק לוודא, באיזה יום ומקום אני מחזיר בסוף? וכבר יש לי רכב סגור או שעוד מחכים להצעה?');
    expect(result.reply).toContain('הרצליה');
    expect(result.reply).toContain('12/11/2026');
    expect(result.reply).toContain('לא אושר רכב');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('keeps a voluntarily supplied rental name before intake and never creates from that disclosure', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { ...draft }, history: [] }, () => base('אפשר להמשיך לברר כאן.'));
    const supplied = await c.send('תתקדם עם מה שיש, קוראים לי איתי בדיקה ואין לי מייל לתת');
    expect(supplied.state.booking.customerName).toBe('איתי בדיקה');
    expect(supplied.state.step).toBe('rental_confirm');
    expect(supplied.reply).not.toContain('על איזה שם');
    expect(supplied.state.history.at(-2)?.private).toBe(true);
    expect(c.create).not.toHaveBeenCalled();
    await c.send('הביטוח כולל הכול?');
    expect(JSON.stringify(c.readTurn.mock.calls)).not.toContain('איתי בדיקה');
  });
  it('does not turn a name volunteered during advice into booking consent', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: { vehicleNeed: 'family car' }, history: [] }, () => base('You can continue comparing.'));
    const supplied = await c.send('My name is Alex Test. I am only comparing for now.');
    expect(supplied.state.booking.customerName).toBe('Alex Test');
    expect(supplied.state.phase).toBe('explore');
    expect(c.create).not.toHaveBeenCalled();
    expect(c.readTurn).not.toHaveBeenCalled();
  });
  it('accepts a natural name answer followed by a comma and a side comment', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_name', locale: 'he', booking: { ...draft }, history: [] }, () => base('נמשיך עם הפרטים.'));
    const result = await c.send('איתי בדיקה, כתבתי את זה קודם. בלי מייל בבקשה. אפשר כבר לראות את כל הפרטים?');
    expect(result.state.booking.customerName).toBe('איתי בדיקה');
    expect(result.state.step).toBe('rental_confirm');
    expect(c.readTurn).not.toHaveBeenCalled();
    expect(c.create).not.toHaveBeenCalled();
  });
  it.each(['חמישי', 'יום חמישי', 'Thursday', 'on Thursday', 'מחר'])('rejects a temporal legacy location proposal: %s', async day => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_confirm', locale: 'he', booking: { ...draft, customerName: 'Private Test' }, history: [] }, () => ({ ...base('החזרה בתאריך החדש.'), fields: { returnLocation: { value: day, evidence: day } } }));
    const result = await c.send(`אני מעדיף להחזיר ב${day}. האיסוף לא משתנה`);
    expect(result.state.booking.returnLocation).toBe('הרצליה');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('does not let a bare weekday answer fill a missing pickup city', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_locations', locale: 'en', booking: { pickupDate: draft.pickupDate, returnDate: draft.returnDate }, history: [{ from: 'bot', text: 'Where would you like to pick it up?' }] }, () => base('Where would you like to pick it up?'));
    expect((await c.send('Thursday')).state.booking.pickupLocation).toBeUndefined();
  });
  it('corrects the observed weekday-as-place error during final review without a model patch', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_confirm', locale: 'he', booking: { ...draft, returnLocation: 'חמישי', customerName: 'Private Test' }, history: [] }, () => base('הפרטים עודכנו.'));
    const result = await c.send('חמישי זה היום, לא המקום 😅 אני מחזיר בהרצליה כמו שאמרתי. ותשאיר משפחתית');
    expect(result.state.booking.returnLocation).toBe('הרצליה');
    expect(result.reply).toContain('החזרה: הרצליה');
    expect(result.reply).not.toContain('החזרה: חמישי');
    expect(result.state.booking).toMatchObject({ ...draft, customerName: 'Private Test' });
    expect(c.create).not.toHaveBeenCalled();
  });
  it('does not apply a negated present-tense return location', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_confirm', locale: 'he', booking: { ...draft, customerName: 'Private Test' }, history: [] }, () => base('הפרטים נשמרו.'));
    expect((await c.send('אני לא מחזיר בירושלים. רק שואל אם אפשר')).state.booking.returnLocation).toBe('הרצליה');
  });
  it.each(['אני אחזיר מחר.', 'אפשר להחזיר מחרתיים?'])('does not strip the first letter of a relative day into a city: %s', async input => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_confirm', locale: 'he', booking: { ...draft, customerName: 'Private Test' }, history: [] }, () => base('הפרטים נשמרו.'));
    expect((await c.send(input)).state.booking.returnLocation).toBe('הרצליה');
  });
  it('retains an explicitly open Hebrew vehicle choice instead of an old compact selection', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { vehicleNeed: 'רכב קומפקטי' }, history: [] }, input => ({ ...base('הבחירה עדיין פתוחה.'), factPatches: validateFactPatches([{ field: 'rentalVehicleCategory', operation: 'undecided', stance: 'selected', evidence: 'לא בחרתי סוג רכב' }], input) }));
    const result = await c.send('אני עוד לא בחרתי סוג רכב. קודם רוצה להבין את ההבדלים');
    expect(result.state.booking.vehicleNeed).toBe('סוג רכב פתוח להתאמה');
    expect(result.state.phase).toBe('explore');
    expect(c.create).not.toHaveBeenCalled();
  });
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
