import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat(initial: RebuildState) {
  let state = initial;
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => { throw new Error('The intake must not create a formal booking'); },
    readTurn: async () => ({ route: 'book', direction: 'none', fields: {}, factPatches: [], reply: 'בשמחה, נבדוק את ההעדפה לרכב מנהלים מול נציג SmartCar.', source: 'gemini', model: 'test', groundedContext: true }),
  };
  return (message: string) => getRebuiltBotReply('fictional-owl-regression', message, store);
}

describe('luxury rental intake observed in the live inbox', () => {
  it('keeps the executive-car preference instead of replacing it with a passenger count', async () => {
    const send = chat({ version: 2, phase: 'booking', step: 'rental_vehicle', locale: 'he', booking: { pickupDate: '2026-12-11', returnDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון' }, history: [{ from: 'bot', text: 'איזה סוג רכב תרצו, או כמה נוסעים וציוד יהיו?' }] });
    const result = await send('רכב מנהלים יוקרתי כדוגמת מרצדס. 2 נוסעים ללא ציוד');
    expect(result.state.booking.vehicleNeed).toMatch(/מנהלים יוקרתי/);
    expect(result.state.booking.passengers).toBe(2);
    expect(result.reply).toMatch(/גיל הנהג|קבוצת הגיל/);
  });

  it('accepts 24 and over, then a name with a parenthetical non-driver clarification', async () => {
    const send = chat({ version: 2, phase: 'booking', step: 'rental_age', locale: 'he', booking: { pickupDate: '2026-12-11', returnDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון', vehicleNeed: 'רכב מנהלים יוקרתי (העדפה לבדיקה)', passengers: 2 }, history: [{ from: 'bot', text: 'בן כמה הנהג? מספיקה לנו קבוצת הגיל: 21–23 או 24 ומעלה.' }] });
    const age = await send('24 ומעלה');
    expect(age.state.booking.driverAgeRange).toBe('24-plus');
    expect(age.reply).toMatch(/שם/);
    expect(age.reply).not.toMatch(/בן כמה הנהג/);
    const named = await send('עינת בדיקה (אני לא הנהגת)');
    expect(named.state.booking.customerName).toBe('עינת בדיקה');
    expect(named.reply).toMatch(/להוסיף משהו/);
    expect(named.reply).not.toMatch(/על איזה שם/);
  });
});
