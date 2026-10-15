import { describe, expect, it, vi } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';
import type { WhatsAppInterpretation } from '@/lib/whatsapp-gemini';

function makeStore(interpretation: WhatsAppInterpretation | null) {
  let state: FlowState | null = null;
  const interpretMessage = vi.fn(async () => interpretation);
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = next; },
    createRentalRequest: async () => null,
    interpretMessage,
  };
  return { store, interpretMessage, state: () => state };
}

const emptyFields = {
  vehiclePreference: '' as const, vehicleEvidence: '', pickupLocation: '', pickupEvidence: '',
  dropoffLocation: '', dropoffEvidence: '',
};

describe('Gemini interpretation inside the WhatsApp flow', () => {
  it('routes an unfamiliar rental phrase into the existing safe intake', async () => {
    const { store, interpretMessage, state } = makeStore({ intent: 'rental', ...emptyFields });
    const result = await getWhatsAppFlowReply('972501234567', 'אפשר אוטו לחופשה?', store);
    expect(interpretMessage).toHaveBeenCalledOnce();
    expect(result.reply).toContain('מתי נוח לך לאסוף');
    expect(state()).toMatchObject({ step: 'rental_dates' });
  });

  it('gives a person the conversation even when policy keywords are present', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields });
    const result = await getWhatsAppFlowReply('972501234567', 'ביטוח, בבקשה שמישהו יחזור אליי', store);
    expect(result.escalate).toBe(true);
    expect(state()).toMatchObject({ handedOff: true });
  });

  it('honours a person request before the car sales catalogue', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields });
    const result = await getWhatsAppFlowReply('972501234567', 'אני רוצה לקנות רכב אבל לדבר קודם עם מישהו', store);
    expect(result.escalate).toBe(true);
    expect(state()).toMatchObject({ handedOff: true });
  });

  it('keeps a deterministic safety route when Gemini is unavailable', async () => {
    const { store, interpretMessage } = makeStore(null);
    const result = await getWhatsAppFlowReply('972501234567', 'יש תאונה', store);
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('גורמי החירום');
    expect(interpretMessage).not.toHaveBeenCalled();
  });
});
