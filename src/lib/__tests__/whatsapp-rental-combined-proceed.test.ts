import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const readTurn = vi.fn(async () => null);
  const createRentalRequest = vi.fn(async () => 'SIM-COMBINED');
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest, readTurn,
  };
  return { send: (message: string) => getRebuiltBotReply('fictional-combined', message, store), readTurn, createRentalRequest };
}

describe('combined rental consent, corrections and private name', () => {
  it('handles the exact Hebrew advice-to-request turn with a new return date and city', async () => {
    const chat = conversation();
    await chat.send('היי אנחנו זוג עם שני ילדים ומזוודה גדולה, צריכים רכב מ־10 עד 14 בדצמבר 2026. איסוף בתל אביב והחזרה בנתבג. אני בן 35. לא סגור איזה רכב מתאים.');
    await chat.send('לפני בקשה, כדאי קטן או משפחתי? והאם אפשר לבקש כיסא בטיחות לילד בן שלוש?');
    const modelCalls = chat.readTurn.mock.calls.length;
    const result = await chat.send('כן נתחיל בקשה, אני בוחר משפחתי. ובעצם נחזיר ב־15 בדצמבר בירושלים במקום בנתבג. השם הוא דני בדיקה ואין לי מייל.');
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking).toMatchObject({ customerName: 'דני בדיקה', vehicleNeed: 'רכב משפחתי', pickupDate: '2026-12-10', returnDate: '2026-12-15', pickupLocation: 'תל אביב', returnLocation: 'ירושלים', driverAgeRange: '24-plus', passengers: 4, luggage: 1 });
    expect(result.reply).toContain('החזרה: ירושלים');
    expect(result.reply).toContain('שם: דני בדיקה');
    expect(result.reply).not.toContain('שנתחיל');
    expect(chat.readTurn.mock.calls.length).toBe(modelCalls);
    expect(chat.createRentalRequest).not.toHaveBeenCalled();
  });

  it('captures the English equivalent before entering the name step or sending it to Gemini', async () => {
    const chat = conversation();
    await chat.send('We are two adults and two children with one large suitcase. Pickup in Tel Aviv and return in Ben Gurion Airport, 10/12/2026-14/12/2026. I am 35. I have not chosen a car yet.');
    await chat.send('Before starting, should we choose a small or family car? Can we request a child seat?');
    const modelCalls = chat.readTurn.mock.calls.length;
    const result = await chat.send('Let us start a request. I choose a family car. Actually return on 15 December in Jerusalem instead of Ben Gurion Airport. My name is Danny Test and I have no email.');
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking).toMatchObject({ customerName: 'Danny Test', vehicleNeed: 'family car', pickupDate: '2026-12-10', returnDate: '2026-12-15', pickupLocation: 'Tel Aviv', returnLocation: 'Jerusalem', driverAgeRange: '24-plus' });
    expect(chat.readTurn.mock.calls.length).toBe(modelCalls);
    expect(chat.createRentalRequest).not.toHaveBeenCalled();
  });

  it('does not treat an explicit refusal to start as consent', async () => {
    const result = await conversation().send('לא נתחיל בקשה עכשיו, אני רק שואל על רכב משפחתי');
    expect(result.state.phase).toBe('explore');
  });
});
