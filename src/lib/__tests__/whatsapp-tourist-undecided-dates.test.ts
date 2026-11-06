import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

const opening = "Hi! We're visiting Israel in December, three passengers with two large suitcases. Some days in Tel Aviv and some longer drives to Jerusalem. I'm torn between a compact and a family car, and haven't decided pickup and return dates yet. What would you suggest?";
describe('tourist keeps undecided pickup and return dates beyond the current turn', () => {
  it.each([false, true])('answers foreign-document requirements with no acceptance claim when provider correction=%s', async correction => {
    let state: RebuildState | null = null;
    const safe = 'Bring the original valid licence; an International Driving Permit or official translation may also be required. Confirm the applicable requirements before arrival.';
    const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async (_input, context) => ({ route: 'policy', direction: 'none', fields: {}, source: 'gemini', model: 'test', groundedContext: true, reply: correction && context.replyCorrection ? safe : 'A valid US driving licence is generally accepted. An International Driving Permit or official translation can be helpful.' }));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('no request'); }, readTurn };
    const result = await getRebuiltBotReply('fictional-foreign-docs', 'Does that mean a US licence alone is definitely enough, or might I also need an international permit or translation? I want to check that before choosing dates.', store);
    expect(result.reply).toMatch(/may (?:also )?(?:be required|require)/i);
    expect(result.reply).toMatch(/international|IDP/i);
    expect(result.reply).not.toMatch(/generally accepted|can be helpful/i);
    expect(result.escalate).toBe(false);
    if (correction) { expect(result.reply).toBe(safe); expect(result.source).toBe('gemini'); }
  });
  it.each([false, true])('does not reask dates while answering advice, correction=%s', async correction => {
    let state: RebuildState | null = null;
    const answer = 'A family car generally offers more passenger and luggage space for longer drives; a compact is easier to park. Fit depends on the actual model, and we can keep the dates open.';
    const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async (_input, context) => ({ route: 'explore', direction: 'none', fields: {}, source: 'gemini', model: 'test', groundedContext: true, reply: correction && context.replyCorrection ? answer : 'A family car generally gives more room. Since your dates are still open, would you like to plan around a specific week in December?' }));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('no request'); }, readTurn };
    const send = (input: string) => getRebuiltBotReply('fictional-tourist', input, store);
    const first = await send(opening);
    expect(first.state.booking.datePreference).toBe('dates undecided');
    expect(first.reply).not.toMatch(/what dates|which dates|what date/i);
    expect(first.reply).toMatch(/family|compact/i);
    expect(readTurn.mock.calls[0]?.[1].known.datePreference).toBe('dates undecided');
    if (correction) { expect(first.source).toBe('gemini'); expect(first.reply).toBe(answer); }
    const next = await send('What documents should a visitor bring with a valid foreign licence?');
    expect(next.reply).not.toMatch(/what dates|which dates|what date/i);
    expect(next.state.booking.datePreference).toBe('dates undecided');
    const chosen = await send('Let us start a rental request for a family car. Pickup from Ben Gurion Airport on 8 December 2026 and return in Jerusalem on 15 December 2026. I am 38.');
    expect(chosen.state.booking).toMatchObject({ pickupDate: '2026-12-08', returnDate: '2026-12-15' });
    expect(chosen.state.booking.datePreference).toBeUndefined();
  });
});
