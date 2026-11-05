import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation(locale: 'he' | 'en') {
  let state: RebuildState = { version: 2, phase: 'booking', step: 'rental_confirm', locale, history: [], booking: { pickupDate: '2026-12-10', returnDate: '2027-02-10', pickupLocation: locale === 'he' ? 'הרצליה' : 'Herzliya', returnLocation: locale === 'he' ? 'הרצליה' : 'Herzliya', vehicleNeed: locale === 'he' ? 'רכב משפחתי' : 'family car', driverAgeRange: '24-plus', passengers: 2, luggage: 1, customerName: 'Fictional Demo' } };
  const create = vi.fn(async () => 'SIM-CORRECTED');
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn: async () => null };
  return { send: (input: string) => getRebuiltBotReply('fictional-reversed-route', input, store), create };
}

describe('return-first correction with unchanged pickup', () => {
  it.each([
    ['he', 'רגע, שינוי קטן לפני האישור: ההחזרה תהיה בתל אביב ב-11 בפברואר 2027, לא בהרצליה. האיסוף מהרצליה נשאר ב-10 בדצמבר 2026. כל היתר בלי שינוי.', 'הרצליה', 'תל אביב'],
    ['en', 'A small change before confirmation: return will be in Tel Aviv on 11 February 2027, not Herzliya. Pickup from Herzliya stays on 10 December 2026. Everything else is unchanged.', 'Herzliya', 'Tel Aviv'],
    ['en', 'Return in Tel Aviv on 11.02.2027. Pickup from Herzliya stays on 10.12.2026.', 'Herzliya', 'Tel Aviv'],
  ] as const)('uses role labels independently of sentence order: %s', async (locale, correction, pickup, dropoff) => {
    const chat = conversation(locale);
    const result = await chat.send(correction);
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-12-10', returnDate: '2027-02-11', pickupLocation: pickup, returnLocation: dropoff, passengers: 2, luggage: 1, customerName: 'Fictional Demo' });
    expect(result.reply).toContain('11/02/2027');
    expect(result.reply).not.toContain('הרצליה נשאר');
    expect(result.escalate).toBe(false);
    expect(chat.create).not.toHaveBeenCalled();
  });
  it('leaves an undecided return comparison unselected', async () => {
    const result = await conversation('en').send('Return on 11 February 2027 or 12 February 2027? I have not decided.');
    expect(result.state.booking.returnDate).toBe('2027-02-10');
  });
});
