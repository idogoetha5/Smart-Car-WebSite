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
  it('retains the exact English family count alongside route dates and luggage', async () => {
    const result = await conversation().send('Hi, we are two adults and two children with two suitcases. We need a rental from Ben Gurion Airport on 8 December 2026 and return it in Tel Aviv on 13 December 2026. I am 35. I am not sure which car to choose.');
    expect(result.state.booking).toMatchObject({ passengers: 4, luggage: 2, pickupDate: '2026-12-08', returnDate: '2026-12-13', pickupLocation: 'Ben Gurion Airport', returnLocation: 'Tel Aviv', driverAgeRange: '24-plus' });
  });

  it('retains English from/on route locations without model extraction and answers a model guarantee before intake', async () => {
    const chat = conversation();
    const first = await chat.send('Hi, I would like to rent a compact car from Ben Gurion Airport on 8 December 2026 and return it in Tel Aviv on 13 December 2026. I am 35 and travelling alone with one suitcase.');
    expect(first.state.booking).toMatchObject({ pickupLocation: 'Ben Gurion Airport', returnLocation: 'Tel Aviv', pickupDate: '2026-12-08', returnDate: '2026-12-13', driverAgeRange: '24-plus', passengers: 1, luggage: 1 });
    expect(first.state.step).toBe('rental_name');
    expect(first.reply).not.toMatch(/Where would you like to pick|Where will you return/i);
    const model = await chat.send('Before we continue, is the exact model guaranteed, or only a car group?');
    expect(model.reply).toContain('exact model is not guaranteed unless SmartCar explicitly confirms it');
    expect(model.state.booking.pickupLocation).toBe('Ben Gurion Airport');
    expect(model.state.booking.returnLocation).toBe('Tel Aviv');
    expect(model.reply).not.toMatch(/Where would you like to pick|Where will you return/i);
  });
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

  it.each([
    ['Alex Demo. I would rather not give an email. Actually please return it on 14 December 2026 in Jerusalem instead of Tel Aviv.', 'Alex Demo'],
    ['דני בדיקה. לא רוצה למסור מייל. בעצם נחזיר ב־14 בדצמבר 2026 בירושלים במקום תל אביב.', 'דני בדיקה'],
  ])('keeps a prompted name private alongside optional-email refusal and return correction: %s', async (message, name) => {
    const chat = conversation();
    await chat.send('I want to rent a family car from Ben Gurion Airport on 8 December 2026 and return it in Tel Aviv on 13 December 2026. I am 35. Two adults and two children with two suitcases.');
    chat.readTurn.mockClear();
    const result = await chat.send(message);
    expect(result.state.booking).toMatchObject({ customerName: name, returnDate: '2026-12-14', returnLocation: /[א-ת]/u.test(name) ? 'ירושלים' : 'Jerusalem', passengers: 4, luggage: 2 });
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking.customerEmail).toBeUndefined();
    expect(chat.readTurn).not.toHaveBeenCalled();
    expect(chat.createRentalRequest).not.toHaveBeenCalled();
  });

  it('does not treat an explicit refusal to start as consent', async () => {
    const result = await conversation().send('לא נתחיל בקשה עכשיו, אני רק שואל על רכב משפחתי');
    expect(result.state.phase).toBe('explore');
  });
});
