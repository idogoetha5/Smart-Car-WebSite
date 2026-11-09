import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), evaluation: vi.fn() }));
vi.mock('@/lib/whatsapp-gemini-client', () => ({ generateSmartCarContent: mocks.generate, readJson: JSON.parse }));
vi.mock('@/lib/whatsapp-model-evaluation', () => ({ activeModelEvaluation: mocks.evaluation }));
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import { israelCalendar, readBotTurn, type BotReading } from '@/lib/whatsapp-rebuild-gemini';

// Live Chrome failure on 39c3a4d, 2026-11-09 (evidence/20261109-chrome-he-parents-airport.md):
// a decided weekday range was not stored, "what do you need from me to proceed?"
// did not start the request, and a name+phone+insurance turn skipped the model,
// dropped the insurance question and later asked for the name again.
function chat(initial: RebuildState | null, reply: (input: string) => string) {
  let state = initial;
  const create = vi.fn(async () => 'SIM-PARENTS');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async input => ({ route: 'explore', direction: 'none', fields: {}, reply: reply(input), source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-parents-airport', input, store), create, readTurn };
}
const draft = (history: RebuildState['history']): RebuildState => ({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupLocation: 'נתב״ג', returnLocation: 'נתב״ג', vehicleNeed: 'רכב משפחתי', driverAgeRange: '24-plus', luggage: 2, pickupDate: '2026-11-17', returnDate: '2026-11-26' }, history });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T09:10:00Z')); vi.clearAllMocks(); mocks.evaluation.mockReturnValue(undefined); });
afterEach(() => vi.useRealTimers());

describe('parents arriving at the airport', () => {
  it.each([
    ['he', 'משפחתית, יהיו גם שתי מזוודות גדולות. לאסוף ולהחזיר בנתב״ג. מה אתה צריך ממני כדי להתקדם?'],
    ['en', 'Family car, two big suitcases, pick up and return at the airport. What do you need from me to proceed?'],
  ] as const)('treats asking what is needed to proceed as starting the request, not sending it: %s', async (locale, input) => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale, booking: { pickupDate: '2026-11-17', returnDate: '2026-11-26', driverAgeRange: '24-plus' }, history: [] }, () => locale === 'he' ? 'בשמחה.' : 'Of course.');
    const result = await c.send(input);
    expect(result.state.phase).toBe('booking');
    expect(result.state.completedRequestId).toBeUndefined();
    expect(c.create).not.toHaveBeenCalled();
  });

  it('keeps a name given with a phone after the assistant asked for it, answers insurance and never asks the name again', async () => {
    const c = chat(draft([{ from: 'customer', text: 'מה אתה צריך ממני כדי להתקדם?' }, { from: 'bot', text: 'כדי להשלים את הבקשה חסרים לי רק שמך ומספר הטלפון.' }]), () => 'בשמחה.');
    const result = await c.send('נועה בדיקה, 050-0000000. במחיר כלול ביטוח או שזה בנפרד?');
    expect(result.state.booking.customerName).toBe('נועה בדיקה');
    expect(result.state.phase).toBe('booking');
    expect(result.reply).toMatch(/ביטוח חובה|כיסוי בסיסי/);
    expect(result.reply).not.toContain('050-0000000');
    expect(JSON.stringify(result.state.history.filter(entry => !entry.private))).not.toContain('נועה');
    expect(c.readTurn).not.toHaveBeenCalled();
    const next = await c.send('כן, אבל לא ענית לי על הביטוח');
    expect(next.reply).not.toMatch(/על איזה שם|מה שמך|What name/);
    expect(c.create).not.toHaveBeenCalled();
  });

  it.each(['050-0000000 בבקשה', 'כן, 050-0000000', 'אני לא בטוחה, 050-0000000'])('does not mistake a non-name leading clause for a name: %s', async input => {
    const c = chat(draft([{ from: 'bot', text: 'חסרים לי רק שמך ומספר הטלפון.' }]), () => 'בשמחה.');
    const result = await c.send(input);
    expect(result.state.booking.customerName).toBeUndefined();
  });

  it('does not start a request from a phone number when no rental draft or name prompt exists', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [{ from: 'bot', text: 'איך אפשר לעזור?' }] }, () => 'בשמחה.');
    const result = await c.send('דני כהן, 050-0000000. יש לכם סניף בחיפה?');
    expect(result.state.phase).toBe('explore');
    expect(result.state.booking.customerName).toBeUndefined();
  });

  it.each([
    'גיל 72 הוא מצוין לנהיגה — אפשר לשכור כל עוד יש רישיון בתוקף.',
    'גיל 72 הוא לגמרי בסדר; אפשר לשכור מגיל 21.',
    'Age 72 is no problem, he can rent as long as he has a valid licence.',
  ])('replaces an unconditional older-driver eligibility assurance with the approved conditional answer: %s', async modelReply => {
    const he = /[א-ת]/u.test(modelReply);
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: he ? 'he' : 'en', booking: {}, history: [] }, () => modelReply);
    const result = await c.send(he ? 'אבא שלי בן 72 והוא ינהג, זה בעיה?' : 'My father is 72 and will drive, is that a problem?');
    expect(result.reply).not.toBe(modelReply);
    expect(result.reply).toMatch(/כיסוי הביטוחי|insurance cover/);
    expect(c.create).not.toHaveBeenCalled();
  });
});

describe('weekday calendar for the wording provider', () => {
  it('lists Israel dates with their weekdays so the model need not compute them', () => {
    const days = israelCalendar('2026-11-09');
    expect(days[0]).toBe('2026-11-09 Monday יום שני (today)');
    expect(days[8]).toBe('2026-11-17 Tuesday יום שלישי');
    expect(days[17]).toBe('2026-11-26 Thursday יום חמישי');
    expect(israelCalendar('not-a-date')).toEqual([]);
  });
  it('sends the calendar alongside the date and asks for no guessed weekday dates', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'none', reply: 'בשמחה.', fields: {}, factPatches: [] }) });
    await readBotTurn('משלישי הבא עד החמישי שאחריו', { locale: 'he', phase: 'explore', recent: [], known: {}, today: '2026-11-09' });
    const body = mocks.generate.mock.calls[0][0].body;
    const payload = JSON.parse(body.contents[0].parts[0].text);
    expect(payload.calendarIsrael).toContain('2026-11-17 Tuesday יום שלישי');
    expect(JSON.stringify(body.systemInstruction ?? body)).toContain('calendarIsrael');
  });
});
