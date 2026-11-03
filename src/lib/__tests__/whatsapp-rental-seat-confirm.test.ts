import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('child-seat question before rental consent', () => {
  it.each([
    { request: 'אני רוצה לשכור רכב משפחתי 10/12/2026-15/12/2026 איסוף בתל אביב והחזרה בירושלים. אני בן 35.', name: 'דני בדיקה', seat: 'רגע, לפני שליחה צריך גם כיסא בטיחות אחד. זה מובטח או רק בקשה?', answer: 'בקשה בלבד, לא הבטחה', summary: 'בקשת כיסאות בטיחות: 1', confirm: 'אני מאשר' },
    { request: 'I want to rent a family car 10/12/2026-15/12/2026, pickup in Tel Aviv and return in Jerusalem. I am 35.', name: 'Danny Test', seat: 'Before sending, we need one child seat. Is it guaranteed or only a request?', answer: 'request only, not a guarantee', summary: 'Requested child seats: 1', confirm: 'I confirm' },
  ])('answers the seat question and persists it only after consent: $name', async scenario => {
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
    expect(ready.state.step).toBe('rental_confirm');
    const result = await send(scenario.seat);
    expect(result.reply).toContain(scenario.answer);
    expect(result.reply).toContain(scenario.summary);
    expect(result.state.booking.childSeats).toBe(1);
    expect(result.state.step).toBe('rental_confirm');
    expect(created).toHaveLength(0);
    await send(scenario.confirm);
    expect(created).toHaveLength(1);
    expect(created[0].booking.childSeats).toBe(1);
  });
});
