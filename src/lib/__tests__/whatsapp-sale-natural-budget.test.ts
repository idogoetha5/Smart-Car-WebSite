import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('sale entry retains natural budget through history and correction', () => {
  it('recalls the corrected English enquiry after explicit callback without confirming stock or appointment', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: async () => { throw new Error('no rental'); }, readTurn: async () => null };
    const send = (input: string) => getRebuiltBotReply('fictional-sale-recall', input, store);
    await send('I want to buy a family car. My budget is 65000 shekels.');
    await send('Actually my budget is 55000 shekels. Low mileage is important. No callback yet.');
    expect((await send('Please pass the details to the team and have someone call me back.')).escalate).toBe(true);
    const result = await send('Remind me what budget and vehicle preference you saved. Is a car reserved or a test drive confirmed?');
    expect(result.reply).toContain('55000 ILS');
    expect(result.reply).toContain('family');
    expect(result.reply).toContain('low mileage');
    expect(result.reply).toContain('does not confirm');
    expect(result.reply).not.toContain('65000');
    expect(result.escalate).toBe(false);
  });
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
    const handoff = await send('עכשיו אפשר להעביר את הפנייה לנציג שיחזור אליי. רק משפחתית עד 55 אלף, חשוב קילומטראז׳ נמוך.');
    expect(handoff.escalate).toBe(true);
    const recall = await send('רק לוודא לפני שאני הולך: איזה תקציב וסוג רכב שמרתם, והאם כבר שמרתם לי רכב או קבעתם נסיעת מבחן?');
    expect(recall.reply).toContain('55000 ILS');
    expect(recall.reply).toContain('משפחתי');
    expect(recall.reply).toContain('קילומטראז׳ נמוך');
    expect(recall.reply).toContain('אינה אישור');
    expect(recall.reply).not.toContain('65000');
    expect(recall.escalate).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
