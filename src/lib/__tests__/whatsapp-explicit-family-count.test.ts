import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'unexpected');
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn: async () => null };
  return { send: (input: string) => getRebuiltBotReply('fictional-family-count', input, store), create };
}

describe('explicit self, partner and singular child count', () => {
  it.each([
    ['Hi, I would like to rent a family car from Herzliya on 9 December 2026 and return it in Tel Aviv on 12 December 2026. I am 36, travelling with my partner and our child, with one suitcase.', 'My name is Avery Test', 'Passengers: 3'],
    ['אני רוצה לשכור רכב משפחתי מ-9/12 עד 12/12, איסוף מהרצליה והחזרה בתל אביב. אני בן 36, נוסע עם בת הזוג שלי והילד שלנו, עם מזוודה אחת.', 'השם הוא אורי בדיקה', 'נוסעים: 3'],
  ])('retains three travellers and the supplied trip through the name and summary: %s', async (opening, name, summaryCount) => {
    const chat = conversation();
    const started = await chat.send(opening);
    expect(started.state.booking).toMatchObject({ passengers: 3, luggage: 1, pickupDate: '2026-12-09', returnDate: '2026-12-12', driverAgeRange: '24-plus' });
    const completed = await chat.send(name);
    expect(completed.state.step).toBe('rental_confirm');
    expect(completed.reply).toContain(summaryCount);
    expect(completed.state.booking.pickupLocation).toBe(started.state.booking.pickupLocation);
    expect(completed.state.booking.returnLocation).toBe(started.state.booking.returnLocation);
    expect(completed.state.booking.customerName).toBeTruthy();
    expect(chat.create).not.toHaveBeenCalled();
  });

  it.each([
    'If I am travelling with my partner and our child, what car would suit us?',
    'I am not travelling with my partner and our child.',
    'I am 36, travelling with my partner and our children.',
    'I am 36, travelling with my partner and our three-year-old.',
    'A customer is travelling with my partner and our child.',
    'אם אני נוסע עם בת הזוג שלי והילד שלנו, מה יתאים?',
    'אני לא נוסע עם בת הזוג שלי והילד שלנו.',
    'אני נוסע עם בת הזוג שלי והילדים שלנו.',
    'I want a seven-seat car. My child is three years old.',
  ])('does not invent a headcount from hypotheses, negation, plural children, age or seat capacity: %s', async input => {
    const result = await conversation().send(input);
    expect(result.state.booking.passengers).toBeUndefined();
  });
});
