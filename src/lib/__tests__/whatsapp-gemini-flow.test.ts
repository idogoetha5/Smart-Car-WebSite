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
    expect(state()).toMatchObject({ pickupDate: inDays(4), dropoffDate: inDays(6), passengers: 6, vehiclePreference: 'VAN', step: 'rental_locations' });
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

describe('small talk', () => {
  it('never hands "מה קורה" to a representative, even if the model says so', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields, acknowledgement: 'הכול טוב, תודה!' });
    const result = await getWhatsAppFlowReply('972501234567', 'מה קורה', store);
    expect(result.escalate).toBeFalsy();
    expect(state()?.handedOff).toBeFalsy();
    expect(result.reply).toContain('הכול טוב');
  });
});

describe('questions without a model answer', () => {
  it('answers a branches question during rental intake', async () => {
    const { store } = makeStore({ intent: 'unknown', ...emptyFields });
    await store.saveState('972501234567', { step: 'rental_locations', locale: 'he', pickupDate: '2099-01-01', dropoffDate: '2099-01-05' });
    const result = await getWhatsAppFlowReply('972501234567', 'איזה סניפים?', store);
    expect(result.reply).toContain('סניפים');
    expect(result.reply).not.toContain('לא זיהיתי');
  });
});

describe('questions answered from the website', () => {
  it('answers a general question with the model reply instead of a menu', async () => {
    const { store } = makeStore({ intent: 'policy', ...emptyFields, acknowledgement: 'הפיקדון תלוי בקטגוריה, החל מ־₪1,000 לרכב כלכלי.' });
    const result = await getWhatsAppFlowReply('972501234567', 'כמה הפיקדון?', store);
    expect(result.reply).toContain('₪1,000');
    expect(result.escalate).toBeFalsy();
  });
});

describe('Gemini answers win over keyword routing', () => {
  it('answers "how can I call you?" instead of handing off', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields, acknowledgement: 'אפשר להתקשר אלינו ל־09-9509757.' });
    const result = await getWhatsAppFlowReply('972501234567', 'איך אפשר להתקשר אליכם?', store);
    expect(result.escalate).toBeFalsy();
    expect(result.reply).toContain('09-9509757');
    expect(state()?.handedOff).toBeFalsy();
  });

  it('answers a leasing-length question and offers a representative', async () => {
    const { store } = makeStore({ intent: 'leasing', ...emptyFields, acknowledgement: 'תקופות הליסינג הן 12 עד 60 חודשים.' });
    const result = await getWhatsAppFlowReply('972501234567', 'לכמה זמן אפשר ליסינג?', store);
    expect(result.reply).toContain('12 עד 60');
    expect(result.reply).toContain('הצעת ליסינג');
  });

  it('still hands off when a person is asked for explicitly', async () => {
    const { store } = makeStore({ intent: 'representative', ...emptyFields, acknowledgement: 'בשמחה.' });
    const result = await getWhatsAppFlowReply('972501234567', 'אפשר לדבר עם נציג?', store);
    expect(result.escalate).toBe(true);
  });
});
