import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T10:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('one bare answer belongs to the field asked at turn start', () => {
  it.each([false, true])('does not infer same-place return after model pickup extraction, duplicate=%s', async duplicate => {
    let state: RebuildState = { version: 2, phase: 'booking', step: 'rental_locations', locale: 'he', booking: { pickupDate: '2026-12-10', returnDate: '2026-12-12', vehicleNeed: 'רכב משפחתי' }, history: [{ from: 'bot', text: 'מאיפה תרצו לאסוף את הרכב?' }] };
    const readTurn: NonNullable<RebuildStore['readTurn']> = async input => ({ route: 'book', direction: 'none', fields: { pickupLocation: { value: input.includes('ירושלים') ? 'Jerusalem' : 'Herzliya', evidence: input }, ...(duplicate ? { returnLocation: { value: input.includes('ירושלים') ? 'Jerusalem' : 'Herzliya', evidence: input } } : {}) }, reply: 'אפשר להמשיך.', source: 'gemini', model: 'test' });
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('not confirmed'); }, readTurn };
    const send = (input: string) => getRebuiltBotReply('fictional-field-ownership', input, store);
    const pickup = await send('סניף הרצליה');
    expect(pickup.state.booking.pickupLocation).toBe('הרצליה');
    expect(pickup.state.booking.returnLocation).toBeUndefined();
    expect(pickup.state.step).toBe('rental_locations');
    expect(pickup.reply).toMatch(/להחזיר/);
    const returned = await send('ירושלים');
    expect(returned.state.booking).toMatchObject({ pickupLocation: 'הרצליה', returnLocation: 'ירושלים' });
    expect(returned.state.step).toBe('rental_age');
  });
  it('accepts an explicit English pickup phrase without copying it to the return', async () => {
    let state: RebuildState = { version: 2, phase: 'booking', step: 'rental_locations', locale: 'en', booking: { pickupDate: '2026-12-10', returnDate: '2026-12-12', vehicleNeed: 'family car' }, history: [{ from: 'bot', text: 'Where would you like to pick it up?' }] };
    const readTurn: NonNullable<RebuildStore['readTurn']> = async input => ({ route: 'book', direction: 'none', fields: { pickupLocation: { value: 'Herzliya', evidence: input }, returnLocation: { value: 'Herzliya', evidence: input } }, reply: 'We can continue.', source: 'gemini', model: 'test' });
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('not confirmed'); }, readTurn };
    const result = await getRebuiltBotReply('fictional-explicit-pickup', 'Pick it up in Herzliya', store);
    expect(result.state.booking.pickupLocation).toBe('Herzliya');
    expect(result.state.booking.returnLocation).toBeUndefined();
  });
  it('never turns one plain date into both pickup and return', async () => {
    let state: RebuildState = { version: 2, phase: 'booking', step: 'rental_dates', locale: 'he', booking: { vehicleNeed: 'רכב משפחתי' }, history: [{ from: 'bot', text: 'באיזה תאריך תרצו לאסוף את הרכב?' }] };
    const readTurn: NonNullable<RebuildStore['readTurn']> = async input => ({ route: 'book', direction: 'none', fields: { pickupDate: { value: input === '10/12' ? '2026-12-10' : '2026-12-12', evidence: input }, returnDate: { value: input === '10/12' ? '2026-12-11' : '2026-12-12', evidence: input } }, reply: 'אפשר להמשיך.', source: 'gemini', model: 'test' });
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('not confirmed'); }, readTurn };
    const first = await getRebuiltBotReply('fictional-date-owner', '10/12', store);
    expect(first.state.booking.pickupDate).toBe('2026-12-10');
    expect(first.state.booking.returnDate).toBeUndefined();
    const second = await getRebuiltBotReply('fictional-date-owner', '12/12', store);
    expect(second.state.booking).toMatchObject({ pickupDate: '2026-12-10', returnDate: '2026-12-12' });
  });
});
