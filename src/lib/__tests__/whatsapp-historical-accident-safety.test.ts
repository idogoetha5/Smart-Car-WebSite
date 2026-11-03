import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, isRebuiltSafetyMessage, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('historical accident checks versus current incidents', () => {
  it.each([
    'That did not answer my checklist question. Before viewing a used car, should I check service history, accident history and have an independent inspection? I am still only comparing.',
    'לפני שאני קונה רכב משומש, כדאי לבדוק היסטוריית טיפולים, היסטוריית תאונות ובדיקה עצמאית? אני עדיין רק משווה.',
    'האם כדאי לבדוק עבר תאונתי ותאונות קודמות לפני הקנייה?',
    'Should I check the history of previous accidents before buying?',
    'My rental car enquiry is about damage history, not an incident.',
  ])('does not turn historical vehicle checks into a roadside emergency: %s', async input => {
    expect(isRebuiltSafetyMessage(input)).toBe(false);
    let saved: RebuildState | null = null;
    const create = vi.fn(async () => 'should-not-create');
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => ({ version: 2, locale: /[א-ת]/.test(input) ? 'he' : 'en', phase: 'explore', step: 'menu', booking: {}, history: [], interest: 'sale', humanHandoffDeferred: true }),
      saveState: async (_phone, state) => { saved = state; },
      activeBooking: async () => null, createRentalRequest: create, readTurn: async () => null,
    };
    const result = await getRebuiltBotReply('fictional-history-check', input, store);
    expect(result.source).not.toBe('safety');
    expect(result.escalate).not.toBe(true);
    expect(result.state.safetyKind).toBeUndefined();
    expect(saved).not.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    'I was checking accident history, but I crashed my rental car today. Nobody was injured.',
    'בדקתי היסטוריית תאונות, אבל עכשיו עברתי תאונה עם הרכב השכור. אין נפגעים.',
    'I asked about damage history earlier. My rental car now has a dent after a collision.',
    'בדקתי עבר תאונתי. עכשיו יש שריטה ברכב השכור אחרי פגיעה בחניה.',
    'Before checking the accident history, my rental car has a flat tyre and I need help now.',
  ])('retains genuine current incident routing even alongside historical language: %s', input => {
    expect(isRebuiltSafetyMessage(input)).toBe(true);
  });
});
