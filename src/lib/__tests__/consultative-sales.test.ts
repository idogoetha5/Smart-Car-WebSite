import { describe, expect, it } from 'vitest';
import { CONSULTATIVE_SALES_PLAYS, consultativeSalesReply } from '@/lib/consultative-sales';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

describe('consultative sales plays', () => {
  it.each(CONSULTATIVE_SALES_PLAYS)('defines guardrails for $id', (play) => {
    expect(play).toMatchObject({ trigger: expect.any(String), knownContext: expect.any(String), minimumMissing: expect.any(String), reflection: expect.any(String), response: expect.any(String), nextAction: expect.any(String), forbidden: expect.any(String) });
    expect(play.forbidden).toMatch(/לחץ|urgency/i);
  });

  it.each([
    ['יקר לי', 'he'], ['I will think about it', 'en'], ['מתחרה הציע פחות', 'he'], ['not sure which car', 'en'], ['משפחה תינוק מזוודות', 'he'], ['luxury car', 'en'], ['נסיעה ארוכה', 'he'], ['airport pickup', 'en'], ['נהג צעיר', 'he'], ['deposit', 'en'], ['ביטוח', 'he'], ['fuel', 'en'], ['קילומטרים', 'he'], ['change extend', 'en'], ['אין רכב זמין', 'he'], ['discount please', 'en'], ['לקוח חוזר', 'he'], ['business company', 'en'], ['דחוף לחוץ', 'he'], ['I do not trust this', 'en'], ['לא עונה', 'he'], ['availability uncertain', 'en'], ['אני מאשר', 'he'], ['mixed details', 'en'], ['אחשוב על זה', 'he'],
  ] as const)('gives one safe next action for: %s', (input, locale) => {
    const sale = consultativeSalesReply(input, locale);
    expect(sale?.reply).toContain(sale?.play.nextAction ?? '');
    expect(sale?.reply).not.toMatch(/רק היום|נשאר אחרון|guaranteed|limited time/i);
  });

  it.each(CONSULTATIVE_SALES_PLAYS)('runs $id inside an active rental without dropping its context', async (play) => {
    let state: FlowState | null = {
      step: 'rental_locations', locale: play.locale,
      pickupDate: '2026-09-10', dropoffDate: '2026-09-14', pickupTime: '09:00', returnTime: '18:00',
    };
    const store: WhatsAppFlowStore = {
      activeBooking: async () => null,
      loadState: async () => state,
      saveState: async (_phone, nextState) => { state = nextState; },
      createRentalRequest: async () => null,
    };

    const result = await getWhatsAppFlowReply('972501234567', play.trigger, store);
    expect(result.reply).toContain(play.response);
    expect(result.reply).not.toMatch(/רק היום|נשאר אחרון|guaranteed|limited time|מובטח|סגור/i);
    expect(state).toMatchObject({ pickupDate: '2026-09-10', dropoffDate: '2026-09-14' });
    if (play.mustHandoff) {
      expect(result.escalate).toBe(true);
      expect(state).toMatchObject({ handedOff: true });
    } else {
      expect(result.escalate).not.toBe(true);
      expect(state).toMatchObject({ step: 'rental_locations' });
      expect(state?.handedOff).toBeUndefined();
    }
  });
});
