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
  dropoffLocation: '', dropoffEvidence: '', pickupDate: '', dropoffDate: '', pickupTime: '', returnTime: '',
  passengers: 0, acknowledgement: '',
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

describe('Gemini understanding of free-form rental messages', () => {
  function inDays(days: number) {
    const date = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  it('takes resolved dates, group size and a natural acknowledgement from one message', async () => {
    const { store, state } = makeStore({
      intent: 'rental', ...emptyFields,
      pickupDate: inDays(4), dropoffDate: inDays(6), passengers: 6,
      vehiclePreference: 'VAN', vehicleEvidence: 'ל6 אנשים',
      acknowledgement: 'שישה אנשים זה בדיוק בשביל רכב 7 מקומות.',
    });
    const result = await getWhatsAppFlowReply('972501234567', 'היי אני צריך רכב לסופש הבא משהו גדול ל6 אנשים', store);
    expect(state()).toMatchObject({ pickupDate: inDays(4), dropoffDate: inDays(6), passengers: 6, vehiclePreference: 'VAN', step: 'rental_times' });
    expect(result.reply).toContain('שישה אנשים זה בדיוק');
    expect(result.reply).not.toContain('בשמחה, נמצא את הרכב');
  });

  it('answers a side question and repeats the missing detail instead of saying it did not understand', async () => {
    const { store } = makeStore({ intent: 'rental', ...emptyFields, acknowledgement: 'המחיר תלוי בתאריכים ובסוג הרכב, ואציג הצעות מהקטלוג ברגע שיהיו לי.' });
    await store.saveState('972501234567', { step: 'rental_dates', locale: 'he' });
    const result = await getWhatsAppFlowReply('972501234567', 'מה המחיר בערך?', store);
    expect(result.reply).toContain('המחיר תלוי בתאריכים');
    expect(result.reply).not.toContain('לא הצלחתי לזהות');
  });

  it('ignores a model date in the past', async () => {
    const { store, state } = makeStore({ intent: 'rental', ...emptyFields, pickupDate: '2020-01-01', dropoffDate: '2020-01-03' });
    await getWhatsAppFlowReply('972501234567', 'רוצה רכב לפני שנים', store);
    expect(state()?.pickupDate).toBeUndefined();
  });
});

describe('model acknowledgement guard', () => {
  it('drops sentences that state prices or contain links', async () => {
    const { safeAcknowledgement } = await import('@/lib/whatsapp-gemini');
    expect(safeAcknowledgement('זה יעלה בערך 300 ₪ ליום')).toBe('');
    expect(safeAcknowledgement('ראו https://example.com')).toBe('');
    expect(safeAcknowledgement('נשמע כמו טיול משפחתי מעולה.')).toBe('נשמע כמו טיול משפחתי מעולה.');
  });
});
