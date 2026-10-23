import { describe, expect, it } from 'vitest';
import { localConsultationTurn, type LocalConsultation } from '@/lib/whatsapp-local-consultation';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

describe('offline consultation, no model or provider', () => {
  it('keeps the screenshot conversation rather than restarting or promising equipment', async () => {
    let state: FlowState | null = null;
    let modelCalls = 0;
    const store: WhatsAppFlowStore = {
      engine: 'local',
      activeBooking: async () => null, loadState: async () => state,
      saveState: async (_, next) => { state = next; }, createRentalRequest: async () => { throw new Error('Not consented'); },
      interpretMessage: async () => { modelCalls++; throw new Error('Local mode must not invoke a provider'); },
    };
    for (const message of ['אני צריך רכב לשנה', '15000', 'גג פתוח אפל קאר פליי כיסאות עור', 'אתה יכול לשלוח לי הצעת מחיר?', 'דיברנו כבר על תאריכים', 'הסברתי לך כבר מה אני צריך']) {
      const result = await getWhatsAppFlowReply('offline-customer', message, store);
      expect(result.escalate).not.toBe(true);
      expect(result.reply).not.toMatch(/העברתי|יצרו איתך|הצוות יראה|ספר לי מה צריך|איזה תאריכים/);
      expect((result.reply?.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
    }
    const final = state as FlowState | null;
    expect(final?.localConsultation).toMatchObject({ months: 12, annualKm: 15000, equipment: ['גג נפתח', 'Apple CarPlay', 'מושבי עור'] });
    expect(final?.history?.at(-1)?.text).toContain('15,000');
    expect(modelCalls).toBe(0);
  });

  it('remembers facts after 1020 more turns', () => {
    let state = localConsultationTurn('רכב לשנה 15000 קמ', undefined)!.state;
    for (let i = 0; i < 1020; i++) state = localConsultationTurn('תזכיר מה ביקשתי', state)!.state;
    expect(state).toMatchObject({ months: 12, annualKm: 15000 });
  });

  it('replaces mileage and removes a negated preference', () => {
    let state: LocalConsultation = { months: 12, annualKm: 15000, equipment: ['גג נפתח', 'Apple CarPlay'] };
    state = localConsultationTurn('בעצם 20000 קמ, לא צריך גג פתוח', state)!.state;
    expect(state.annualKm).toBe(20000);
    expect(state.equipment).toEqual(['Apple CarPlay']);
  });

  it('does not turn an unexplained number into annual mileage', () => {
    const result = localConsultationTurn('15000', { months: 12, annualKm: 10000, equipment: [], awaiting: 'budget' });
    expect(result?.state).toMatchObject({ annualKm: 10000, budget: 15000 });
  });
  it('respects a refused budget', () => {
    const result = localConsultationTurn('לא רוצה להגיד תקציב', { months: 12, annualKm: 15000, equipment: [], awaiting: 'budget' });
    expect(result?.state.budgetDeclined).toBe(true);
    expect(result?.reply).not.toContain('?');
  });
  it('lets a policy question interrupt consultation without losing its memory', () => {
    const state: LocalConsultation = { months: 12, annualKm: 15000, equipment: ['Apple CarPlay'] };
    expect(localConsultationTurn('מה ההבדל בין פיקדון להשתתפות עצמית?', state)).toBeNull();
    expect(localConsultationTurn('תזכיר מה ביקשתי', state)?.reply).toContain('Apple CarPlay');
  });
});
