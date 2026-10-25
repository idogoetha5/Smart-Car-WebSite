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
    expect(result.reply).toContain('המחיר באתר הוא הערכה');
    expect(result.reply).not.toContain('250');
    expect(result.state.phase).toBe('explore');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it('answers a specific website car availability question without a price detour', async () => {
    const chat = memory(() => ({ ...base, reply: 'יש לנו רכב פנוי עכשיו.' }));
    const result = await chat.send('האם ה־Kia Sportage מהאתר פנוי?');
    expect(result.reply).toContain('אין לי גישה למלאי חי');
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
      expect(result.state.booking).toMatchObject({ pickupDate: '2026-11-10', returnDate: '2026-11-13', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קטן' });
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
    expect(result.reply).toMatch(/התאמת כיסא הבטיחות צריך לוודא/);
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
    expect(result.reply).toContain('בדגם המסוים');
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
    expect(tow.reply).toContain('לא אוכל לאשר שנשלח גרר');
    expect(chat.readTurn).not.toHaveBeenCalled();
  });

  it('retains leasing context, answers a monthly price question and advances to a team offer', async () => {
    const chat = memory(() => ({ ...base, route: 'leasing' }));
    const first = await chat.send('אני מחפש ליסינג עסקי לשנה');
    expect(first.reply).toMatch(/קילומטרים/);
    const second = await chat.send('כ-25 אלף קילומטר בשנה');
    expect(second.reply).toMatch(/סוג רכב/);
    const price = await chat.send('אפשר להבטיח מחיר חודשי עכשיו?');
    expect(price.reply).toMatch(/אי אפשר להבטיח תשלום חודשי/);
    const quote = await chat.send('מה הצעד הבא לקבלת הצעה?');
    expect(quote.escalate).toBe(true);
    expect(quote.state.handedOff).toBe(true);
  });

  it('keeps sale context without inventing stock or a test drive appointment', async () => {
    const chat = memory(() => ({ ...base, route: 'sale' }));
    await chat.send('אני מחפש רכב לקנייה');
    const details = await chat.send('משפחתית יד שנייה עד 80 אלף שקל');
    expect(details.reply).not.toMatch(/איזה סוג רכב/);
    const stock = await chat.send('איזה דגמים זמינים עכשיו?');
    expect(stock.reply).toContain('אין לי רשימת מלאי מכירה עדכנית');
    const drive = await chat.send('אפשר נסיעת מבחן?');
    expect(drive.reply).toContain('לא נקבע תור');
  });

  it('passes an existing booking date change to staff only once', async () => {
    const chat = memory(() => ({ ...base, route: 'service' }));
    const first = await chat.send('יש לי הזמנה קיימת ואני צריך לשנות את יום ההחזרה');
    const second = await chat.send('אפשר לשנות אותה עכשיו?');
    expect(first.escalate).toBe(true);
    expect(first.reply).toContain('לא שיניתי');
    expect(second.escalate).toBe(false);
    expect(second.reply).toContain('לא שיניתי');
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
    expect(first.state.booking).toMatchObject({ pickupDate: '2026-10-26', returnDate: '2026-10-28', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'קומפקטי' });
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
    await chat.send('אני מאשר');
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
