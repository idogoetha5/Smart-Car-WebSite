import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

// Live Chrome failure on 39c3a4d, 2026-11-09 (evidence/20261109-chrome-en-tyre-extension.md):
// an explicit "go ahead and ask for the extra day" and a follow-up "yes, that's
// literally what I asked" looped on "would you like us to check availability?".
function chat(initial: RebuildState, reply: string) {
  let state: RebuildState | null = initial;
  const create = vi.fn(async () => 'SIM');
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create,
    readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply, source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
  return { send: (input: string) => getRebuiltBotReply('fictional-extension', input, store), create };
}
const offer = 'Extending requires an availability check. Would you like us to check availability for that extra day now?';
const service = (locale: 'he' | 'en', lastBot: string): RebuildState => ({ version: 2, phase: 'service', step: 'menu', locale, booking: {}, serviceReference: '778812', serviceChangeRequested: false,
  history: [{ from: 'customer', text: locale === 'en' ? 'My flight moved, I might need the car one more day.' : 'הטיסה זזה, אולי אצטרך עוד יום.' }, { from: 'bot', text: lastBot }] });

describe('explicit extension request in an existing rental', () => {
  it.each([
    ['en', "Booking number is 778812. Please go ahead and ask for the extra day, I'm sure I need it now."],
    ['en', 'Go ahead with the extension please.'],
    ['en', 'Please add one more day to my rental.'],
    ['he', 'מספר הזמנה 778812. תבקשו לי עוד יום, אני כבר בטוח שאני צריך.'],
    ['he', 'קדימה, תגישו בקשת הארכה.'],
  ] as const)('queues the change once for review without approving it: %s', async (locale, input) => {
    const c = chat(service(locale, 'Extensions need confirmation.'), offer);
    const result = await c.send(input);
    expect(result.state.serviceChangeRequested).toBe(true);
    expect(result.escalate).toBe(true);
    expect(result.reply).not.toMatch(/Would you like us to check availability/);
    const followup = await c.send(locale === 'en' ? 'So is it confirmed then? And is it the same daily rate?' : 'אז זה מאושר? ובאותו מחיר ליום?');
    expect(followup.escalate).toBe(false);
    expect(followup.reply).toMatch(/not (?:yet )?(?:been )?approved|not approved|לא אושר/);
    expect(c.create).not.toHaveBeenCalled();
  });
  it.each(["Yes that's literally what I just asked. So is it confirmed then?", 'כן, זה בדיוק מה שביקשתי'])('accepts an insistent yes to an explicit availability-check offer: %s', async input => {
    const c = chat(service(/[א-ת]/u.test(input) ? 'he' : 'en', offer), offer);
    const result = await c.send(input);
    expect(result.state.serviceChangeRequested).toBe(true);
    expect(result.reply).toMatch(/not (?:yet )?(?:been )?approved|not approved|לא אושר|לאחר אישור|ואישור SmartCar|review|לבדיקה|נציג|representative/);
  });
  it.each([
    'What if I ask for an extra day, how much would it be?',
    "I don't want to request an extra day yet, just asking.",
    'אם אבקש עוד יום כמה זה יעלה?',
  ])('keeps hypothetical or declined extra-day wording advisory: %s', async input => {
    const c = chat(service(/[א-ת]/u.test(input) ? 'he' : 'en', 'Extensions need confirmation.'), 'An extension depends on availability and may change the rate.');
    const result = await c.send(input);
    expect(result.state.serviceChangeRequested).toBe(false);
    expect(result.escalate).toBe(false);
  });
  it('does not treat a yes to a generic availability remark as a change request', async () => {
    const c = chat(service('en', 'Availability changes during holidays.'), 'Availability changes during holidays.');
    const result = await c.send('Yes, that is what I said');
    expect(result.state.serviceChangeRequested).toBe(false);
  });
});

// Live Chrome failure on 39c3a4d, 2026-11-09 (evidence/20261109-chrome-he-advice-no-rep.md):
// "אני לא צריך נציג, רק דעה" escalated to a representative on the first turn.
describe('declining a representative while asking for advice', () => {
  it.each([
    ['he', 'שלום, אני סתם מנסה להבין משהו לפני שאני מחליט. אנחנו חושבים על חופשה בצפון בחנוכה, ארבעה מבוגרים. עדיף לשכור רכב אחד גדול או שני קטנים? אני לא צריך נציג, רק דעה'],
    ['he', 'אין צורך בנציג, רק תגיד לי מה עדיף'],
    ['en', "I don't need a representative, just your opinion: one big car or two small ones for four adults?"],
  ] as const)('answers without a handoff: %s', async (locale, input) => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'explore', direction: 'none', fields: {}, reply: locale === 'he' ? 'לארבעה מבוגרים כדאי להשוות רכב משפחתי אחד מול שני רכבים קטנים לפי מזוודות ומסלול.' : 'For four adults, compare one family car with two small cars by luggage and route.', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const result = await getRebuiltBotReply('fictional-advice', input, store);
    expect(result.escalate).toBeFalsy();
    expect(result.state.handedOff).toBeFalsy();
    expect(result.reply).not.toMatch(/נציג SmartCar יחזור|representative will follow up/);
  });
  it.each(['אני צריך נציג בבקשה', 'I need a representative please'])('still honours a real request for a person: %s', async input => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'human', direction: 'none', fields: {}, reply: 'OK', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const result = await getRebuiltBotReply('fictional-advice-human', input, store);
    expect(result.escalate).toBe(true);
  });
});

// Live Chrome failure on 39c3a4d, 2026-11-09 (evidence/20261109-chrome-he-rear-end.md):
// a rear-end collision described without the word "accident" got generic model
// advice without the office number or a staff alert.
describe('collision described in everyday words', () => {
  const send = async (input: string) => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'Model wording', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    return getRebuiltBotReply('fictional-collision', input, store);
  };
  it.each([
    'מישהו נכנס בי מאחורה ברמזור בפתח תקווה, כולם בסדר. זה הרכב שלכם, הפגוש מעוך. מה אני עושה עכשיו?',
    'רכב התנגש בנו בחניון, הפגוש נמעך',
    'Someone rear-ended me at a light, everyone is fine but the bumper is smashed.',
    'A truck backed into my car in the parking lot.',
  ])('enters the approved safety flow with the office number: %s', async input => {
    const result = await send(input);
    expect(result.source).toBe('safety');
    expect(result.escalate).toBe(true);
    expect(result.reply).toMatch(/09-9509757/);
  });
  it.each([
    'מה קורה אם מישהו נכנס בי מאחורה?',
    'What if someone hits my car while it is parked?',
    'אני רוצה להיכנס בינתיים לאתר ולבדוק מחירים',
    'הגיוני. כל אחד עם מזוודה בינונית, זה נכנס ברכב משפחתי רגיל? ושני רכבים יוצא יותר יקר בדרך כלל?',
    'כמה מזוודות נכנסות ברכב קטן?',
    'Will two suitcases fit in the car?',
  ])('keeps hypothetical or unrelated wording out of safety: %s', async input => {
    const result = await send(input);
    expect(result.source).not.toBe('safety');
  });
});

describe('model never clears a damaged rental for driving', () => {
  it.each([
    'בסדר גמור, אם הרכב נוסע וההגה והמערכות תקינות ללא נזק שפוגע בבטיחות, אפשר לנסוע בזהירות.',
    'אם הרכב נוסע ואין סכנה בדרך, אין חובה לגרר מיד.',
    'It is fine to keep driving if the steering feels normal.',
    'We will arrange a replacement car at the Tel Aviv branch.',
  ])('rejects the model wording and falls back to approved guidance: %s', async modelReply => {
    const he = /[א-ת]/u.test(modelReply);
    let state: RebuildState | null = { version: 2, phase: 'service', step: 'menu', locale: he ? 'he' : 'en', booking: {}, serviceReference: '334455', history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: modelReply, source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const result = await getRebuiltBotReply('fictional-driving', he ? 'הפגוש נפגע קצת אבל הרכב נוסע. אני יכול להמשיך לנסוע איתו?' : 'The bumper got a bit damaged but the car drives. Can I keep driving it?', store);
    expect(result.reply).not.toBe(modelReply);
    expect(result.reply).not.toMatch(/אפשר לנסוע בזהירות|אין חובה לגרר|fine to keep driving|arrange a replacement car/);
  });
});

// Live Chrome on b9908ed, 2026-11-09: the shortening regression passed, but the
// follow-up "is it already shortened? will the difference be refunded
// automatically?" got a generic reply that skipped the refund question.
describe('follow-up after a queued change', () => {
  it.each([
    ['he', 'אז זה כבר קוצר? וההפרש על היומיים יוחזר לי אוטומטית?', /לא אושר/, /אינם מתבצעים אוטומטית/],
    ['en', 'So is it already shortened? Will the difference be refunded automatically?', /not approved/, /not automatic/],
  ] as const)('says the change is not approved and a refund is not automatic: %s', async (locale, input, notApproved, noAutoRefund) => {
    let state: RebuildState | null = { version: 2, phase: 'service', step: 'menu', locale, booking: {}, serviceReference: '456789', serviceChangeRequested: true, handedOff: true, handoffAt: new Date().toISOString(), handoffKind: 'booking_change', history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const result = await getRebuiltBotReply('fictional-followup', input, store);
    expect(result.reply).toMatch(notApproved);
    expect(result.reply).toMatch(noAutoRefund);
    expect(result.escalate).toBeFalsy();
  });
});

// Live Chrome replay on b9908ed: the collision now entered safety, but the second
// turn's other-driver and excess questions were both dropped.
describe('compound questions after a collision report', () => {
  it('answers other-driver details, missing reference and excess together, without deciding liability', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    await getRebuiltBotReply('fictional-collision-2', 'מישהו נכנס בי מאחורה ברמזור, כולם בסדר. זה הרכב שלכם, הפגוש מעוך. מה אני עושה עכשיו?', store);
    const result = await getRebuiltBotReply('fictional-collision-2', 'אין לי את מספר ההזמנה מולי. לקחת פרטים מהנהג השני? והאם אני אשלם השתתפות עצמית אם הוא אשם?', store);
    expect(result.reply).toMatch(/פרטי הנהג השני/);
    expect(result.reply).toMatch(/בלי מספר הזמנה/);
    expect(result.reply).toMatch(/השתתפות/);
    expect(result.reply).not.toMatch(/לא תחויבו|פטור מהשתתפות/);
    expect(result.escalate).toBeFalsy();
  });
});

// Live Chrome on f65ac21: "טוב בואו נבטל, מספר הזמנה 552211 … הכסף חוזר לאשראי?" was not
// treated as a cancellation request; nobody was alerted.
describe('everyday cancellation decisions', () => {
  const send = async (input: string, locale: 'he' | 'en') => {
    let state: RebuildState | null = { version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    return getRebuiltBotReply('fictional-cancel', input, store);
  };
  it.each([
    ['he', 'וואלה. טוב בואו נבטל, מספר הזמנה 552211. האיסוף היה בשישי. הכסף חוזר לאשראי?'],
    ['he', 'תבטלו לי את ההזמנה בבקשה, מספר הזמנה 552211'],
    ["en", "ok let's cancel it. booking number 552211"],
  ] as const)('queues the cancellation for review without confirming it: %s', async (locale, input) => {
    const result = await send(input, locale);
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('booking_change');
    expect(result.reply).not.toMatch(/בוטלה\b|has been cancelled/);
  });
  it.each([['he', 'אם נבטל כמה זה יעלה?'], ['en', 'what happens if we cancel it?'], ['he', 'כמה זה עולה לבטל?']] as const)('keeps questions about cancelling advisory: %s', async (locale, input) => {
    const result = await send(input, locale);
    expect(result.escalate).toBeFalsy();
  });
});

// Live Chrome on eaf4a5b: the cancellation was queued, but "שלום … הטיול בוטל. תבטלו לי"
// got "ולא שינוי תאריכים", and "וכמה מהכסף אקבל בחזרה? זה עוד שבוע" got a generic reply.
describe('cancellation follow-ups in everyday words', () => {
  it('queues without odd wording and answers the refund question with the published tiers', async () => {
    let state: RebuildState | null = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const first = await getRebuiltBotReply('fictional-cancel-2', 'שלום, יש לי הזמנה לשבוע הבא אבל הטיול בוטל. תבטלו לי בבקשה, מספר הזמנה 778190', store);
    expect(first.escalate).toBe(true);
    expect(first.reply).not.toContain('ולא שינוי תאריכים');
    const second = await getRebuiltBotReply('fictional-cancel-2', 'וכמה מהכסף אקבל בחזרה? זה עוד שבוע', store);
    expect(second.reply).toMatch(/72 שעות/);
    expect(second.reply).toMatch(/הנציג יבדוק/);
    expect(second.escalate).toBeFalsy();
  });
});

// Live Chrome on f7e6a5d (Hebrew leasing): after declining a call, "טוב אוקיי, שמישהו יחזור
// אליי מחר בבוקר" was not passed on, while the model claimed "המערכת תעביר את הבקשה לנציג".
describe('explicit callback request in a commercial enquiry', () => {
  const lead = (): RebuildState => ({ version: 2, phase: 'explore', step: 'menu', locale: 'he', interest: 'leasing', humanHandoffDeferred: true, commercial: { termMonths: 36, annualMileageKm: 25000, budget: { amount: 2500, currency: 'unspecified' } }, booking: {}, history: [{ from: 'customer', text: 'אני לא רוצה שיתקשרו אליי עכשיו' }] } as RebuildState);
  const send = async (state: RebuildState, input: string, modelReply: string) => {
    let current: RebuildState | null = state;
    const store: RebuildStore = { isSimulation: true, loadState: async () => current, saveState: async (_p, next) => { current = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'leasing', direction: 'none', fields: {}, reply: modelReply, source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    return getRebuiltBotReply('fictional-leasing', input, store);
  };
  it.each(['טוב אוקיי, שמישהו יחזור אליי מחר בבוקר. מה רשמת עליי?', 'ok have someone call me tomorrow'])('passes the lead to a representative once: %s', async input => {
    const result = await send(lead(), input, 'המערכת תעביר את הבקשה לנציג שיחזור אליך מחר בבוקר.');
    expect(result.escalate).toBe(true);
    expect(result.reply).not.toContain('המערכת תעביר');
  });
  it('keeps a refusal as a refusal', async () => {
    const result = await send(lead(), 'אני לא רוצה שיחזרו אליי, רק מידע', 'בליסינג ביטוח וטיפולים כלולים רק אם נכתבו בהצעה.');
    expect(result.escalate).toBeFalsy();
  });
  it('rejects a model claim that the system will pass the request on', async () => {
    const result = await send({ ...lead(), humanHandoffDeferred: false }, 'מה כלול בליסינג בדרך כלל?', 'המערכת תעביר את הבקשה לנציג שיחזור אליך מחר בבוקר.');
    expect(result.reply).not.toContain('המערכת תעביר');
  });
});

// Live Chrome on 35e6792 (EN): "some guy just backed into me … side mirror is hanging off"
// stayed out of safety and the model's "call our office" had no number.
describe('english collision in everyday words and office number', () => {
  const send = async (input: string, modelReply = 'Please call our office so we can help.', initial: RebuildState | null = null) => {
    let state: RebuildState | null = initial;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: modelReply, source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    return getRebuiltBotReply('fictional-en-collision', input, store);
  };
  it('enters safety with the number and an alert', async () => {
    const result = await send('omg some guy just backed into me in a parking lot in haifa. im fine but the side mirror is hanging off. what do i do');
    expect(result.source).toBe('safety');
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('09-9509757');
  });
  it('adds the office number when model wording asks the customer to call', async () => {
    const result = await send('what are your office hours on friday?', 'Branches are open on Fridays until 14:00; call our office for anything urgent.', { version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] });
    expect(result.reply).toContain('09-9509757');
  });
});

// Live Chrome on 35e6792 (HE extension): "כן בבקשה תבדקו. מספר הזמנה 641552" after "האם תרצה
// שנבדוק עבורך זמינות להארכה?" became a generic service issue, and "ואם לא יענו לי עד מחר בערב?
// אני מחזיר או ממשיך לנסוע?" got a generic reply instead of the binding return time.
describe('hebrew extension acceptance and the binding return time', () => {
  it('queues the extension review and answers the deadline question', async () => {
    let state: RebuildState | null = { version: 2, phase: 'service', step: 'menu', locale: 'he', booking: {}, serviceChangeRequested: false, history: [{ from: 'customer', text: 'הרכב אצלי ואני צריך להחזיר מחר בערב. יש סיכוי להשאיר עוד יומיים?' }, { from: 'bot', text: 'הארכה דורשת אישור. האם תרצה שנבדוק עבורך זמינות להארכה?' }] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const accepted = await getRebuiltBotReply('fictional-he-ext', 'כן בבקשה תבדקו. מספר הזמנה 641552', store);
    expect(accepted.state.serviceChangeRequested).toBe(true);
    expect(accepted.state.handoffKind).toBe('booking_change');
    const deadline = await getRebuiltBotReply('fictional-he-ext', 'ואם לא יענו לי עד מחר בערב? אני מחזיר או ממשיך לנסוע?', store);
    expect(deadline.reply).toMatch(/מועד ההחזרה הקיים נשאר בתוקף/);
    expect(deadline.reply).toMatch(/09-9509757/);
    expect(deadline.escalate).toBeFalsy();
  });
  it('does not take "no, don’t check" as acceptance', async () => {
    let state: RebuildState | null = { version: 2, phase: 'service', step: 'menu', locale: 'he', booking: {}, serviceChangeRequested: false, history: [{ from: 'bot', text: 'האם תרצה שנבדוק עבורך זמינות להארכה?' }] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'בסדר.', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const result = await getRebuiltBotReply('fictional-he-ext-2', 'כן אבל לא עכשיו, אני עוד חושב', store);
    expect(result.state.serviceChangeRequested).toBe(false);
  });
});

// Live Chrome on e351033: "כן תבדקו בבקשה, הזמנה 902233" lost the reference, and "ואם לא תחזרו
// אליי עד רביעי מה אני עושה" was taken as a callback request.
describe('bare reference and conditional callback wording', () => {
  const run = async (history: RebuildState['history'], inputs: string[]) => {
    let state: RebuildState | null = { version: 2, phase: 'service', step: 'menu', locale: 'he', booking: {}, serviceChangeRequested: false, history };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'בשמחה, נבדוק את אפשרות ההארכה עבורך.', source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading) };
    const results = [];
    for (const input of inputs) results.push(await getRebuiltBotReply('fictional-bare-ref', input, store));
    return results;
  };
  it('saves the reference, queues the extension and answers the deadline without a new callback alert', async () => {
    const [accepted, deadline] = await run(
      [{ from: 'customer', text: 'אני עם הרכב שלכם וצריכה להחזיר ברביעי. אפשר עוד יום אחד?' }, { from: 'bot', text: 'הארכה דורשת אישור. האם תרצי שנבדוק את אפשרות ההארכה עבורך?' }],
      ['כן תבדקו בבקשה, הזמנה 902233', 'ואם לא תחזרו אליי עד רביעי מה אני עושה'],
    );
    expect(accepted.state.serviceReference).toBe('902233');
    expect(accepted.escalate).toBe(true);
    expect(accepted.state.handoffKind).toBe('booking_change');
    expect(deadline.escalate).toBeFalsy();
    expect(deadline.reply).toMatch(/מועד ההחזרה הקיים נשאר בתוקף/);
  });
  it('does not treat an amount as a booking reference', async () => {
    const [result] = await run([], ['ההזמנה 12000 ₪ זה לא יקר מדי?']);
    expect(result.state.serviceReference).toBeUndefined();
  });
});
