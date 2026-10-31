import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => 'SIM-INTENT',
    readTurn: async () => null,
  };
  return (message: string) => getRebuiltBotReply('fictional-intent', message, store);
}

describe('rental advice to explicit intake', () => {
  it('starts the chosen family request after solo advice and insurance without asking for consent again', async () => {
    const send = chat();
    await send('אני נוסע לבד עם מזוודה אחת, איזה רכב כדאי?');
    await send('קטן או משפחתי? עוד לא החלטתי');
    await send('ומה כלול בביטוח?');
    const result = await send('אוקיי החלטתי על משפחתי. אני רוצה להתחיל בקשה מ-10/12 עד 14/12, איסוף מהרצליה והחזרה בתל אביב, אני בן 31.');
    expect(result.state.phase).toBe('booking');
    expect(result.state.step).toBe('rental_name');
    expect(result.state.booking).toMatchObject({ vehicleNeed: 'רכב משפחתי', pickupLocation: 'הרצליה', returnLocation: 'תל אביב', driverAgeRange: '24-plus' });
    expect(result.state.booking.pickupDate).toMatch(/-12-10$/);
    expect(result.state.booking.returnDate).toMatch(/-12-14$/);
    expect(result.reply).not.toContain('שנתחיל');
    const name = await send('דניאל בדיקה');
    expect(name.state.step).toBe('rental_confirm');
    expect(name.reply).toContain('רכב משפחתי');
  });

  it('recognizes a customer reminder that they already asked to start', async () => {
    const send = chat();
    await send('רכב קטן לטיול לבד');
    const result = await send('כן, כבר ביקשתי להתחיל.');
    expect(result.state.phase).toBe('booking');
    expect(result.reply).not.toContain('שנתחיל');
  });

  it('does not start intake when the customer explicitly refuses to start', async () => {
    const result = await chat()('אני לא רוצה להתחיל בקשה. רק מתעניין ברכב משפחתי');
    expect(result.state.phase).toBe('explore');
  });
});
