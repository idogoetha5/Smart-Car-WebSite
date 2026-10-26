import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, isRebuiltSafetyMessage, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

const base: BotReading = { route: 'explore', direction: 'none', reply: 'אפשר להתאים לכם רכב של SmartCar. לאילו תאריכים תצטרכו אותו?', fields: {}, source: 'gemini', model: 'gemini-3.5-flash-lite' };

function memory(reading: (message: string) => BotReading | null = () => base) {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'SIM-123');
  const readTurn = vi.fn(async (message: string) => reading(message));
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: create,
    readTurn,
  };
  const send = (message: string) => getRebuiltBotReply('fictional', message, store);
  return { send, create, readTurn, state: () => state };
}

describe('replacement SmartCar conversation core', () => {
  it('uses sales preferences already given when asked about available models', async () => {
    const chat = memory(() => null);
    await chat.send('אני רוצה לקנות רכב משפחתי עד 80 אלף שקל');
    const models = await chat.send('איזה דגמים זמינים?');
    expect(models.reply).toContain('להעדפות שכבר מסרתם');
    expect(models.reply).not.toMatch(/איזה סוג רכב|מה התקציב/);
    const accepted = await chat.send('כן');
    expect(accepted.escalate).toBe(true);
  });

  it('answers leasing price in customer language and handles a direct test-drive request', async () => {
    const leasing = memory(() => null);
    await leasing.send('אני מחפש ליסינג פרטי לשנתיים');
    const price = await leasing.send('כמה זה עולה בחודש?');
    expect(price.reply).toContain('התשלום החודשי תלוי');
    expect(price.reply).not.toMatch(/אי אפשר להבטיח|להעביר לצוות|כדי שיבדוק/);
    const sale = memory(() => ({ ...base, route: 'explore', reply: 'באיזה סניף תרצה לקבוע נסיעת מבחן?' }));
    const drive = await sale.send('אני רוצה לקבוע נסיעת מבחן לרכב משפחתי');
    expect(drive.escalate).toBe(true);
    expect(drive.reply).toContain('לאישור התור');
  });

  it('remembers a numeric date range from a WhatsApp-style short answer', async () => {
    const chat = memory(() => null);
    await chat.send('אני רוצה לשכור רכב');
    const vehicle = await chat.send('ג׳יפ');
    expect(vehicle.reply).toContain('רשמתי רכב פנאי');
    expect(vehicle.state.booking.vehicleNeed).toBe('רכב פנאי');
    const dates = await chat.send('15/11-26/11');
    expect(dates.state.booking.pickupDate).toMatch(/-11-15$/);
    expect(dates.state.booking.returnDate).toMatch(/-11-26$/);
    expect(dates.reply).toContain('מאיפה');
    const price = await chat.send('כמה זה יעלה?');
    expect(price.reply).not.toMatch(/באתר|מלאי|אין לי/);
  });

  it('normalizes a model-extracted SUV to customer-facing Hebrew', async () => {
    const chat = memory(message => message === 'ג׳יפ'
      ? { ...base, fields: { vehicleNeed: { value: 'suv', evidence: 'ג׳יפ' } } }
      : null);
    await chat.send('אני רוצה לשכור רכב');
    const vehicle = await chat.send('ג׳יפ');
    expect(vehicle.state.booking.vehicleNeed).toBe('רכב פנאי');
    expect(vehicle.reply).toContain('רשמתי רכב פנאי');
  });

  it.each([
    'אין לי גישה למלאי כרגע. מאיפה תרצו לאסוף?',
    'המחיר באתר הוא הערכה, לא הצעה סופית. מה התאריכים?',
    'זה כיוון לבדיקה, הצוות צריך לבדוק. מה התאריכים?',
  ])('does not expose internal process wording drafted by Gemini: %s', async draftedReply => {
    const chat = memory(() => ({ ...base, reply: draftedReply }));
    const result = await chat.send('אני מחפש רכב פנאי לטיול');
    expect(result.reply).not.toMatch(/אין לי גישה|המחיר באתר|כיוון לבדיקה|הצוות צריך לבדוק/);
    expect(result.reply).toContain('SmartCar');
  });

  it('remembers useful consultation details when the customer later asks to proceed', async () => {
    const chat = memory(() => base);
    const advice = await chat.send('אני מחפש רכב פנאי');
    expect(advice.state.phase).toBe('explore');
    expect(advice.state.booking.vehicleNeed).toBe('רכב פנאי');
    const details = await chat.send('אני צריך אותו מ-10 עד 13 בנובמבר, איסוף בתל אביב והחזרה באותו מקום');
    expect(details.state.booking).toMatchObject({ vehicleNeed: 'רכב פנאי', pickupLocation: 'תל אביב', returnLocation: 'תל אביב' });
    expect(details.state.booking.pickupDate).toMatch(/-11-10$/);
    expect(details.state.booking.returnDate).toMatch(/-11-13$/);
    const proceed = await chat.send('בוא נתקדם');
    expect(proceed.state.phase).toBe('booking');
    expect(proceed.state.step).toBe('rental_age');
    expect(proceed.reply).not.toMatch(/תאריך|מאיפה|איזה סוג רכב/);
  });

  it('finishes the rental after a vehicle-only opener and short answers', async () => {
    const chat = memory(() => ({ ...base, reply: 'רכב פנאי הוא בחירה נוחה. באילו תאריכים תרצה לאסוף את הרכב?' }));
    const first = await chat.send('אני רוצה רכב פנאי');
    expect(first.state.phase).toBe('booking');
    expect(first.state.booking.vehicleNeed).toBe('רכב פנאי');
    expect(first.reply).toBe('באיזה תאריך תרצו לאסוף את הרכב?');
    expect((await chat.send('כן')).reply).toBe('באיזה תאריך תרצו לאסוף את הרכב?');
    expect((await chat.send('10 בנובמבר')).state.booking.pickupDate).toMatch(/-11-10$/);
    expect((await chat.send('13 בנובמבר')).state.booking.returnDate).toMatch(/-11-13$/);
    expect((await chat.send('תל אביב')).state.booking.pickupLocation).toBe('תל אביב');
    expect((await chat.send('אותו מקום')).state.booking.returnLocation).toBe('תל אביב');
    expect((await chat.send('24+')).state.step).toBe('rental_name');
    expect((await chat.send('דני בדיקה')).state.step).toBe('rental_email');
    expect((await chat.send('dani.test@example.com')).state.step).toBe('rental_confirm');
    expect((await chat.send('אני מאשר')).escalate).toBe(true);
    expect(chat.create).toHaveBeenCalledOnce();
  });

  it('moves past the exact repeated yes pattern reported by the owner', async () => {
    const offer = 'בסדר גמור, ללא ציוד נוסף. האם נמשיך לבדיקת זמינות לרכב פנאי (SUV) לתאריכים שבחרת?';
    const chat = memory(() => ({ ...base, reply: offer }));
    const first = await chat.send('אני מחפש רכב פנאי לסוף שבוע');
    expect(first.reply).not.toContain('לתאריכים שבחרת');
    const next = await chat.send('כן');
    expect(next.state.phase).toBe('explore');

    const direct = memory(() => ({ ...base, reply: 'האם נמשיך לבדיקת זמינות לרכב פנאי (SUV)?' }));
    await direct.send('אני מחפש רכב פנאי לסוף שבוע');
    const accepted = await direct.send('נו כן');
    expect(accepted.state.phase).toBe('booking');
    expect(accepted.state.booking.vehicleNeed).toBe('רכב פנאי');
    expect(accepted.reply).toContain('תאריך');
    expect(accepted.reply).not.toMatch(/האם נמשיך|האם תרצה/);
    expect(direct.readTurn).toHaveBeenCalledOnce();
  });

  it.each([
    'האם נמשיך לבדיקת זמינות לרכב פנאי לתאריכים שבחרת?',
    'האם תרצה שנתקדם בהזמנה?',
    'האם תרצה שנתחיל להסדיר את פרטי ההזמנה הסופיים?',
    'האם תרצה שנתחיל לאסוף את הפרטים הנדרשים להשלמת ההזמנה?',
  ])('advances after yes to a booking offer: %s', async offer => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [{ from: 'bot', text: offer }] };
    const readTurn = vi.fn(async () => ({ ...base, reply: 'האם תרצה שנתקדם בהזמנה?' }));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = next; }, activeBooking: async () => null, createRentalRequest: async () => 'SIM-123', readTurn };
    const result = await getRebuiltBotReply('fictional', 'כן', store);
    expect(result.state.phase).toBe('booking');
    expect(result.reply).toContain('תאריך');
    expect(result.reply).not.toContain('האם תרצה');
    expect(readTurn).not.toHaveBeenCalled();
  });

  it('never asks for pickup hour even when Gemini drafts that question', async () => {
    const chat = memory(() => ({ ...base, reply: 'מעולה! באיזו שעה תרצה לאסוף את הרכב?' }));
    const result = await chat.send('אני מחפש רכב לסוף שבוע');
    expect(result.reply).not.toMatch(/שעה|שעת איסוף/);
    expect(result.reply).toContain('תאריכים');
  });

  it('records a short pickup city when it answers the previous question', async () => {
    const chat = memory(() => null);
    const first = await chat.send('אני רוצה לשכור רכב קטן מ-10 עד 13 בנובמבר');
    expect(first.reply).toContain('מאיפה');
    const city = await chat.send('תל אביב');
    expect(city.state.booking.pickupLocation).toBe('תל אביב');
    expect(city.reply).toContain('להחזיר');
  });

  it('completes a guided request from separate short date and city answers without Gemini', async () => {
    const chat = memory(() => null);
    expect((await chat.send('אני רוצה לשכור רכב קטן')).state.step).toBe('rental_dates');
    expect((await chat.send('10 בנובמבר')).state.booking.pickupDate).toMatch(/-11-10$/);
    expect((await chat.send('13 בנובמבר')).state.booking.returnDate).toMatch(/-11-13$/);
    expect((await chat.send('תל אביב')).state.booking.pickupLocation).toBe('תל אביב');
    expect((await chat.send('אותו מקום')).state.booking.returnLocation).toBe('תל אביב');
    expect((await chat.send('24+')).state.step).toBe('rental_name');
    expect((await chat.send('דני בדיקה')).state.step).toBe('rental_email');
    const summary = await chat.send('dani.test@example.com');
    expect(summary.state.step).toBe('rental_confirm');
    expect(chat.create).not.toHaveBeenCalled();
    const complete = await chat.send('אני מאשר');
    expect(complete.escalate).toBe(true);
    expect(chat.create).toHaveBeenCalledOnce();
  });

  it('recovers a previously stalled conversation after an unnecessary time question', async () => {
    let state: RebuildState = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [
      { from: 'bot', text: 'האם נמשיך לבדיקת זמינות לרכב פנאי?' },
      { from: 'customer', text: 'כן' },
      { from: 'bot', text: 'באיזו שעה תרצה לאסוף את הרכב?' },
    ] };
    const readTurn = vi.fn(async () => null);
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = next; }, activeBooking: async () => null, createRentalRequest: async () => 'SIM-123', readTurn };
    const recovered = await getRebuiltBotReply('fictional', '9', store);
    expect(recovered.state.phase).toBe('booking');
    expect(recovered.reply).toContain('אין צורך בשעת איסוף');
    expect(recovered.reply).toContain('תאריך');
    expect(readTurn).not.toHaveBeenCalled();
  });

  it('greets a customer naturally before offering any vehicle advice', async () => {
    const chat = memory(() => ({ ...base, route: 'explore' }));
    const hello = await chat.send('היי');
    expect(hello.reply).toBe('היי 🙂 מה נשמע? איך אפשר לעזור לך היום?');
    expect(hello.reply).not.toMatch(/רכב|תאריכים|נסיעה/);
    expect(chat.readTurn).not.toHaveBeenCalled();
    const followup = await chat.send('מה נשמע?');
    expect(followup.reply).toContain('תודה ששאלת');
    expect(followup.reply).not.toContain('רכב');
  });

  it.each(['היי מה נשמע?', 'שלום, מה קורה?', 'היי, אפשר לשאול שאלה?'])('keeps a social opener conversational: %s', async message => {
    const chat = memory(() => ({ ...base, route: 'explore' }));
    const result = await chat.send(message);
    expect(result.reply).not.toMatch(/רכב|תאריכים|נסיעה/);
    expect(chat.readTurn).not.toHaveBeenCalled();
  });

  it('does not restart sales when a customer says hello in the middle of a request', async () => {
    const chat = memory(() => null);
    await chat.send('אני רוצה לשכור רכב ל-10 עד 13 בנובמבר');
    const hello = await chat.send('שלום');
    expect(hello.state.phase).toBe('booking');
    expect(hello.reply).toContain('הפרטים שכבר מסרת שמורים');
    expect(hello.reply).not.toContain('איזה רכב');
  });

  it('starts a rental request from natural closing and reservation language without claiming a hold', async () => {
    const close = memory(() => null);
    await close.send('אנחנו ארבעה נוסעים, צריך רכב לסוף שבוע');
    const accepted = await close.send('יאללה נסגור');
    expect(accepted.state.phase).toBe('booking');
    const hold = memory(() => null);
    const request = await hold.send('תשריין לי רכב');
    expect(request.state.phase).toBe('booking');
    expect(request.reply).toContain('האישור הסופי יינתן לאחר בדיקת זמינות');
    expect(hold.create).not.toHaveBeenCalled();
  });

  it('lets a customer reach a person while a rental form is in progress', async () => {
    const chat = memory(() => null);
    await chat.send('אני רוצה לשכור רכב ל-10 עד 13 בנובמבר');
    const handoff = await chat.send('אני רוצה לדבר עם נציג');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.handoffKind).toBe('human');
    expect(handoff.reply).toContain('נציג SmartCar');
  });

  it('handles an English sale lead and the customer’s explicit team request', async () => {
    const chat = memory(() => null);
    const first = await chat.send('I want to buy a used family car with a budget of 80,000 shekels');
    expect(first.state.interest).toBe('sale');
    expect(first.reply).not.toContain('dates');
    const handoff = await chat.send('Please have the team check what is available');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.handoffKind).toBe('commercial');
    expect(handoff.reply).not.toContain('stock');
  });

  it('accepts yes to an English leasing team-review offer', async () => {
    const chat = memory(() => null);
    await chat.send('I need business leasing for two years and 20,000 km a year');
    const offer = await chat.send('A family car');
    expect(offer.reply).toContain('team to review');
    const handoff = await chat.send('Yes');
    expect(handoff.escalate).toBe(true);
  });

  it('treats a broken air conditioner in the rental car as service', async () => {
    const chat = memory(() => null);
    const result = await chat.send('המזגן ברכב השכור לא עובד, מה עושים?');
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('service_issue');
    expect(result.reply).not.toContain('לאילו תאריכים');
  });

  it('treats a direct car purchase as sale without suggesting a rental', async () => {
    const chat = memory(() => null);
    const result = await chat.send('אני רוצה לקנות את הטויוטה שראיתי באתר, היא במלאי?');
    expect(result.state.interest).toBe('sale');
    expect(result.reply).toContain('נשמח לבדוק');
  });

  it('acknowledges a vehicle correction during the rental form', async () => {
    const chat = memory(() => null);
    await chat.send('אני רוצה לשכור רכב קטן מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום');
    const correction = await chat.send('בעצם אני מעדיף רכב משפחתי');
    expect(correction.state.booking.vehicleNeed).toBe('רכב משפחתי');
    expect(correction.reply).toContain('עדכנתי את סוג הרכב');
  });

  it('starts a request from natural closing language and retains a stated family car', async () => {
    const chat = memory(() => null);
    await chat.send('אנחנו זוג עם תינוק ו-3 מזוודות, איזה רכב כדאי?');
    const start = await chat.send('אני רוצה להתקדם עם בקשה להשכרה');
    expect(start.state.phase).toBe('booking');
    const details = await chat.send('אני רוצה לשכור רכב משפחתי מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום');
    expect(details.state.booking.vehicleNeed).toBe('רכב משפחתי');
    expect(details.state.booking.pickupLocation).toBe('הרצליה');
    expect(details.state.booking.returnLocation).toBe('הרצליה');
    expect(details.state.step).toBe('rental_age');
  });

  it('completes a model-free rental conversation only after age, contact details and consent', async () => {
    const chat = memory(() => null);
    const start = await chat.send('אני רוצה לשכור רכב משפחתי מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום');
    expect(start.state.step).toBe('rental_age');
    expect(chat.create).not.toHaveBeenCalled();
    const age = await chat.send('24+');
    expect(age.state.booking.driverAgeRange).toBe('24-plus');
    expect(age.state.step).toBe('rental_name');
    const name = await chat.send('דני בדיקה');
    expect(name.state.step).toBe('rental_email');
    const email = await chat.send('dani.test@example.com');
    expect(email.state.step).toBe('rental_confirm');
    expect(email.reply).toContain('לא הזמנה מאושרת');
    expect(chat.create).not.toHaveBeenCalled();
    const confirmed = await chat.send('אני מאשר');
    expect(confirmed.escalate).toBe(true);
    expect(confirmed.state.completedRequestId).toBe('SIM-123');
    expect(chat.create).toHaveBeenCalledOnce();
  });

  it('explains the age limit instead of repeating an unrelated form question', async () => {
    const chat = memory(() => null);
    await chat.send('אני רוצה לשכור רכב משפחתי מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום');
    const underage = await chat.send('בן 20');
    expect(underage.reply).toContain('השכרה אפשרית לנהגים מגיל 21');
    expect(underage.state.booking.driverAgeRange).toBeUndefined();
    expect(underage.state.step).toBe('rental_age');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('accepts a natural request to prepare a rental application', async () => {
    const chat = memory(() => null);
    const start = await chat.send('טוב, תכין לי בקשת השכרה');
    expect(start.state.phase).toBe('booking');
    expect(start.state.step).toBe('rental_dates');
  });

  it('recognizes a pickup in an English rental request and return there', async () => {
    const chat = memory(() => null);
    const result = await chat.send('I want to book a family car from 10 to 13 November 2026, pickup in Herzliya and return there');
    expect(result.state.booking.pickupLocation).toBe('Herzliya');
    expect(result.state.booking.returnLocation).toBe('Herzliya');
    expect(result.state.booking.vehicleNeed).toBe('family car');
  });

  it('moves leasing from term to mileage to vehicle and then asks to send the lead', async () => {
    const chat = memory(() => ({ ...base, route: 'leasing' }));
    const term = await chat.send('אני רוצה ליסינג פרטי לשנתיים');
    expect(term.reply).toContain('קילומטרים');
    const mileage = await chat.send('אסע בערך 15 אלף קמ בשנה');
    expect(mileage.reply).toContain('איזה סוג רכב');
    const vehicle = await chat.send('רכב משפחתי');
    expect(vehicle.reply).toContain('תרצה שהצוות יבדוק');
    const handoff = await chat.send('כן');
    expect(handoff.escalate).toBe(true);
  });

  it('routes a natural return postponement to staff immediately', async () => {
    const chat = memory(() => null);
    const result = await chat.send('יש לי הזמנה קיימת ואני צריך לדחות את ההחזרה ביום');
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('booking_change');
    expect(result.reply).toContain('תיכנס לתוקף לאחר');
  });

  it('answers a follow-up about the customer’s child seat instead of repeating vehicle advice', async () => {
    const chat = memory(message => ({ ...base, route: message.includes('מה חשוב') ? 'policy' : 'explore', direction: 'family' }));
    await chat.send('אנחנו זוג עם תינוק ושלוש מזוודות. כדאי לשכור משפחתית?');
    const answer = await chat.send('יש לי כיסא בטיחות משלי. מה חשוב לוודא?');
    expect(answer.reply).toContain('להתקין אותו');
    expect(answer.reply).toContain('כיסא הבטיחות מתאים לרכב המסוים');
    expect(answer.reply).not.toContain('הייתי מתחיל');
  });

  it('keeps a purchase lead when the customer asks the team to call back', async () => {
    const chat = memory(message => ({ ...base, route: message.includes('צוות') ? 'human' : 'sale' }));
    await chat.send('אני מחפש רכב יד שנייה בתקציב של 70 אלף שקל');
    const handoff = await chat.send('משפחתית. אפשר שהצוות יחזור אלי?');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.handoffKind).toBe('commercial');
    expect(handoff.reply).toContain('רכישת הרכב');
  });

  it('treats a sales callback request as a handoff even when Gemini labels it sale', async () => {
    const chat = memory(() => ({ ...base, route: 'sale' }));
    await chat.send('אני מחפש רכב יד שנייה בתקציב של 70 אלף שקל');
    const handoff = await chat.send('משפחתית. אפשר שהצוות יחזור אלי?');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.handoffKind).toBe('commercial');
  });

  it('starts a request only after accepting a direct offer following a final-price question', async () => {
    const chat = memory(() => null);
    await chat.send('כמה עולה יונדאי i20 לשלושה ימים והאם הוא פנוי?');
    const offer = await chat.send('אפשר לקבל מחיר סופי עכשיו?');
    expect(offer.reply).toContain('נתחיל בקשה');
    const accept = await chat.send('כן');
    expect(accept.state.phase).toBe('booking');
    expect(accept.state.step).toBe('rental_dates');
  });

  it('responds to a price objection with a budget question', async () => {
    const chat = memory(() => null);
    const answer = await chat.send('יקר לי, אולי יש רכב חסכוני יותר?');
    expect(answer.reply).toContain('התקציב היומי');
    expect(answer.reply).not.toContain('לאילו תאריכים');
  });

  it('routes a request to move a return date without asking for the booking number first', async () => {
    const chat = memory(() => null);
    const result = await chat.send('יש לי הזמנה קיימת ואני רוצה להזיז את ההחזרה ביומיים');
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('booking_change');
  });

  it('treats a rental question as exploration, not booking consent', async () => {
    const chat = memory(() => ({ ...base, route: 'book', direction: 'compact' }));
    const result = await chat.send('כדאי לי לשכור רכב לפגישות בירושלים?');
    expect(result.state.phase).toBe('explore');
    expect(result.reply).not.toMatch(/מה השם|מייל/);
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('answers a daily-price question without inventing a final quote or starting a request', async () => {
    const chat = memory(() => ({ ...base, reply: 'המחיר הסופי הוא 250 ₪ ליום.' }));
    const result = await chat.send('כמה זה עולה ליום?');
    expect(result.reply).toContain('המחיר המדויק תלוי');
    expect(result.reply).not.toContain('באתר');
    expect(result.reply).not.toContain('250');
    expect(result.state.phase).toBe('explore');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('answers a specific website car availability question without a price detour', async () => {
    const chat = memory(() => ({ ...base, reply: 'יש לנו רכב פנוי עכשיו.' }));
    const result = await chat.send('האם ה־Kia Sportage מהאתר פנוי?');
    expect(result.reply).toContain('נשמח לבדוק זמינות');
    expect(result.reply).not.toContain('המחיר באתר');
  });

  it('does not treat a bare yes or an explicit refusal as booking consent', async () => {
    const chat = memory(() => ({ ...base, route: 'book' }));
    await chat.send('אני מתלבט על רכב לסופ״ש');
    const yes = await chat.send('כן');
    expect(yes.state.phase).toBe('explore');
    const no = await chat.send('רק מתעניין, לא רוצה להזמין עכשיו');
    expect(no.state.phase).toBe('explore');
    expect(no.reply).toContain('לא שלחתי בקשה');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('keeps both dates from an explicit same-month range even if Gemini omits them', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    try {
      const chat = memory(() => ({ ...base, route: 'book', fields: { vehicleNeed: { value: 'רכב קטן', evidence: 'רכב קטן' } } }));
      const result = await chat.send('אני רוצה להזמין רכב קטן מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום.');
      expect(result.state.booking).toMatchObject({ pickupDate: '2026-11-10', returnDate: '2026-11-13', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי' });
      expect(result.reply).toContain('קבוצת הגיל');
    } finally { vi.useRealTimers(); }
  });

  it('gives positive SmartCar advice without repeating an outside option', async () => {
    const chat = memory(() => ({ ...base, reply: 'מונית תהיה זולה יותר.' }));
    const result = await chat.send('יש לי שתי פגישות בירושלים. אולי אגיע במונית, למה כדאי לשכור אצלכם?');
    expect(result.source).toBe('local');
    expect(result.reply).toContain('SmartCar');
    expect(result.reply).not.toMatch(/מונית|אוטובוס|רכבת|מתחר/);
  });

  it('does not make a child-seat fit promise or put it in the boot', async () => {
    const chat = memory(() => ({ ...base, direction: 'family', reply: 'משפחתית תספיק בוודאות לכיסא הבטיחות.' }));
    const result = await chat.send('אנחנו זוג עם תינוק וכיסא בטיחות לטיול בצפון. מה מתאים?');
    expect(result.reply).toContain('משפחתית');
    expect(result.reply).toMatch(/לוודא שכיסא הבטיחות מתאים/);
    expect(result.reply).not.toMatch(/בוודאות|לתא המטען.*כיסא/);
  });

  it('answers the child-seat placement question directly without promising luggage fit', async () => {
    const chat = memory(() => ({ ...base, reply: 'הכול ייכנס לרכב.' }));
    const result = await chat.send('לאן כדאי להתקין את כיסא הבטיחות, והאם יש מספיק מקום למזוודות?');
    expect(result.reply).toContain('במושב מתאים');
    expect(result.reply).toContain('לא בתא המטען');
    expect(result.reply).toContain('נבדוק מקום בדגם המסוים');
  });

  it('rejects a model reply that invents previously supplied dates', async () => {
    const chat = memory(() => ({ ...base, reply: 'נבדוק את הג׳יפון לתאריכים שכבר ציינתם. תרצו שנתקדם?' }));
    const result = await chat.send('בעצם יש לנו רק כיסא בטיחות אחד.');
    expect(result.source).toBe('local');
    expect(result.reply).not.toContain('תאריכים שכבר ציינתם');
  });

  it('rejects unverified luggage fit and a mixed-script Hebrew answer', async () => {
    const fit = memory(() => ({ ...base, direction: 'compact', reply: 'A compact car easily fits two suitcases.' }));
    const fitResult = await fit.send('We have two suitcases. Is a compact car suitable?');
    expect(fitResult.source).toBe('local');
    expect(fitResult.reply).not.toContain('easily fits');
    const mixed = memory(() => ({ ...base, reply: 'כשترצה להתקדם נבדוק תאריכים.' }));
    const mixedResult = await mixed.send('מה הצעד הבא?');
    expect(mixedResult.source).toBe('local');
    expect(mixedResult.reply).not.toContain('ترצה');
  });

  it('treats an ordinary Hebrew child-seat phrase as a fit question, even with a model recommendation', async () => {
    const chat = memory(() => ({ ...base, direction: 'suv', reply: 'רכב הפנאי יתאים למרחב הנדרש בוודאות.' }));
    const result = await chat.send('אנחנו ארבעה עם שלוש מזוודות ונצטרך כיסא בטיחות.');
    expect(result.source).toBe('local');
    expect(result.reply).toContain('לוודא שכיסא הבטיחות מתאים לו');
    expect(result.reply).not.toContain('בוודאות');
  });

  it('lets a customer switch from leasing back to rental without a stale leasing answer', async () => {
    const chat = memory(() => ({ ...base, route: 'leasing' }));
    await chat.send('אני שוקל ליסינג עסקי לשנה');
    const pivot = await chat.send('בעצם אני מעדיף השכרה לחודש וחצי');
    expect(pivot.state.interest).toBeUndefined();
    expect(pivot.reply).toContain('נחזור לבדוק השכרה');
    const pause = await chat.send('אני עדיין בודק, לא מבקש להזמין');
    expect(pause.reply).toContain('לא שלחתי בקשה');
  });

  it('routes a real brake concern to safety without model or sales', async () => {
    const chat = memory();
    const result = await chat.send('שכרתי אתמול והרכב עושה רעש חזק בבלמים. להמשיך לנסוע?');
    expect(result.source).toBe('safety');
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('אל תמשיכו לנסוע');
    expect(chat.readTurn).not.toHaveBeenCalled();
  });

  it('does not alert staff for a hypothetical accident or a past event involving the customer’s own car', async () => {
    expect(isRebuiltSafetyMessage('מה עושים אם הרכב נתקע וצריך גרר?')).toBe(false);
    expect(isRebuiltSafetyMessage('מה אם תהיה תאונה בעתיד?')).toBe(false);
    expect(isRebuiltSafetyMessage('הרכב שלי במוסך אחרי תאונה, אני צריך לשכור רכב חלופי')).toBe(false);
    expect(isRebuiltSafetyMessage('יש לכם שירות גרר?')).toBe(false);
    expect(isRebuiltSafetyMessage('נתקעתי עכשיו ויש עשן מהרכב')).toBe(true);
  });

  it('keeps a roadside incident safe without sending a new alert for each update', async () => {
    const chat = memory();
    const first = await chat.send('יש רעש חזק בבלמים, להמשיך לנסוע?');
    const update = await chat.send('אני עומד בצד, לא נפגעתי.');
    const tow = await chat.send('אתם שולחים גרר עכשיו?');
    expect(first.escalate).toBe(true);
    expect(update.escalate).toBe(false);
    expect(tow.escalate).toBe(false);
    expect(tow.reply).toContain('לתיאום גרר');
    expect(chat.readTurn).not.toHaveBeenCalled();
  });

  it('retains leasing context, answers a monthly price question and advances to a team offer', async () => {
    const chat = memory(() => ({ ...base, route: 'leasing' }));
    const first = await chat.send('אני מחפש ליסינג עסקי לשנה');
    expect(first.reply).toMatch(/קילומטרים/);
    const second = await chat.send('כ-25 אלף קילומטר בשנה');
    expect(second.reply).toMatch(/סוג רכב/);
    const price = await chat.send('אפשר להבטיח מחיר חודשי עכשיו?');
    expect(price.reply).toMatch(/התשלום החודשי תלוי/);
    const quote = await chat.send('מה הצעד הבא לקבלת הצעה?');
    expect(quote.escalate).toBe(true);
    expect(quote.state.handedOff).toBe(true);
  });

  it('hands a leasing enquiry to staff when the customer asks to pass it on', async () => {
    const chat = memory(() => ({ ...base, route: 'leasing' }));
    await chat.send('אני מחפש ליסינג עסקי לשנה, בערך 25 אלף קילומטר');
    const handoff = await chat.send('תעבירו את הפרטים לצוות בבקשה');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.handedOff).toBe(true);
  });

  it('keeps sale context without inventing stock or a test drive appointment', async () => {
    const chat = memory(() => ({ ...base, route: 'sale' }));
    await chat.send('אני מחפש רכב לקנייה');
    const details = await chat.send('משפחתית יד שנייה עד 80 אלף שקל');
    expect(details.reply).not.toMatch(/איזה סוג רכב/);
    const stock = await chat.send('איזה דגמים זמינים עכשיו?');
    expect(stock.reply).toContain('נשמח לבדוק');
    const drive = await chat.send('אפשר נסיעת מבחן?');
    expect(drive.reply).toContain('לאישור התור');
  });

  it('asks for a vehicle category rather than treating used condition as a category, then hands off an accepted sales lead', async () => {
    const chat = memory(() => ({ ...base, route: 'sale' }));
    const first = await chat.send('אני רוצה לקנות רכב יד שנייה');
    expect(first.reply).toContain('איזה סוג רכב');
    await chat.send('משפחתית עד 80 אלף שקל');
    const handoff = await chat.send('כן, שהצוות יבדוק לפי מה שכבר כתבתי');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.handedOff).toBe(true);
    expect(handoff.reply).toContain('נציג SmartCar');
    const followUp = await chat.send('מה קורה עם זה?');
    expect(followUp.reply).toContain('רכישת רכב');
    expect(followUp.reply).not.toContain('לא שיניתי את ההזמנה');
  });

  it('passes an explicit test-drive request to staff without claiming an appointment was booked', async () => {
    const chat = memory(() => ({ ...base, route: 'sale' }));
    await chat.send('אני מחפש רכב לקנייה');
    const request = await chat.send('אני רוצה לקבוע נסיעת מבחן');
    expect(request.escalate).toBe(true);
    expect(request.reply).toContain('לאישור התור');
  });

  it('passes a sales lead to staff when the customer has no further preferences', async () => {
    const chat = memory(() => ({ ...base, route: 'sale' }));
    await chat.send('אני מחפש משפחתית לקנייה עד 80 אלף שקל');
    const handoff = await chat.send('אין לי העדפה לשנתון, תבדקו לפי מה שכתבתי');
    expect(handoff.escalate).toBe(true);
    expect(handoff.reply).toContain('נציג SmartCar');
  });

  it('passes an existing booking date change to staff only once', async () => {
    const chat = memory(() => ({ ...base, route: 'service' }));
    const first = await chat.send('יש לי הזמנה קיימת ואני צריך לשנות את יום ההחזרה');
    const second = await chat.send('אפשר לשנות אותה עכשיו?');
    expect(first.escalate).toBe(true);
    expect(first.reply).toContain('תיכנס לתוקף לאחר');
    expect(second.escalate).toBe(false);
    expect(second.reply).toContain('תיכנס לתוקף רק לאחר');
  });

  it('passes a specific billing problem to staff instead of repeatedly asking for a booking number', async () => {
    const chat = memory(() => ({ ...base, route: 'service' }));
    const problem = await chat.send('יש לי הזמנה קיימת וחויבתי פעמיים, אפשר לבדוק?');
    expect(problem.escalate).toBe(true);
    expect(problem.state.handedOff).toBe(true);
    expect(problem.reply).toContain('נציג SmartCar יבדוק');
    expect(problem.reply).not.toContain('נדרש מספר ההזמנה');
    const detail = await chat.send('מספר ההזמנה שלי TEST-123');
    expect(detail.escalate).toBe(false);
    expect(detail.reply).toContain('נציג SmartCar יטפל');
    expect(detail.reply).not.toContain('לא שיניתי את ההזמנה');
  });

  it('recognizes a billing complaint without an explicit existing-booking phrase', async () => {
    const chat = memory(() => ({ ...base, route: 'explore' }));
    const problem = await chat.send('חויבתי פעמיים על אותה השכרה');
    expect(problem.escalate).toBe(true);
    expect(problem.state.handoffKind).toBe('service_issue');
    expect(problem.reply).toContain('נציג SmartCar יבדוק');
  });

  it('recognizes a booking reference supplied after a generic service enquiry', async () => {
    const chat = memory(() => ({ ...base, route: 'service' }));
    const first = await chat.send('יש לי הזמנה קיימת ואני צריך עזרה');
    expect(first.reply).toContain('מספר ההזמנה');
    const reference = await chat.send('מספר ההזמנה שלי TEST-123');
    expect(reference.escalate).toBe(true);
    expect(reference.reply).toContain('נציג SmartCar');
    expect(reference.reply).not.toContain('נדרש מספר ההזמנה');
  });

  it('lets a new enquiry resume after the 24-hour handoff window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));
    try {
      const chat = memory(() => base);
      const handoff = await chat.send('יש לי הזמנה קיימת ואני צריך לשנות את יום ההחזרה');
      expect(handoff.state.handedOff).toBe(true);
      expect(handoff.state.handoffAt).toBe('2026-10-25T10:00:00.000Z');
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);
      const resumed = await chat.send('אני מתעניין ברכב לטיול חדש');
      expect(resumed.state.handedOff).toBe(false);
      expect(resumed.state.phase).toBe('explore');
      expect(chat.readTurn).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('retains booking facts and requires explicit confirmation before a request', async () => {
    const chat = memory(message => {
      if (message.includes('להזמין')) return { ...base, route: 'book', direction: 'compact', fields: {
        pickupDate: { value: '2026-10-26', evidence: 'מחר' }, returnDate: { value: '2026-10-28', evidence: 'יום רביעי' },
        pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' }, returnLocation: { value: 'הרצליה', evidence: 'לאותו מקום' },
        vehicleNeed: { value: 'קומפקטי', evidence: 'רכב קטן' },
      } };
      return { ...base, route: 'book' };
    });
    const first = await chat.send('אני רוצה להזמין רכב קטן מחר מהרצליה עד יום רביעי, ולהחזיר לאותו מקום.');
    expect(first.state.phase).toBe('booking');
    expect(first.state.booking).toMatchObject({ pickupDate: '2026-10-26', returnDate: '2026-10-28', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי' });
    expect(first.state.requestKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.reply).toMatch(/קבוצת הגיל/);
    expect(first.reply).not.toContain('מחיר וזמינות');
    expect(chat.create).not.toHaveBeenCalled();
    const second = await chat.send('24+');
    expect(second.state.requestKey).toBe(first.state.requestKey);
    expect(second.state.booking.driverAgeRange).toBe('24-plus');
    expect(second.reply).toMatch(/שם/);
    const third = await chat.send('קוראים לי דניאל כהן');
    expect(third.reply).toMatch(/מייל/);
    const fourth = await chat.send('daniel@example.com');
    expect(fourth.reply).toMatch(/אני מאשר/);
    expect(fourth.reply).toContain('גיל נהג 24+');
    expect(fourth.reply).toContain('קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות של SmartCar.');
    expect(fourth.reply).toContain('https://www.smartcar.co.il/he/terms');
    expect(chat.create).not.toHaveBeenCalled();
    const confirmed = await chat.send('אני מאשר');
    expect(confirmed.escalate).toBe(true);
    expect(chat.create).toHaveBeenCalledTimes(1);
    const repeated = await chat.send('אני מאשר');
    expect(repeated.reply).toContain('לא נוצרה הזמנה אמיתית');
    expect(chat.create).toHaveBeenCalledTimes(1);
    expect(chat.state()?.completedRequestId).toBe('SIM-123');
    expect(chat.state()?.booking).toEqual({});
    expect(chat.state()?.requestKey).toBeUndefined();
    const newRequest = await chat.send('אני רוצה להזמין רכב קטן לנסיעה נוספת');
    expect(newRequest.state.requestKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(newRequest.state.requestKey).not.toBe(first.state.requestKey);
  });

  it('does not send name and email collection turns to Gemini', async () => {
    const chat = memory(() => ({ ...base, route: 'book', fields: { pickupDate: { value: '2026-10-26', evidence: 'מחר' }, returnDate: { value: '2026-10-28', evidence: 'רביעי' }, pickupLocation: { value: 'הרצליה', evidence: 'בהרצליה' }, returnLocation: { value: 'הרצליה', evidence: 'אותו מקום' }, vehicleNeed: { value: 'משפחתית', evidence: 'משפחתית' } } }));
    await chat.send('אני רוצה להזמין משפחתית מחר עד רביעי, איסוף בהרצליה והחזרה באותו מקום.');
    const calls = chat.readTurn.mock.calls.length;
    await chat.send('21–23');
    await chat.send('דניאל כהן');
    await chat.send('daniel@example.com');
    expect(chat.readTurn).toHaveBeenCalledTimes(calls);
  });

  it('ignores a model field without direct customer evidence', async () => {
    const chat = memory(() => ({ ...base, fields: { pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' }, childSeats: { value: '2', evidence: 'שני כיסאות' } } }));
    const result = await chat.send('אנחנו נוסעים צפונה עם מזוודה.');
    expect(result.state.booking.pickupLocation).toBeUndefined();
    expect(result.state.booking.childSeats).toBeUndefined();
  });

  it('rejects impossible or reversed dates before they reach a rental request', async () => {
    const chat = memory(() => ({ ...base, route: 'book', fields: {
      pickupDate: { value: '2026-10-28', evidence: 'רביעי' },
      returnDate: { value: '2026-10-26', evidence: 'שני' },
    } }));
    const result = await chat.send('אני רוצה להזמין מרביעי עד שני');
    expect(result.state.booking.pickupDate).toBe('2026-10-28');
    expect(result.state.booking.returnDate).toBeUndefined();
    expect(result.reply).toMatch(/תאריך תחזירו/);
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('has a useful bounded fallback when Gemini is unavailable', async () => {
    const chat = memory(() => null);
    const result = await chat.send('אני צריך רכב לפגישות בתל אביב מחר');
    expect(result.source).toBe('local');
    expect(result.reply).toContain('SmartCar');
    expect(result.reply).toMatch(/תאריכים/);
  });

  it('closes politely and lists needed details during a Gemini outage', async () => {
    const chat = memory(() => null);
    const details = await chat.send('איזה פרטים צריך כדי לבדוק?');
    expect(details.reply).toContain('תאריכי איסוף והחזרה');
    const thanks = await chat.send('תודה.');
    expect(thanks.reply).toContain('בשמחה');
    expect(thanks.reply).not.toContain('לאילו תאריכים');
  });

  it('answers a hypothetical roadside question without claiming a representative took over', async () => {
    const chat = memory(() => null);
    const answer = await chat.send('מה אם תהיה תאונה בעתיד?');
    expect(answer.escalate).toBe(false);
    expect(answer.reply).not.toContain('נציג מטפל');
  });

  it('recovers after a provider outage without losing supplied trip facts', async () => {
    let available = false;
    const chat = memory(() => available ? { ...base, direction: 'family' } : null);
    const outage = await chat.send('אנחנו ארבעה עם מזוודות, מחפשים רכב לטיול');
    expect(outage.source).toBe('local');
    available = true;
    const recovered = await chat.send('בעצם נהיה חמישה אנשים');
    expect(recovered.model).toBe('gemini-3.5-flash-lite');
    expect(recovered.state.history).toHaveLength(4);
  });

  it('keeps a completed rental draft pending when the customer withholds confirmation', async () => {
    const chat = memory(() => ({ ...base, route: 'book', fields: {
      pickupDate: { value: '2026-11-10', evidence: '10' }, returnDate: { value: '2026-11-13', evidence: '13' },
      pickupLocation: { value: 'הרצליה', evidence: 'בהרצליה' }, returnLocation: { value: 'הרצליה', evidence: 'אותו מקום' },
      vehicleNeed: { value: 'משפחתית', evidence: 'משפחתית' },
    } }));
    await chat.send('אני רוצה להזמין משפחתית מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום');
    await chat.send('24+');
    await chat.send('לקוח בדיקה');
    await chat.send('test@example.invalid');
    const withheld = await chat.send('אני לא מאשר עדיין');
    expect(withheld.reply).toContain('לא שלחתי בקשה');
    expect(withheld.state.step).toBe('rental_confirm');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('updates private contact details in the summary before explicit consent without sending them to Gemini', async () => {
    const chat = memory(() => ({ ...base, route: 'book', fields: {
      pickupDate: { value: '2026-11-10', evidence: '10' }, returnDate: { value: '2026-11-13', evidence: '13' },
      pickupLocation: { value: 'הרצליה', evidence: 'בהרצליה' }, returnLocation: { value: 'הרצליה', evidence: 'אותו מקום' },
      vehicleNeed: { value: 'משפחתית', evidence: 'משפחתית' },
    } }));
    await chat.send('אני רוצה להזמין משפחתית מ-10 עד 13 בנובמבר, איסוף בהרצליה והחזרה באותו מקום');
    await chat.send('24+');
    await chat.send('לקוח בדיקה');
    await chat.send('old@example.invalid');
    const calls = chat.readTurn.mock.calls.length;
    const updated = await chat.send('המייל שלי new@example.invalid');
    expect(updated.reply).toContain('new@example.invalid');
    expect(updated.reply).not.toContain('old@example.invalid');
    expect(updated.state.history.at(-2)?.private).toBe(true);
    expect(chat.readTurn).toHaveBeenCalledTimes(calls);
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('answers a service policy from published facts', async () => {
    const chat = memory(() => ({ ...base, route: 'policy' }));
    const result = await chat.send('מה מדיניות הדלק שלכם?');
    expect(result.reply).toContain('מלא־מלא');
    expect(result.reply).not.toMatch(/תאריכים|להזמין/);
  });

  it('uses published airport pickup terms even when Gemini treats the question as exploration', async () => {
    const chat = memory(() => ({ ...base, route: 'explore', reply: 'Airport pickup is available for your trip.' }));
    const result = await chat.send('Can I pick it up at the airport?');
    expect(result.reply).toContain('subject to advance coordination and availability');
    expect(result.reply).not.toContain('is available for your trip');
  });
});
