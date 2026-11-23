import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

function draft(history: RebuildState['history']): RebuildState {
  return {
    version: 2, phase: 'explore', step: 'menu', locale: 'he', history,
    booking: {
      pickupDate: '2026-12-01', returnDate: '2026-12-08',
      pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב משפחתי',
    },
  };
}

function conversation(initial: RebuildState, reading: BotReading | null = null) {
  let state: RebuildState | null = initial;
  const createRentalRequest = vi.fn(async () => 'SIM-REQUEST');
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest, readTurn: async () => reading,
  };
  return { send: (message: string) => getRebuiltBotReply('972500000000', message, store), createRentalRequest };
}

describe('live name-prompt rental dead end', () => {
  it('remembers an additional driver requested with the name and does not offer that extra again', async () => {
    const initial = draft([{ from: 'bot', text: 'על איזה שם לרשום את הבקשה?' }]);
    initial.booking.driverAgeRange = '21-23';
    const { send, createRentalRequest } = conversation(initial);
    const extras = await send('יואב כהן. אני כבר אמרתי שאני בן 23 ולא נהג חדש. אפשר לרשום גם את אשתי כנהגת נוספת.');
    expect(extras.state.booking.customerName).toBe('יואב כהן');
    expect(extras.state.booking.additionalDriver).toBe(true);
    expect(extras.reply).toMatch(/רשמתי גם נהג/u);
    expect(extras.reply).not.toMatch(/למשל נהג נוסף/u);
    const handoff = await send('לא, זה הכל. תעבירו לנציג בבקשה.');
    expect(handoff.escalate).toBe(true);
    expect(handoff.reply).toContain('תוספות שביקשתם: נהג נוסף');
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('retains an explicit Hebrew pickup even when Gemini extracts only the return branch', async () => {
    const initial = draft([{ from: 'bot', text: 'באילו תאריכים תרצו לקחת ולהחזיר את הרכב?' }]);
    delete initial.booking.pickupLocation;
    delete initial.booking.returnLocation;
    const { send } = conversation(initial, { route: 'book', direction: 'compact', reply: 'מאיפה תרצו לאסוף את הרכב?', fields: {
      returnLocation: { value: 'הרצליה', evidence: 'נחזיר בהרצליה' },
    }, source: 'gemini', model: 'gemini-3.5-flash-lite' });
    const result = await send('נאסוף בהרצליה ונחזיר בהרצליה. קומפקטי מתאים לנו.');
    expect(result.state.booking.pickupLocation).toBe('הרצליה');
    expect(result.state.booking.returnLocation).toBe('הרצליה');
    expect(result.reply).not.toMatch(/מאיפה תרצו לאסוף/u);
  });

  it('enters intake from a model-classified complete rental draft and accepts a bare name after its name prompt', async () => {
    const initial = draft([
      { from: 'customer', text: 'לא הקרוב, דווקא מיום שישי 11 בדצמבר עד יום ראשון 13 בדצמבר. נאסוף בהרצליה ונחזיר בהרצליה. קומפקטי נשמע טוב.' },
      { from: 'bot', text: 'מעולה, רשמתי את האיסוף וההחזרה בהרצליה מיום שישי 11 בדצמבר עד יום ראשון 13 בדצמבר עם רכב קומפקטי. איך תרצו שנקרא לכם?' },
    ]);
    initial.booking = { pickupDate: '2026-12-11', returnDate: '2026-12-13', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי', driverAgeRange: '21-23' };
    const { send, createRentalRequest } = conversation(initial, { route: 'book', direction: 'compact', reply: 'אפשר להוסיף נהג נוסף. תרצו להוסיף משהו?', fields: {}, source: 'gemini', model: 'gemini-3.5-flash-lite', groundedContext: true });
    const result = await send('נועה לוי. כן, אני בן 23 אבל לא נהג חדש. אפשר לצרף את אשתי כנהגת נוספת?');
    expect(result.state.phase).toBe('booking');
    expect(result.state.booking.customerName).toBe('נועה לוי');
    expect(result.state.step).toBe('rental_extras');
    expect(result.reply).toMatch(/רישיון בתוקף/u);
    expect(result.reply).toMatch(/להוסיף משהו/u);
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it.each([
    'תרצו שנתקדם בבדיקת תאריכים ומיקום איסוף לרכב?',
    'באיזה תאריכים מדויקים תרצו שנבדוק את האפשרות?',
  ])('starts rental intake after the invitation %s', async invitation => {
    const initial = draft([
      { from: 'customer', text: 'שלום, אנחנו זוג מתכננים סופ״ש בדצמבר ורוצים לשכור רכב. אני בן 23 ויש לי רישיון שלוש שנים.' },
      { from: 'bot', text: invitation },
    ]);
    initial.booking = { passengers: 2, luggage: 2, driverAgeRange: '21-23', vehicleNeed: 'רכב קומפקטי' };
    const { send, createRentalRequest } = conversation(initial, {
      route: 'book', direction: 'compact', reply: 'אפשר להוסיף נהג נוסף. באיזה שם תרצו לרשום את הפנייה?', fields: {
        pickupDate: { value: '2026-12-11', evidence: '11 בדצמבר' },
        returnDate: { value: '2026-12-13', evidence: '13 בדצמבר' },
        pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' },
        returnLocation: { value: 'הרצליה', evidence: 'בהרצליה' },
      }, source: 'gemini', model: 'gemini-3.5-flash-lite', groundedContext: true,
    });
    const result = await send('כן, נלך על קומפקטי. ניקח מהרצליה ביום שישי 11 בדצמבר ונחזיר בהרצליה ביום ראשון 13 בדצמבר. יש אפשרות לנהג נוסף?');
    expect(result.state.phase).toBe('booking');
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-12-11', returnDate: '2026-12-13', pickupLocation: 'הרצליה', returnLocation: 'הרצליה' });
    expect(result.reply).toMatch(/שם/u);
    expect(result.reply).not.toMatch(/חבילת כביש 6|תרצו להוסיף משהו/u);
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('accepts a labelled name with licence context after the name prompt and advances to the new-driver question', async () => {
    const initial = draft([{ from: 'bot', text: 'באיזה שם תרצו שנדאג לפתוח את הבקשה?' }]);
    initial.booking.driverAgeRange = '21-23';
    const { send, createRentalRequest } = conversation(initial);
    const result = await send('על שם נועה בדיקה. אני בן 23, יש לי רישיון כבר שלוש שנים. צריך עוד משהו כדי להעביר את הבקשה?');
    expect(result.state.booking.customerName).toBe('נועה בדיקה');
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_new_driver');
    expect(result.reply).toMatch(/נהג חדש/u);
    expect(result.reply).not.toMatch(/אפשר לשכור מגיל 21/u);
    expect(createRentalRequest).not.toHaveBeenCalled();
    const handedOff = await send('לא, אני לא נהג חדש. אפשר גם להוסיף נהג נוסף? אם כן אשמח שתעבירו לנציג.');
    expect(handedOff.state.booking.additionalDriver).toBe(true);
    expect(handedOff.reply).toContain('תוספות שביקשתם: נהג נוסף');
    expect(handedOff.reply).toContain('העברתי לנציג SmartCar');
    expect(handedOff.reply).not.toMatch(/GPS|אני מאשר|תנאי השימוש/u);
    expect(handedOff.escalate).toBe(true);
    expect(handedOff.state.completedRental).not.toHaveProperty('customerName');
    expect(handedOff.state.history.at(-1)?.private).toBe(true);
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('treats a bare name answering the bot as intake and asks only the missing age', async () => {
    const { send } = conversation(draft([{ from: 'bot', text: 'באיזה שם תרצו שהבקשה תהיה רשומה?' }]));
    const result = await send('שרון בדיקה');
    expect(result.state.booking.customerName).toBe('שרון בדיקה');
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_age');
    expect(result.reply).toMatch(/גיל|21–23|24/);
    expect(result.reply).not.toMatch(/משהו נוסף|עוד משהו/);
  });

  it('recovers a name and an already answered extras question, then hands off after the missing age', async () => {
    const { send, createRentalRequest } = conversation({
      ...draft([
        { from: 'bot', text: 'באיזה שם תרצו שהבקשה תהיה רשומה?' },
        { from: 'customer', text: 'שרון בדיקה' },
        { from: 'bot', text: 'האם תרצו להוסיף משהו נוסף?' },
        { from: 'customer', text: 'כיסא תינוק' },
        { from: 'bot', text: 'האם תרצו להוסיף משהו נוסף לפני שנשלח את הפרטים?' },
      ]),
      booking: { ...draft([]).booking, childSeats: 1 },
    });
    const continued = await send('לא, זה הכל');
    expect(continued.state.booking).toMatchObject({ customerName: 'שרון בדיקה', childSeats: 1 });
    expect(continued.state.step).toBe('rental_age');
    expect(continued.reply).not.toMatch(/משהו נוסף|עוד משהו/);
    expect(createRentalRequest).not.toHaveBeenCalled();

    const age = await send('אני בת 35');
    expect(age.state.step).toBe('menu');
    expect(age.reply).toContain('שרון בדיקה');
    expect(age.reply).toContain('כיסא/ות בטיחות');
    expect(age.reply).not.toMatch(/להוסיף משהו|משהו נוסף/u);
    expect(age.escalate).toBe(true);
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('asks for extras once, answers a side question, then summarizes after a no', async () => {
    const initial = draft([{ from: 'bot', text: 'על איזה שם לרשום את הבקשה?' }]);
    initial.booking.driverAgeRange = '24-plus';
    const { send, createRentalRequest } = conversation(initial);
    const extras = await send('על שם נועה בדיקה');
    expect(extras.state.step).toBe('rental_extras');
    expect(extras.reply).toMatch(/נהג נוסף|כביש 6/u);
    expect(extras.reply).not.toMatch(/GPS/u);
    const side = await send('מה עם ביטוח?');
    expect(side.escalate).toBe(false);
    expect(side.reply).toMatch(/ביטוח/u);
    expect(side.reply).not.toMatch(/תרצו להוסיף משהו/u);
    const final = await send('לא, בלי תוספות');
    expect(final.escalate).toBe(true);
    expect(final.reply).toMatch(/נועה בדיקה/u);
    expect(final.reply).toMatch(/העברתי לנציג/u);
    expect(createRentalRequest).not.toHaveBeenCalled();
  });

  it('asks which addition a bare yes means before handing off', async () => {
    const initial = draft([{ from: 'bot', text: 'על איזה שם לרשום את הבקשה?' }]);
    initial.booking.driverAgeRange = '24-plus';
    const { send } = conversation(initial);
    await send('על שם נועה בדיקה');
    const yes = await send('כן');
    expect(yes.escalate).toBe(false);
    expect(yes.reply).toMatch(/מה תרצו להוסיף/u);
    const final = await send('נהג נוסף');
    expect(final.state.booking.additionalDriver).toBe(true);
    expect(final.escalate).toBe(true);
  });
});
