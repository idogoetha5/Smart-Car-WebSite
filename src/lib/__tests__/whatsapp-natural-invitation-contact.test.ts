import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat(locale: 'he' | 'en', offer: string, draft: RebuildState['booking'] = {}, interest?: RebuildState['interest']) {
  let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale, booking: draft, history: [{ from: 'bot', text: offer }], interest };
  const create = vi.fn(async () => 'SIM-NATURAL');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async () => null);
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-natural-invitation', input, store), create, readTurn };
}
const heOffer = 'עבור מחר בהרצליה לרכב קטן ליומיים, האם תרצה שנתחיל להסדיר את הבקשה?';
describe('natural acceptance with contact details after a rental invitation', () => {
  it.each([
    ['he', heOffer, 'כן יאללה. קוראים לי איתי בדיקה. רק שלא תסגור לי משהו יקר בלי להגיד לי, אני רוצה קודם לדעת מה ההצעה', 'איתי בדיקה'],
    ['en', 'Shall we start preparing a rental request?', 'Yeah, my name is Alex Demo. Please show me the quote before committing to anything expensive.', 'Alex Demo'],
  ] as const)('keeps the supplied name and starts only a draft: %s', async (locale, offer, input, name) => {
    const c = chat(locale, offer);
    const result = await c.send(input);
    expect(result.state.phase).toBe('booking');
    expect(result.state.booking.customerName).toBe(name);
    expect(result.reply).not.toMatch(/שם|name|phone|טלפון/i);
    expect(c.readTurn).not.toHaveBeenCalled();
    expect(c.create).not.toHaveBeenCalled();
    expect(result.escalate).toBe(false);
    expect(result.state.history.at(-2)?.private).toBe(true);
  });
  it.each(['כן אבל עדיין לא להתחיל בקשה. רק רוצה לברר מחיר.', "Yes, but don't start a request yet."])('does not override a refusal: %s', async input => {
    const c = chat('he', heOffer);
    expect((await c.send(input)).state.phase).not.toBe('booking');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('does not treat a yes to a generic question as a rental invitation', async () => {
    const c = chat('he', 'האם חשוב לך שיהיה מקום לעגלה?');
    expect((await c.send('כן יאללה')).state.phase).toBe('explore');
  });
  it('does not turn a commercial offer into a rental draft', async () => {
    const c = chat('en', 'Would you like to start a request for a leasing proposal?', {}, 'leasing');
    expect((await c.send('Yeah, please.')).state.phase).not.toBe('booking');
  });
  it('keeps a positively chosen bare קטן while answering a separate question', async () => {
    const c = chat('he', 'איזה סוג רכב חשבת לקחת?');
    const result = await c.send('מחר כמו שאמרתי, בוא נלך על קטן ליומיים. רגע, נהג נוסף משנה את המחיר?');
    expect(result.state.booking.vehicleNeed).toBe('רכב קומפקטי');
  });
  it('still requires the separate final consent phrase before sending', async () => {
    const c = chat('en', 'Shall we start preparing a rental request?', { pickupDate: '2026-12-10', returnDate: '2026-12-12', pickupLocation: 'Herzliya', returnLocation: 'Herzliya', vehicleNeed: 'compact car', driverAgeRange: '24-plus' });
    const summary = await c.send('Yeah, my name is Alex Demo. Show me the quote first.');
    expect(summary.state.step).toBe('rental_confirm');
    expect(summary.reply).toContain('https://www.smartcar.co.il/en/privacy');
    await c.send('Yeah, go ahead with the quote.');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('tells later model turns only that the name is present, without sending the name', async () => {
    const c = chat('en', 'Shall we start preparing a rental request?');
    await c.send('Yeah, my name is Alex Demo. Show me the quote first.');
    await c.send('What about the security deposit?');
    expect(c.readTurn).toHaveBeenCalled();
    const calls = c.readTurn.mock.calls;
    expect(calls.at(-1)?.[1].known.customerNameProvided).toBe('provided');
    expect(JSON.stringify(calls)).not.toContain('Alex Demo');
  });
});
