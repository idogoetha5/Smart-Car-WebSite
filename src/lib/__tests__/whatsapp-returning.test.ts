import { describe, expect, it } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';
import type { PastCustomer } from '@/lib/whatsapp-returning';

const DANI: PastCustomer = {
  name: 'דני כהן', email: 'dani@gmail.com', locale: 'he',
  lastRequest: { pickupDate: '2026-08-01', dropoffDate: '2026-08-05', pickupLocation: 'הרצליה', dropoffLocation: 'נתב״ג', vehiclePreference: 'SUV', status: 'PENDING', createdAt: '2026-07-28T10:00:00Z' },
};

async function chat(messages: string[], past: PastCustomer | null) {
  let state: FlowState | null = null;
  let lookups = 0;
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = next; },
    createRentalRequest: async () => 'REQ-9',
    pastCustomer: async () => { lookups += 1; return past; },
  };
  const replies: string[] = [];
  for (const message of messages) replies.push((await getWhatsAppFlowReply('972500000888', message, store)).reply ?? '');
  return { replies, state: state as FlowState | null, lookups };
}

describe('returning customers', () => {
  it('greets them by name instead of the welcome menu, and looks them up once per conversation', async () => {
    const { replies, lookups } = await chat(['היי', 'מה שעות הפתיחה'], DANI);
    expect(replies[0]).toMatch(/^היי דני, טוב לראות אותך שוב/);
    expect(replies[0]).not.toMatch(/1️⃣/);
    expect(lookups).toBe(1);
  });

  it('a new number still gets the usual welcome', async () => {
    const { replies } = await chat(['היי'], null);
    expect(replies[0]).toMatch(/ברוכים הבאים/);
  });

  it('does not ask again for the name and email: they go into the summary, partly hidden', async () => {
    const { replies, state } = await chat(['היי', 'צריך רכב מחר לשבוע', 'מתל אביב', 'לאותו מקום', 'משהו קטן'], DANI);
    expect(state).toMatchObject({ step: 'rental_confirm', customerName: 'דני כהן', customerEmail: 'dani@gmail.com' });
    expect(replies[4]).toMatch(/רשמתי על שם דני כהן/);
    expect(replies[4]).toMatch(/d\*\*\*@gmail\.com/);
    expect(replies[4]).toMatch(/הנה הסיכום/);
  });

  it('lets them change the name or email on the summary', async () => {
    const { replies, state } = await chat(['היי', 'צריך רכב מחר לשבוע', 'מתל אביב', 'לאותו מקום', 'משהו קטן', 'המייל השתנה: dani.new@walla.co.il'], DANI);
    expect(state?.customerEmail).toBe('dani.new@walla.co.il');
    expect(replies[5]).toMatch(/עדכנתי/);
  });

  it('"כמו בפעם הקודמת" fills the places and the car of the last request, never the dates', async () => {
    const { state, replies } = await chat(['היי', 'כמו בפעם הקודמת'], DANI);
    expect(state).toMatchObject({ pickupLocation: 'הרצליה', dropoffLocation: 'נתב״ג', vehiclePreference: 'SUV', step: 'rental_dates' });
    expect(state?.pickupDate).toBeUndefined();
    expect(replies[1]).toMatch(/כמו בפעם הקודמת/);
  });

  it('answers "מה עם הבקשה ששלחתי?" with the real status', async () => {
    const { replies } = await chat(['היי', 'מה עם הבקשה ששלחתי?'], DANI);
    expect(replies[1]).toMatch(/28\/07/);
    expect(replies[1]).toMatch(/אצל הצוות/);
  });
});
