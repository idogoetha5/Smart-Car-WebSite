import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('child-seat question before rental consent', () => {
  it.each([
    { request: 'אני רוצה לשכור רכב משפחתי 10/12/2026-15/12/2026 איסוף בתל אביב והחזרה בירושלים. אני בן 35.', name: 'דני בדיקה', seat: 'רגע, לפני שליחה צריך גם כיסא בטיחות אחד. זה מובטח או רק בקשה?', answer: 'בקשה בלבד, לא הבטחה', summary: 'בקשת כיסאות בטיחות: 1', confirm: 'אני מאשר' },
    { request: 'I want to rent a family car 10/12/2026-15/12/2026, pickup in Tel Aviv and return in Jerusalem. I am 35.', name: 'Danny Test', seat: 'Before sending, we need one child seat. Is it guaranteed or only a request?', answer: 'request only, not a guarantee', summary: 'Requested child seats: 1', confirm: 'I confirm' },
  ])('answers the seat question and includes it in the handoff summary: $name', async scenario => {
    let state: RebuildState | null = null;
    const created: RebuildState[] = [];
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async (_phone, next) => { created.push(structuredClone(next)); return 'SIM-SEAT'; },
      readTurn: async () => null,
    };
    const send = (message: string) => getRebuiltBotReply('fictional-seat', message, store);
    await send(scenario.request);
    const ready = await send(scenario.name);
    expect(ready.state.step).toBe('rental_extras');
    const result = await send(scenario.seat);
    expect(result.reply).toMatch(/כיסא.*בקשה|child seat.*request/iu);
    expect(result.state.booking.childSeats).toBe(1);
    expect(result.state.step).toBe('rental_extras');
    expect(created).toHaveLength(0);
    const final = await send(/[א-ת]/u.test(scenario.name) ? 'זה הכל' : 'No other extras');
    expect(final.escalate).toBe(true);
    expect(final.reply).toMatch(/כיסא|child seat/iu);
    expect(final.state.completedRental?.childSeats).toBe(1);
    expect(created).toHaveLength(0);
  });
});
