import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('sale entry retains natural budget through history and correction', () => {
  it('rejects a wrong repeated budget/lease-term question and answers the buyer', async () => {
    let state: RebuildState | null = null;
    const readTurn = vi.fn(async () => ({ route: 'sale' as const, direction: 'family' as const, fields: {}, source: 'gemini' as const, model: 'regression-test', groundedContext: true, reply: 'מה התקופה או מסגרת התקציב המועדפות עליך לרכב המשפחתי?' }));
    const create = vi.fn(async () => 'unexpected');
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
    const send = (input: string) => getRebuiltBotReply('fictional-sale-budget', input, store);
    await send('שלום, אני מעוניין לקנות רכב מהצי שלכם. אנא עדכנו אותי כשיהיו רכבים למכירה.');
    const history = await send('מחפש משפחתית בסביבות 65 אלף שקלים, עם מקום לשני ילדים ועגלה. לפני שאני מתקדם, אפשר לקבל היסטוריית טיפולים ותאונות ולבדוק את הרכב עצמאית?');
    expect(history.state.commercial?.budget).toEqual({ amount: 65000, currency: 'ILS' });
    expect(history.state.commercial?.vehiclePreference).toBe('family');
    expect(history.reply).toMatch(/היסטוריית הטיפולים והתאונות/u);
    expect(history.reply).toMatch(/בדיקה עצמאית/u);
    expect(history.reply).not.toContain('מה התקופה');
    expect(history.escalate).toBe(false);
    const correction = await send('בעצם סביב 55 אלף שקלים. אני עדיין משווה, לא רוצה שיחזרו אליי.');
    expect(correction.state.commercial?.budget?.amount).toBe(55000);
    expect(correction.escalate).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
