import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

const base: BotReading = { route: 'explore', direction: 'none', reply: 'אפשר להתאים לכם רכב של SmartCar. לאילו תאריכים תצטרכו אותו?', fields: {}, source: 'gemini', model: 'gemini-3.5-flash-lite' };

function memory(reading: (message: string) => BotReading | null = () => base) {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'SIM-123');
  const readTurn = vi.fn(async (message: string) => reading(message));
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: create,
    readTurn,
  };
  const send = (message: string) => getRebuiltBotReply('fictional', message, store);
  return { send, create, readTurn, state: () => state };
}

describe('replacement SmartCar conversation core', () => {
  it('treats a rental question as exploration, not booking consent', async () => {
    const chat = memory(() => ({ ...base, route: 'book', direction: 'compact' }));
    const result = await chat.send('כדאי לי לשכור רכב לפגישות בירושלים?');
    expect(result.state.phase).toBe('explore');
    expect(result.reply).not.toMatch(/מה השם|מייל/);
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('answers a daily-price question without inventing a final quote or starting a request', async () => {
    const chat = memory(() => ({ ...base, reply: 'המחיר הסופי הוא 250 ₪ ליום.' }));
    const result = await chat.send('כמה זה עולה ליום?');
    expect(result.reply).toContain('המחיר באתר הוא הערכה');
    expect(result.reply).not.toContain('250');
    expect(result.state.phase).toBe('explore');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('does not treat a bare yes or an explicit refusal as booking consent', async () => {
    const chat = memory(() => ({ ...base, route: 'book' }));
    await chat.send('אני מתלבט על רכב לסופ״ש');
    const yes = await chat.send('כן');
    expect(yes.state.phase).toBe('explore');
    const no = await chat.send('רק מתעניין, לא רוצה להזמין עכשיו');
    expect(no.state.phase).toBe('explore');
    expect(no.reply).toContain('לא שלחתי בקשה');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('gives positive SmartCar advice without repeating an outside option', async () => {
    const chat = memory(() => ({ ...base, reply: 'מונית תהיה זולה יותר.' }));
    const result = await chat.send('יש לי שתי פגישות בירושלים. אולי אגיע במונית, למה כדאי לשכור אצלכם?');
    expect(result.source).toBe('local');
    expect(result.reply).toContain('SmartCar');
    expect(result.reply).not.toMatch(/מונית|אוטובוס|רכבת|מתחר/);
  });

  it('does not make a child-seat fit promise or put it in the boot', async () => {
    const chat = memory(() => ({ ...base, direction: 'family', reply: 'משפחתית תספיק בוודאות לכיסא הבטיחות.' }));
    const result = await chat.send('אנחנו זוג עם תינוק וכיסא בטיחות לטיול בצפון. מה מתאים?');
    expect(result.reply).toContain('משפחתית');
    expect(result.reply).toMatch(/התאמת כיסא הבטיחות צריך לוודא/);
    expect(result.reply).not.toMatch(/בוודאות|לתא המטען.*כיסא/);
  });

  it('routes a real brake concern to safety without model or sales', async () => {
    const chat = memory();
    const result = await chat.send('שכרתי אתמול והרכב עושה רעש חזק בבלמים. להמשיך לנסוע?');
    expect(result.source).toBe('safety');
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('אל תמשיכו לנסוע');
    expect(chat.readTurn).not.toHaveBeenCalled();
  });

  it('retains booking facts and requires explicit confirmation before a request', async () => {
    const chat = memory(message => {
      if (message.includes('להזמין')) return { ...base, route: 'book', direction: 'compact', fields: {
        pickupDate: { value: '2026-10-26', evidence: 'מחר' }, returnDate: { value: '2026-10-28', evidence: 'יום רביעי' },
        pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' }, returnLocation: { value: 'הרצליה', evidence: 'לאותו מקום' },
        vehicleNeed: { value: 'קומפקטי', evidence: 'רכב קטן' },
      } };
      return { ...base, route: 'book' };
    });
    const first = await chat.send('אני רוצה להזמין רכב קטן מחר מהרצליה עד יום רביעי, ולהחזיר לאותו מקום.');
    expect(first.state.phase).toBe('booking');
    expect(first.state.booking).toMatchObject({ pickupDate: '2026-10-26', returnDate: '2026-10-28', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'קומפקטי' });
    expect(first.state.requestKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.reply).toMatch(/שם/);
    expect(first.reply).not.toContain('מחיר וזמינות');
    expect(chat.create).not.toHaveBeenCalled();
    const second = await chat.send('קוראים לי דניאל כהן');
    expect(second.state.requestKey).toBe(first.state.requestKey);
    expect(second.reply).toMatch(/מייל/);
    const third = await chat.send('daniel@example.com');
    expect(third.reply).toMatch(/אני מאשר/);
    expect(third.reply).toContain('קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות של SmartCar.');
    expect(third.reply).toContain('https://www.smartcar.co.il/he/terms');
    expect(chat.create).not.toHaveBeenCalled();
    await chat.send('אני מאשר');
    expect(chat.create).toHaveBeenCalledTimes(1);
    expect(chat.state()?.completedRequestId).toBe('SIM-123');
    expect(chat.state()?.booking).toEqual({});
  });

  it('does not send name and email collection turns to Gemini', async () => {
    const chat = memory(() => ({ ...base, route: 'book', fields: { pickupDate: { value: '2026-10-26', evidence: 'מחר' }, returnDate: { value: '2026-10-28', evidence: 'רביעי' }, pickupLocation: { value: 'הרצליה', evidence: 'בהרצליה' }, returnLocation: { value: 'הרצליה', evidence: 'אותו מקום' }, vehicleNeed: { value: 'משפחתית', evidence: 'משפחתית' } } }));
    await chat.send('אני רוצה להזמין משפחתית מחר עד רביעי, איסוף בהרצליה והחזרה באותו מקום.');
    const calls = chat.readTurn.mock.calls.length;
    await chat.send('דניאל כהן');
    await chat.send('daniel@example.com');
    expect(chat.readTurn).toHaveBeenCalledTimes(calls);
  });

  it('ignores a model field without direct customer evidence', async () => {
    const chat = memory(() => ({ ...base, fields: { pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' }, childSeats: { value: '2', evidence: 'שני כיסאות' } } }));
    const result = await chat.send('אנחנו נוסעים צפונה עם מזוודה.');
    expect(result.state.booking.pickupLocation).toBeUndefined();
    expect(result.state.booking.childSeats).toBeUndefined();
  });

  it('rejects impossible or reversed dates before they reach a rental request', async () => {
    const chat = memory(() => ({ ...base, route: 'book', fields: {
      pickupDate: { value: '2026-10-28', evidence: 'רביעי' },
      returnDate: { value: '2026-10-26', evidence: 'שני' },
    } }));
    const result = await chat.send('אני רוצה להזמין מרביעי עד שני');
    expect(result.state.booking.pickupDate).toBe('2026-10-28');
    expect(result.state.booking.returnDate).toBeUndefined();
    expect(result.reply).toMatch(/תאריך תחזירו/);
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('has a useful bounded fallback when Gemini is unavailable', async () => {
    const chat = memory(() => null);
    const result = await chat.send('אני צריך רכב לפגישות בתל אביב מחר');
    expect(result.source).toBe('local');
    expect(result.reply).toContain('SmartCar');
    expect(result.reply).toMatch(/תאריכים/);
  });

  it('answers a service policy from published facts', async () => {
    const chat = memory(() => ({ ...base, route: 'policy' }));
    const result = await chat.send('מה מדיניות הדלק שלכם?');
    expect(result.reply).toContain('מלא־מלא');
    expect(result.reply).not.toMatch(/תאריכים|להזמין/);
  });

  it('uses published airport pickup terms even when Gemini treats the question as exploration', async () => {
    const chat = memory(() => ({ ...base, route: 'explore', reply: 'Airport pickup is available for your trip.' }));
    const result = await chat.send('Can I pick it up at the airport?');
    expect(result.reply).toContain('subject to advance coordination and availability');
    expect(result.reply).not.toContain('is available for your trip');
  });
});
