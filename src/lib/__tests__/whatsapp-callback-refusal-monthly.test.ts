import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'SIM-MONTHLY');
  const readTurn = vi.fn(async () => null);
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-monthly-business', input, store), create, readTurn };
}

describe('callback refusal during business rental versus leasing discussion', () => {
  it('rejects an unrestricted exit promise and falls back to contract-based comparison without callback', async () => {
    let state: RebuildState | null = null;
    const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async () => ({ route: 'leasing', direction: 'none', fields: {}, source: 'gemini', model: 'test', groundedContext: true, reply: 'השכרה חודשית גמישה ומאפשרת סיום או החלפה בכל שלב לפי הצורך.' }));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('no request'); }, readTurn };
    const result = await getRebuiltBotReply('fictional-monthly-exit', 'אני צריך רכב לעובד חדש לשלושה חודשים. מתלבט בין השכרה חודשית לליסינג; לא רוצה שיחזרו אליי עדיין. מה ההבדל מבחינת התחייבות והוצאות?', store);
    expect(result.reply).toMatch(/בחוזה|בהצעה ובחוזה/);
    expect(result.reply).toMatch(/יציאה מוקדמת/);
    expect(result.reply).not.toContain('בכל שלב לפי הצורך');
    expect(result.escalate).toBe(false);
    expect(readTurn.mock.calls[1]?.[1].replyCorrection).toBe('unrestricted_exit');
  });
  it('answers the exact comparison and keeps six turns advisory until private rental intake', async () => {
    const chat = conversation();
    const first = await chat.send('אני צריך רכב לעובד חדש לשלושה חודשים. מתלבט בין השכרה חודשית לליסינג; לא רוצה שיחזרו אליי עדיין. מה ההבדל מבחינת התחייבות והוצאות?');
    expect(first.escalate).not.toBe(true);
    expect(first.state.humanHandoffDeferred).toBe(true);
    expect(first.reply).toMatch(/השכרה חודשית/u);
    expect(first.reply).toMatch(/ליסינג/u);
    expect(first.reply).toMatch(/התחייבות|חוזה/u);
    expect(first.reply).not.toMatch(/נציג SmartCar יחזור/u);
    const second = await chat.send('בינתיים רק משווה. הנהג בן 30 ונוסע בעיקר לעבודה. האם הביטוח והטיפולים תמיד כלולים? אל תתקשרו אליי.');
    const third = await chat.send('בעצם מעדיף השכרה חודשית למשך חודשיים ולא שלושה חודשים. אין לי עדיין תאריכים, אל תשאל עליהם שוב כרגע.');
    expect(third.state.interest).toBeUndefined();
    expect(third.state.booking.datePreference).toBeTruthy();
    expect(third.reply).not.toMatch(/באילו תאריכים|מה תאריך|לאילו תאריכים/u);
    const fourth = await chat.send('נבחר רכב משפחתי לשני נוסעים עם מזוודה אחת. אני עדיין לא רוצה שיחזרו אליי; רק שואל אם הדגם המדויק מובטח.');
    for (const result of [first, second, third, fourth]) {
      expect(result.escalate).not.toBe(true);
      expect(result.state.handedOff).not.toBe(true);
    }
    const fifth = await chat.send('עכשיו נתחיל בקשה לרכב משפחתי. איסוף מהרצליה ב-10 בדצמבר 2026 והחזרה לאותו מקום ב-10 בפברואר 2027. אני הנהג בן 30.');
    expect(fifth.state.step).toBe('rental_name');
    expect(fifth.state.durationClarification).not.toBe(true);
    const sixth = await chat.send('השם הוא רוני בדיקה. לא רוצה למסור מייל.');
    expect(sixth.state.step).toBe('rental_confirm');
    expect(sixth.state.booking).toMatchObject({ pickupDate: '2026-12-10', returnDate: '2027-02-10', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', driverAgeRange: '24-plus', customerName: 'רוני בדיקה' });
    expect(sixth.state.humanHandoffDeferred).toBe(true);
    expect(sixth.escalate).not.toBe(true);
    expect(chat.create).not.toHaveBeenCalled();
    expect(JSON.stringify(chat.readTurn.mock.calls)).not.toContain('רוני בדיקה');
  });

  it.each(['לא רוצה שיחזרו אליי עדיין', 'לא לחזור אלי כרגע', 'אל תתקשרו אליי', "don't call me back yet"])('honours callback refusal: %s', async refusal => {
    const chat = conversation();
    const result = await chat.send(`ליסינג לרכב משפחתי. ${refusal}.`);
    expect(result.escalate).not.toBe(true);
    expect(result.state.humanHandoffDeferred).toBe(true);
    expect(result.state.handedOff).not.toBe(true);
  });

  it('still permits an explicit later callback request and a real safety report', async () => {
    const chat = conversation();
    await chat.send('ליסינג לרכב משפחתי, לא רוצה שיחזרו אליי עדיין.');
    const requested = await chat.send('עכשיו שיחזרו אליי בבקשה לגבי הליסינג.');
    expect(requested.escalate).toBe(true);
    expect(requested.state.handedOff).toBe(true);
    const safetyChat = conversation();
    await safetyChat.send('ליסינג, אל תתקשרו אליי.');
    const incident = await safetyChat.send('עברתי עכשיו תאונה ברכב השכור ואין נפגעים.');
    expect(incident.source).toBe('safety');
    expect(incident.escalate).toBe(true);
  });
});
