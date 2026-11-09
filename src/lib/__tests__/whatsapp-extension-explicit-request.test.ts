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
