import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation(initial: RebuildState | null = null) {
  let state = initial;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
  };
  return (message: string) => getRebuiltBotReply('fictional', message, store);
}

describe('commercial memory after the rolling conversation window', () => {
  it('hands off the selected leasing request with the exact facts after an earlier comparison', async () => {
    const send = conversation();
    await send('שלום, אני עצמאי עם עסק קטן. מחפש רכב לעבודה ולעיתים להסעת המשפחה, ומתלבט בין ליסינג להשכרה ארוכה. מה היית ממליץ לבדוק?');
    await send('כן. אני צריך רכב בערך לשנתיים, נוסע משהו כמו 18 אלף קילומטר בשנה, תקציב סביב 2,500 שקל בחודש. לפעמים שני ילדים איתי. מה יותר הגיוני?');
    await send('כן, משפחתית תספיק. לא רוצה להתחייב על דגם. ואם בתקציב הזה אין הצעה, תגיד לי ישר. כמה זה יעלה לי סופית?');
    const handed = await send('בסדר, תעביר לנציג הצעה לליסינג למשפחתית לשנתיים, 18 אלף ק״מ בשנה ועד 2,500 לחודש. קוראים לי רועי כהן ואפשר לחזור אליי בווטסאפ הזה.');
    expect(handed.state.commercial).toMatchObject({ comparingLeasingAndRental: false, termMonths: 24, vehiclePreference: 'family', annualMileageKm: 18000, budget: { amount: 2500, currency: 'ILS' } });
    expect(handed.reply).toMatch(/ליסינג/);
    expect(handed.reply).toMatch(/משפחתי/);
    expect(handed.reply).toMatch(/24 חודשים/);
    expect(handed.reply).toMatch(/18000/);
    expect(handed.reply).toMatch(/2500/);
    expect(handed.reply).not.toMatch(/מתלבטים בין|השוואה בין ליסינג להשכרה|תקופה: טרם הוחלט/);
    expect(handed.escalate).toBe(true);
    expect(handed.state.handoffKind).toBe('commercial');
    expect(handed.state.completedRequestId).toBeUndefined();
  });
  it('keeps an undecided leasing versus rental customer in advice rather than rental intake', async () => {
    const send = conversation();
    const turn = await send('היי, אני עצמאי ונוסע כ־18 אלף ק״מ בשנה. אני צריך רכב משפחתי ומתלבט בין ליסינג להשכרה לחצי שנה, כי עוד לא יודע אם אצטרך רכב אחר כך. מה היית ממליץ לבדוק?');
    expect(turn.state.phase).toBe('explore');
    expect(turn.state.interest).toBe('leasing');
    expect(turn.state.commercial?.comparingLeasingAndRental).toBe(true);
    expect(turn.state.requestKey).toBeUndefined();
    expect(turn.reply).not.toMatch(/באיזה תאריך.*לאסוף|תאריכי איסוף והחזרה/);
  });
  it('does not record "return early" as a return location in commercial advice', async () => {
    const send = conversation();
    await send('אני עצמאית ומתלבטת בין ליסינג להשכרה לחמישה חודשים.');
    const turn = await send('אם אבחר השכרה ל־5 חודשים, מה קורה אם אחזיר מוקדם?');
    expect(turn.state.booking.returnLocation).toBeUndefined();
    expect(turn.state.phase).toBe('explore');
  });
  it('classifies a Gemini-led commercial handoff as commercial', async () => {
    let state: RebuildState | null = {
      version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, interest: 'leasing', history: [],
      commercial: { comparingLeasingAndRental: true, rentalComparisonMonths: 6, annualMileageKm: 18000, earlyExitConcern: true },
    };
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: async () => 'SIM',
      readTurn: async () => ({ route: 'leasing', direction: 'none', fields: {}, reply: 'אני מעביר את הפרטים לנציג SmartCar כדי שישווה בין ליסינג להשכרה לחצי שנה.', source: 'gemini', model: 'fixture', groundedContext: true, needsRepresentative: true }),
    };
    const handed = await getRebuiltBotReply('fictional', 'תודה. קוראים לי עומר ברק וזה מספר הוואטסאפ שלי. תעביר בבקשה לנציג להשוות ליסינג מול השכרה לחצי שנה, בלי לפתוח הזמנה או להתחייב לעסקה.', store);
    expect(handed.escalate).toBe(true);
    expect(handed.state.handoffKind).toBe('commercial');
    expect(handed.state.completedRequestId).toBeUndefined();
  });
  it('answers a question before representative handoff without treating "before representative" as consent', async () => {
    const send = conversation({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, interest: 'leasing', history: [],
      commercial: { comparingLeasingAndRental: true, rentalComparisonMonths: 6, annualMileageKm: 18000, earlyExitConcern: true, vehiclePreference: 'family' } });
    const answered = await send('לפני נציג אני רוצה להבין: אם אשכור לחצי שנה ואחזיר אחרי ארבעה חודשים, אתה יכול להבטיח שלא יהיה חיוב על היתר? וגם איך מתחשבים ב־18 אלף ק״מ בשנה?');
    expect(answered.escalate).toBe(false);
    expect(answered.state.handedOff).not.toBe(true);
    expect(answered.reply).not.toMatch(/סיכום הפנייה לנציג|נציג SmartCar יחזור אליכם/);
  });
  it('summarizes both undecided routes when the customer asks directly for a representative', async () => {
    const send = conversation();
    await send('אני עצמאי. לשנה הקרובה אצטרך משפחתית אבל אולי רק לחצי שנה. מתלבט בין ליסינג להשכרה, נוסע 18 אלף ק״מ בשנה ולא רוצה התחייבות ארוכה.');
    const handed = await send('כן, תעבירו לנציג שישווה לי את שתי האפשרויות. לא סגרתי שום עסקה.');
    expect(handed.state.commercial?.comparingLeasingAndRental).toBe(true);
    expect(handed.state.commercial?.termMonths).toBeNull();
    expect(handed.reply).toMatch(/ליסינג.*השכרה/);
    expect(handed.reply).toMatch(/18,?000|18000/);
    expect(handed.reply).toMatch(/התחייבות ארוכה/);
    expect(handed.reply).not.toMatch(/לגבי הליסינג\./);
    expect(handed.escalate).toBe(true);
  });
  it('hands off an undecided leasing-versus-rental customer with the complete comparison', async () => {
    const send = conversation();
    await send('היי, אני עצמאי ומתלבט בין ליסינג לרכב משפחתי לבין השכרה לחצי שנה. אני נוסע בערך 18 אלף ק״מ בשנה וחשוב לי שלא אתקע עם התחייבות ארוכה. מה היית מציע?');
    await send('עזוב עלויות כרגע. אם אני בוחר השכרה לחצי שנה ורוצה להחזיר אחרי ארבעה חודשים, אוכל פשוט לצאת בלי קנס? ומה עם ה־18 אלף ק״מ שסיפרתי?');
    const handed = await send('סבבה. תזכיר מה רשמת עליי עד עכשיו, ואז תעביר לנציג שיציע אפשרויות. אני לא מאשר שום עסקה כרגע.');
    expect(handed.state.commercial).toMatchObject({ comparingLeasingAndRental: true, rentalComparisonMonths: 6, earlyExitConcern: true, annualMileageKm: 18000, vehiclePreference: 'family' });
    expect(handed.reply).toMatch(/ליסינג.*השכרה/);
    expect(handed.reply).toMatch(/6 חודשים/);
    expect(handed.reply).toMatch(/יציאה מוקדמת/);
    expect(handed.reply).toMatch(/18000/);
    expect(handed.reply).not.toMatch(/התעניינות בליסינג(?![^.!?]{0,30}השכרה)/);
    expect(handed.escalate).toBe(true);
    expect(handed.state.handoffKind).toBe('commercial');
  });

  it('rejects a fluent Gemini rewrite that drops the rental alternative', async () => {
    let state: RebuildState | null = {
      version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, interest: 'leasing', history: [],
      commercial: { comparingLeasingAndRental: true, rentalComparisonMonths: 6, earlyExitConcern: true, annualMileageKm: 18000, vehiclePreference: 'family' },
    };
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
      rewordTurn: async () => ({ route: 'human', direction: 'none', fields: {}, reply: 'בשמחה, נציג SmartCar יחזור אליכם לגבי הליסינג והעדפת הרכב המשפחתי. לעזרה מיידית אפשר להתקשר ל־09-9509757.', source: 'gemini', model: 'fixture', groundedContext: true, rephrased: true }),
    };
    const handed = await getRebuiltBotReply('fictional', 'תזכיר מה רשמת עליי עד עכשיו, ואז תעביר לנציג שיציע אפשרויות. אני לא מאשר שום עסקה כרגע.', store);
    expect(handed.reply).toMatch(/ליסינג.*השכרה/);
    expect(handed.reply).not.toMatch(/לגבי הליסינג והעדפת/);
    expect(handed.escalate).toBe(true);
  });

  it('recalls only latest English facts after fourteen advisory turns, including a mixed commitment question', async () => {
    const send = conversation();
    await send('I want leasing for two years, budget 70000 shekels, 12000 km a year. I prefer a compact car.');
    await send('Budget now 60000. I am unsure whether 24 or 36 months makes sense.');
    await send('Probably a small automatic. Actually make it 24 months and 15000 km annually.');
    for (let i = 0; i < 14; i++) await send('What should I check about maintenance?');
    const recalled = await send('What details do you remember, and have I committed to a deal?');
    expect(recalled.state.history.length).toBeLessThanOrEqual(20);
    expect(recalled.state.history.some(entry => entry.text.includes('70000'))).toBe(false);
    expect(recalled.reply).toMatch(/60000 ILS/);
    expect(recalled.reply).toMatch(/24 months/);
    expect(recalled.reply).toMatch(/15000 km/);
    expect(recalled.reply).toMatch(/compact/);
    expect(recalled.reply).toMatch(/no commitment/);
    expect(recalled.reply).not.toMatch(/70000|12000|36 months/);
    expect(recalled.escalate).toBe(false);
  });

  it('recalls the lowered Hebrew budget and cleared vehicle choice after thirteen turns', async () => {
    const send = conversation();
    await send('אני רוצה לקנות רכב קטן, תקציב 70000 שקל');
    await send('בעצם התקציב ירד ל־60000. לא בחרתי סוג רכב, נשאיר את זה פתוח.');
    for (let i = 0; i < 13; i++) await send('מה כולל השירות שלכם ברכישה?');
    const recalled = await send('מה הפרטים ששמרת עליי ומה התקציב?');
    expect(recalled.reply).toMatch(/60000 ILS/);
    expect(recalled.reply).toContain('פתוחה');
    expect(recalled.reply).not.toMatch(/70000|קומפקטי/);
    expect(recalled.state.commercial?.vehiclePreference).toBeNull();
  });

  it('seeds a legacy commercial state once and keeps updates after handoff', async () => {
    const send = conversation({ version: 2, phase: 'service', step: 'menu', locale: 'en', booking: {}, interest: 'sale', handedOff: true,
      handoffAt: new Date().toISOString(), handoffKind: 'commercial',
      history: [{ from: 'customer', text: 'I want a family car, budget 70000 shekels. My name is Private Name, private@example.invalid.' }],
    });
    const corrected = await send('Thanks. Budget now 60000, not 70000.');
    expect(corrected.state.commercial?.budget?.amount).toBe(60000);
    expect(JSON.stringify(corrected.state.commercial)).not.toMatch(/Private|example/);
    const recalled = await send('What details do you remember?');
    expect(recalled.reply).toMatch(/60000 ILS/);
    expect(recalled.reply).not.toMatch(/70000/);
  });
});
