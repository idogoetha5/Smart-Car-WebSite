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
  it('retains a spaciousness need supplied with a private name and WhatsApp instruction', async () => {
    const send = chat({ version: 2, phase: 'booking', step: 'rental_name', locale: 'he', booking: { pickupDate: '2026-12-11', returnDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון', vehicleNeed: 'רכב מנהלים יוקרתי (העדפה לבדיקה)', passengers: 2, driverAgeRange: '24-plus' }, history: [{ from: 'bot', text: 'על איזה שם לרשום את הבקשה?' }] });
    const result = await send('על שם יעל בדיקה. תעדכנו אותי בוואטסאפ הזה, וחשוב לי שהבקשה תציין שהעדיפות היא לרכב מנהלים מרווח.');
    expect(result.state.booking).toMatchObject({ customerName: 'יעל בדיקה', vehicleNeed: 'רכב מנהלים יוקרתי ומרווח (העדפה לבדיקה)' });
    expect(result.state.step).toBe('rental_extras');
    expect(result.escalate).toBe(false);
  });

  it('keeps definite Friday, linked route and executive preference when the brand is tentative', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'explore', direction: 'none', fields: {}, factPatches: [], reply: 'רכב מנהלים הוא כיוון מתאים; דגמים מסוימים וזמינות נבדוק לפני אישור.', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-tentative-brand', 'היי, אני מחפשת רכב מנהלים מפנק, אולי משהו בסגנון מרצדס, ליום שישי 11.12. אאסוף ואחזיר בהוד השרון. יש סוגים שמתאימים לזה?', store);
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון', vehicleNeed: 'רכב מנהלים יוקרתי (העדפה לבדיקה)' });
  });

  it('does not replace a luxury-options answer with a premature booking arrangement', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'explore', direction: 'none', fields: { pickupDate: { value: '2026-12-11', evidence: 'ליום שישי 11.12' } }, factPatches: [], reply: 'נשמח לבדוק אפשרות לרכב מנהלים יוקרתי ליום שישי 11.12. תרצו שנתאם את ההזמנה לתאריכים האלו?', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-options-action', 'צריכה רכב מנהלים יוקרתי בסגנון מרצדס ליום שישי 11.12. אילו אפשרויות יש?', store);
    expect(result.reply).toMatch(/דגם|קטגור|סוג רכב/);
    expect(result.reply).not.toMatch(/נתאם את ההזמנה/);
  });

  it('does not replace a saved return place with a same-day time or ask for extras before a name', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון', vehicleNeed: 'רכב מנהלים יוקרתי (העדפה לבדיקה)' }, history: [{ from: 'bot', text: 'האם תרצו שנתקדם בבדיקת הזמינות לתאריכים האלו?' }] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'book', direction: 'none', fields: { returnDate: { value: '2026-12-11', evidence: 'אחזיר באותו יום בערב' }, returnLocation: { value: 'אותו יום בערב', evidence: 'אחזיר באותו יום בערב' } }, factPatches: [], reply: 'עבור שני נוסעים ונהג בן 50, נשאר רק לברר אם תרצו תוספות כמו נהג נוסף או כיסא בטיחות לפני שנסיים את הפרטים.', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-temporal-return', 'כן, בואו נתקדם עם שישי בלבד. אחזיר באותו יום בערב. נהיה שני נוסעים בלי ציוד, הנהג בן 50. מה עוד צריך בשביל הבקשה?', store);
    expect(result.state.booking).toMatchObject({ returnDate: '2026-12-11', returnLocation: 'הוד השרון', passengers: 2, driverAgeRange: '24-plus' });
    expect(result.reply).toMatch(/שם/);
    expect(result.reply).not.toMatch(/תוספות|כיסא בטיחות|נהג נוסף/);
  });

  it('does not turn a pickup-only Friday into a return date and keeps linked self-pickup', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'explore', direction: 'none', fields: { pickupDate: { value: '2026-12-11', evidence: 'ליום שישי 11.12' }, returnDate: { value: '2026-12-11', evidence: 'ליום שישי 11.12' }, returnLocation: { value: 'הוד השרון', evidence: 'ואחזיר בהוד השרון' } }, factPatches: [], reply: 'אפשר לברר דגמים מדויקים אם תרצו.', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-linked-route', 'צריכה רכב מנהלים יוקרתי ליום שישי 11.12. אאסוף ואחזיר בהוד השרון. אילו אפשרויות יש?', store);
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון' });
    expect(result.state.booking.returnDate).toBeUndefined();
  });

  it('keeps self-pickup and rejects an invented home-delivery offer', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'explore', direction: 'none', fields: { pickupLocation: { value: 'הוד השרון', evidence: 'אאסוף ואחזיר בהוד השרון' }, returnLocation: { value: 'הוד השרון', evidence: 'אאסוף ואחזיר בהוד השרון' } }, factPatches: [], reply: 'אפשר לתאם איסוף והחזרה בהוד השרון, ואנחנו מספקים שירות רכב עד הבית לכל מקום שתרצו בתיאום מראש. לגבי רכב מנהלים יוקרתי, נציג יוכל לבדוק דגמים.', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-self-pickup', 'צריכה רכב מנהלים יוקרתי בסגנון מרצדס. אאסוף ואחזיר בהוד השרון. אילו אפשרויות יש?', store);
    expect(result.state.booking).toMatchObject({ pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון', vehicleNeed: 'רכב מנהלים יוקרתי (העדפה לבדיקה)' });
    expect(result.reply).toMatch(/רכב מנהלים יוקרתי/);
    expect(result.reply).not.toMatch(/עד הבית/);
  });

  it('keeps the fallback on the actual options question when Gemini claims an unperformed handoff', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'explore', direction: 'none', fields: { pickupDate: { value: '2026-12-11', evidence: 'יום שישי 11.12' } }, factPatches: [], reply: 'נציג SmartCar יבדוק עבורכם את האפשרויות.', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-luxury-options', 'אני מחפשת רכב מנהלים יוקרתי בסגנון מרצדס ליום שישי 11.12. איסוף והחזרה בהוד השרון. אולי אקדים לחמישי. אילו אפשרויות יש?', store);
    expect(result.state.booking.vehicleNeed).toMatch(/מנהלים יוקרתי/);
    expect(result.reply).toMatch(/העדפה.*רכב מנהלים יוקרתי|ההעדפה לרכב מנהלים יוקרתי/);
    expect(result.reply).toMatch(/חמישי/);
    expect(result.reply).not.toMatch(/תרצו שנתקדם לבקשה/);
  });

  it('stores a model-grounded same-day return and answers which details are missing', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-12-11', pickupLocation: 'הוד השרון', returnLocation: 'הוד השרון', vehicleNeed: 'רכב מנהלים יוקרתי (העדפה לבדיקה)' }, history: [{ from: 'bot', text: 'באיזה תאריך תחזירו את הרכב?' }] };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('No formal booking'); },
      readTurn: async () => ({ route: 'book', direction: 'none', fields: { returnDate: { value: '2026-12-11', evidence: 'באותו יום' } }, factPatches: [], reply: 'תרצו להוסיף כיסא בטיחות?', source: 'gemini', model: 'test', groundedContext: true }),
    };
    const result = await getRebuiltBotReply('fictional-same-day-return', 'החזרה בשישי בערב, באותו יום. נלך על שני נוסעים בלי ציוד; מה עוד חסר לכם לבקשה?', store);
    expect(result.state.booking.returnDate).toBe('2026-12-11');
    expect(result.state.booking.passengers).toBe(2);
    expect(result.reply).toMatch(/קבוצת הגיל של הנהג/);
    expect(result.reply).toMatch(/השם לרישום הפנייה/);
    expect(result.reply).not.toMatch(/תרצו להוסיף כיסא בטיחות|נתקדם לבקשה/);
  });

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
