import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function draft(history: RebuildState['history']): RebuildState {
  return {
    version: 2, phase: 'explore', step: 'menu', locale: 'he', history,
    booking: {
      pickupDate: '2026-12-01', returnDate: '2026-12-08',
      pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב משפחתי',
    },
  };
}

function conversation(initial: RebuildState) {
  let state: RebuildState | null = initial;
  const createRentalRequest = vi.fn(async () => 'SIM-REQUEST');
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest, readTurn: async () => null,
  };
  return { send: (message: string) => getRebuiltBotReply('972500000000', message, store), createRentalRequest };
}

describe('live name-prompt rental dead end', () => {
  it('treats a bare name answering the bot as intake and asks only the missing age', async () => {
    const { send } = conversation(draft([{ from: 'bot', text: 'באיזה שם תרצו שהבקשה תהיה רשומה?' }]));
    const result = await send('שרון בדיקה');
    expect(result.state.booking.customerName).toBe('שרון בדיקה');
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_age');
    expect(result.reply).toMatch(/גיל|21–23|24/);
    expect(result.reply).not.toMatch(/משהו נוסף|עוד משהו/);
  });

  it('recovers a name already given before deployment, retains the seat, and submits only after final consent', async () => {
    const { send, createRentalRequest } = conversation({
      ...draft([
        { from: 'bot', text: 'באיזה שם תרצו שהבקשה תהיה רשומה?' },
        { from: 'customer', text: 'שרון בדיקה' },
        { from: 'bot', text: 'האם תרצו להוסיף משהו נוסף?' },
        { from: 'customer', text: 'כיסא תינוק' },
        { from: 'bot', text: 'האם תרצו להוסיף משהו נוסף לפני שנשלח את הפרטים?' },
      ]),
      booking: { ...draft([]).booking, childSeats: 1 },
    });
    const continued = await send('לא, זה הכל');
    expect(continued.state.booking).toMatchObject({ customerName: 'שרון בדיקה', childSeats: 1 });
    expect(continued.state.step).toBe('rental_age');
    expect(continued.reply).not.toMatch(/משהו נוסף|עוד משהו/);
    expect(createRentalRequest).not.toHaveBeenCalled();

    const age = await send('אני בת 35');
    expect(age.state.step).toBe('rental_confirm');
    expect(age.reply).toContain('שרון בדיקה');
    expect(age.reply).toContain('בקשת כיסאות בטיחות: 1');
    expect(createRentalRequest).not.toHaveBeenCalled();

    const confirmed = await send('אני מאשרת');
    expect(confirmed.state.completedRequestId).toBe('SIM-REQUEST');
    expect(confirmed.escalate).toBe(true);
    expect(createRentalRequest).toHaveBeenCalledOnce();
  });
});
