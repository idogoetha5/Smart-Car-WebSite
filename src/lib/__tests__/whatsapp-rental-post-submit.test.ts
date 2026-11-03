import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('rental status after simulated submission', () => {
  it('captures dates attached to Hebrew pickup and return locations without repeating known questions', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: async () => 'SIM-DATES', readTurn: async () => null,
    };
    const send = (message: string) => getRebuiltBotReply('fictional-hebrew-dates', message, store);
    await send('היי, מחפשים רכב לכמה ימים בדצמבר. אנחנו זוג ושני ילדים עם מזוודה גדולה. עוד מתלבטים אם קטן יספיק או שכדאי משפחתי.');
    const result = await send('בסדר, נבחר משפחתי ונתחיל בקשה. איסוף בתל אביב ב־10 בדצמבר 2026 והחזרה בנתבג ב־14 בדצמבר 2026. אני בן 35.');
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'תל אביב', returnLocation: 'נתבג', vehicleNeed: 'רכב משפחתי', driverAgeRange: '24-plus' });
    expect(result.state.step).toBe('rental_name');
    expect(result.reply).not.toMatch(/תאריך|מאיפה|להחזיר|שנתחיל/);
  });
  it.each([
    { start: 'אני רוצה לשכור רכב משפחתי', dates: '10/12/2026-15/12/2026', locations: 'איסוף בתל אביב והחזרה בירושלים', age: '24+', name: 'דני בדיקה', question: 'רגע לפני שליחה צריך כיסא בטיחות אחד. זו בקשה או מובטח?', confirm: 'אני מאשר', status: 'תודה. רק לוודא, הרכב עכשיו מאושר או שזו עדיין רק בקשה לבדיקה?', marker: 'לא אושר רכב', newRequest: 'אני רוצה לשכור רכב קטן' },
    { start: 'I want to rent a family car', dates: '10/12/2026-15/12/2026', locations: 'Pickup in Tel Aviv and return in Jerusalem', age: '24+', name: 'Danny Test', question: 'Before sending, we need one child seat. Is it guaranteed?', confirm: 'I confirm', status: 'Thanks. Just checking: is the car confirmed now, or is this still only a request for review?', marker: 'no car was confirmed', newRequest: 'I want to rent a compact car' },
  ])('submits once and answers the status without reopening intake: $name', async scenario => {
    let state: RebuildState | null = null;
    let created = 0;
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { created += 1; return 'SIM-POST-SUBMIT'; },
      readTurn: async () => null,
    };
    const send = (message: string) => getRebuiltBotReply('fictional-post-submit', message, store);
    for (const message of [scenario.start, scenario.dates, scenario.locations, scenario.age, scenario.name, scenario.question]) await send(message);
    const submitted = await send(scenario.confirm);
    expect(submitted.state.completedRequestId).toBe('SIM-POST-SUBMIT');
    expect(created).toBe(1);
    const status = await send(scenario.status);
    expect(status.reply).toContain(scenario.marker);
    expect(status.reply).not.toMatch(/Would you like|What dates|תאריכים|שנתחיל/);
    expect(status.state.phase).toBe('explore');
    expect(status.state.step).toBe('menu');
    const repeated = await send(scenario.confirm);
    expect(repeated.state.completedRequestId).toBe('SIM-POST-SUBMIT');
    expect(created).toBe(1);
    expect(repeated.reply).toMatch(/simulat|סימולציה/);
    const fresh = await send(scenario.newRequest);
    expect(fresh.state.phase).toBe('booking');
  });
});
