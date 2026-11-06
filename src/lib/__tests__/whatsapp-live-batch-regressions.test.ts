import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import { updateCommercialMemory, renderCommercialMemory } from '@/lib/whatsapp-commercial-memory';

function chat(initial: RebuildState | null = null) {
  let state = initial;
  const create = vi.fn(async () => 'SIM-BATCH');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'Can we continue?', source: 'gemini', model: 'test' }));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-live-batch', input, store), create, readTurn };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T12:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('independent live depth batch regressions', () => {
  it.each([
    ['he', 'אז איזה מספר הזמנה שמרת, ומה עוד כדאי להכין לשיחה עם הנציג?', /המיקום ותיאור קצר/],
    ['en', 'Which booking reference did you keep, and what should I have ready for the representative?', /location and a short description/],
  ] as const)('answers preparation as well as reference recall: %s', async (locale, input, preparation) => {
    const c = chat({ version: 2, phase: 'service', step: 'menu', locale, booking: {}, history: [], handedOff: true, handoffAt: new Date().toISOString(), handoffKind: 'safety', safetyKind: 'accident', serviceReference: '654321' });
    const result = await c.send(input);
    expect(result.reply).toContain('654321');
    expect(result.reply).toMatch(preparation);
    expect(result.escalate).toBe(false);
    expect(c.readTurn).not.toHaveBeenCalled();
  });

  it('starts natural Hebrew בקשת השכרה intake and keeps a later private name/route correction', async () => {
    const c = chat();
    await c.send('היי, אנחנו זוג ושני ילדים, הקטן בן שנתיים. צריכים רכב לכמה ימים, עוד לא סגרנו תאריכים. ניקח שתי מזוודות ועגלה. מה כדאי לקחת?');
    await c.send('חשבנו אולי על רכב קטן כי יהיה קל יותר לחנות. אבל עם העגלה ושתי המזוודות זה באמת מתאים או שעדיף משפחתית?');
    const started = await c.send('נלך על משפחתית. רוצה להתחיל בקשת השכרה: איסוף בירושלים ב־10/12/2026 והחזרה בתל אביב ב־14/12/2026. הנהג בן 32.');
    expect(started.state.phase).toBe('booking');
    expect(started.state.booking).toMatchObject({ pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'ירושלים', returnLocation: 'תל אביב', driverAgeRange: '24-plus' });
    await c.send('כן, נרצה כיסא בטיחות אחד לבן השנתיים. זה מובטח שיהיה מתאים? ומה לגבי ביטוח וביטול השתתפות עצמית?');
    const corrected = await c.send('כן, קוראים לי נועה בדיקה ואין לי מייל למסור. בעצם נחזיר בהרצליה ב־15/12/2026, האיסוף נשאר בירושלים ב־10/12/2026.');
    expect(corrected.state.step).toBe('rental_confirm');
    expect(corrected.state.booking).toMatchObject({ customerName: 'נועה בדיקה', returnDate: '2026-12-15', returnLocation: 'הרצליה', childSeats: 1 });
    expect(corrected.reply).toContain('נועה בדיקה');
    expect(corrected.reply).toContain('תנאי השימוש');
    expect(c.create).not.toHaveBeenCalled();
    expect(JSON.stringify(c.readTurn.mock.calls)).not.toContain('נועה בדיקה');
  });
  it('does not turn a refusal to start בקשת השכרה into intake', async () => {
    const result = await chat().send('אני לא רוצה להתחיל בקשת השכרה עכשיו, רק שואל על רכב משפחתי.');
    expect(result.state.phase).not.toBe('booking');
  });

  it.each([
    'החלטתי לבטל. מספר ההזמנה שלי 654321. בבקשה תעבירו בקשת ביטול לנציג, לא בקשת קיצור.',
    'I have decided to cancel. My booking reference is 654321. Please pass a cancellation request, not a shortening request.',
  ])('recognises decided cancellation without treating a rejected alternative as refusal: %s', async input => {
    const c = chat();
    const result = await c.send(input);
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('booking_change');
    expect(result.state.serviceReference).toBe('654321');
    expect(result.reply).toMatch(/ביטול|cancellation/i);
    expect(result.reply).toMatch(/אישור|confirmation/i);
  });
  it.each(['אם החלטתי לבטל, מה התנאים? עוד לא לבטל כלום.', 'If I decided to cancel, what would the terms be? Do not cancel yet.'])('keeps a hypothetical cancellation advisory: %s', async input => {
    expect((await chat().send(input)).escalate).toBe(false);
  });

  it('does not escalate an explicitly conditional extra-day correction', async () => {
    const c = chat();
    await c.send('Hi, my existing rental is due back tomorrow. I am thinking about keeping it two more days but have not decided. Does that need approval, and would the daily price stay the same?');
    await c.send('My booking reference is not handy right now. I am only asking about the rules: I should still plan to return tomorrow unless you explicitly approve an extension, correct?');
    const result = await c.send('Actually I would only need one extra day, not two, if I decide to go ahead. I am still comparing options, so no change request yet.');
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
    expect(result.reply).not.toMatch(/We have your change request/);
    expect(c.create).not.toHaveBeenCalled();
  });

  it.each(['בעיקר משפחה ונסיעות לעבודה.', 'For family use and commuting to work.'])('retains family and commuting separately from business use: %s', input => {
    let memory = updateCommercialMemory(undefined, input);
    for (let i = 0; i < 14; i++) memory = updateCommercialMemory(memory, 'What are the next steps?');
    expect(memory.usage).toEqual(expect.arrayContaining(['family', 'commuting']));
    expect(memory.usage).not.toContain('business');
    expect(renderCommercialMemory(memory, 'he')).toContain('נסיעות לעבודה');
  });
  it.each(['לא לנסיעות לעבודה.', 'Not commuting.'])('removes a declined commuting use while retaining family use: %s', input => {
    expect(updateCommercialMemory({ usage: ['family', 'commuting'] }, input).usage).toEqual(['family']);
    expect(updateCommercialMemory({ usage: ['commuting'] }, input).usage).toEqual([]);
  });
});
