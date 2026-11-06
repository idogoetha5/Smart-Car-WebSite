import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T09:00:00Z')); });
afterEach(() => vi.useRealTimers());
function chat(withReading: boolean) {
  let state: RebuildState | null = null;
  let requests = 0;
  const store: RebuildStore = { isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null,
    createRentalRequest: async () => { requests++; return 'SIM-FIXED'; },
    readTurn: async () => withReading ? { route: 'explore', direction: 'none', fields: {}, source: 'gemini', model: 'controlled-fixture', reply: 'Tell me more about what you need.' } : null };
  return { send: (message: string) => getRebuiltBotReply('fictional-fixed-readiness', message, store), count: () => requests };
}
const rentals = [
  { locale: 'he', turns: [
    'היי, אנחנו זוג ושני ילדים, הקטן בן שנתיים. צריכים רכב לכמה ימים, עוד לא סגרנו תאריכים. ניקח שתי מזוודות ועגלה. מה כדאי לקחת?',
    'חשבנו אולי על רכב קטן כי יהיה קל יותר לחנות. אבל עם העגלה ושתי המזוודות זה באמת מתאים או שעדיף משפחתית?',
    'נלך על משפחתית. רוצה להתחיל בקשת השכרה: איסוף בירושלים ב־10/12/2026 והחזרה בתל אביב ב־14/12/2026. הנהג בן 32.',
    'כן, נרצה כיסא בטיחות אחד לבן השנתיים. זה מובטח שיהיה מתאים? ומה לגבי ביטוח וביטול השתתפות עצמית?',
    'כן, קוראים לי נועה בדיקה ואין לי מייל למסור. בעצם נחזיר בהרצליה ב־15/12/2026, האיסוף נשאר בירושלים ב־10/12/2026.',
    'בעצם נביא כיסא בטיחות משלנו. לא צריך כיסא שלכם. כל שאר הפרטים נשארים.',
    'תזכיר לי את הפרטים לפני השליחה. הרכב כבר מאושר או שזו רק בקשה?',
  ], confirm: 'אני מאשרת', recall: 'איזה תאריך ועיר החזרה שמרת וכמה נוסעים, מזוודות וכיסאות בטיחות?', pickup: 'ירושלים', ret: 'הרצליה', date: '2026-12-15' },
  { locale: 'en', turns: [
    'Hi, I am 22 and travelling with my partner and one small bag. We are comparing a compact and family car for city driving, not booking yet.',
    'I have held a full licence for 18 months. Am I eligible, and is there a young driver charge or deposit? No callback yet.',
    'I want to rent a compact car. Pickup in Herzliya on 5 December 2026 and return in Tel Aviv on 9 December 2026, two passengers and one bag.',
    'My name is Alex Demo, no email please. Actually I prefer a family car instead, and return on 10 December, not the 9th. Keep the same pickup.',
    'What about insurance and zero excess? Do not send the request yet.',
    'A friend is joining, so three passengers and two bags, no child seat. Is that guaranteed to fit every family car?',
    'Please recap the details before sending. Is a car already confirmed?',
  ], confirm: 'I confirm', recall: 'Which return date and city did you keep, and how many passengers, bags and child seats?', pickup: 'Herzliya', ret: 'Tel Aviv', date: '2026-12-10' },
] as const;
const service = [
  { kind: 'cancel-he', advisory: [
    'שלום, יש לי הזמנה לשבוע הבא ואני שוקל לבטל. עוד לא לבטל כלום, אני רוצה קודם להבין את מדיניות הביטול.',
    'אם שילמתי מקדמה, בטוח שאקבל אותה במלואה? מספר ההזמנה לא לידי כרגע, ואני עדיין רק בודק.',
    'אולי במקום לבטל רק אקצר ביום אחד. עוד לא החלטתי, אל תבקש שינוי. המחיר ליום שנשאר בהכרח יהיה אותו מחיר?',
  ], action: 'החלטתי לבטל. מספר ההזמנה שלי 654321. בבקשה תעבירו בקשת ביטול לנציג, לא בקשת קיצור.', recall: 'איזה מספר הזמנה שמרת, ומה עוד להכין לשיחה עם הנציג?' },
  { kind: 'extend-en', advisory: [
    'Hi, my existing rental is due back tomorrow. I am thinking about keeping it two more days but have not decided. Does that need approval, and would the daily price stay the same?',
    'My booking reference is not handy right now. I am only asking about the rules: I should still plan to return tomorrow unless you explicitly approve an extension, correct?',
    'Actually I would only need one extra day, not two, if I decide to go ahead. I am still comparing options, so no change request yet.',
  ], action: 'I want to extend by one day. My booking reference is 654321. Please pass an extension request to a representative.', recall: 'Which booking reference did you keep, and what should I have ready for the representative?' },
] as const;
const commercial = [
  { kind: 'sale-he', turns: ['אני רוצה לקנות רכב משפחתי עד 70 אלף שקל, אבל עדיין רק בודק.', 'בעיקר משפחה ונסיעות לעבודה. אפשר לקבל היסטוריית טיפולים ותאונות ולבדוק במכון עצמאי? עדיין לא רוצה שיתקשרו אליי.', 'בעצם התקציב עד 60 אלף, לא 70. חשוב לי קילומטראז׳ נמוך, הדגם המדויק פתוח.', 'תזכיר לי מה התקציב, סוג הרכב והשימוש ששמרת, והאם ציינת שחשוב לי קילומטראז׳ נמוך?', 'עוד לא לקבוע פגישה ואל תעביר לנציג. רק רוצה לדעת מה לבדוק לפני קנייה.'], budget: 60000, action: 'עכשיו כן, תעבירו את הפנייה לנציג שיתקשר אליי. זו לא התחייבות לקנייה.' },
  { kind: 'sale-en', turns: ["Hello, I'm interested in buying a car from your fleet. Please notify me when cars become available.", 'I prefer a family car with a budget around 65000 shekels. It is for family trips with our children and city driving. I am still comparing, so no callback yet.', 'Can I see service and accident records and arrange an independent inspection before deciding? No callback yet.', 'Actually my budget is 55000 shekels, not 65000. Low mileage matters, but the exact model is open.', 'What budget, vehicle type and usage do you remember? No meeting or deal yet.'], budget: 55000, action: 'Please pass my enquiry to a representative for a callback now. I am not agreeing to a purchase or booking a viewing.' },
  { kind: 'lease-he', turns: ['מחפש ליסינג עסקי לרכב משפחתי, תקציב 2500 שקל בחודש. מתלבט בין 24 או 36 חודשים. לא רוצה שיתקשרו עדיין.', 'נוסעים 12000 קמ בשנה. מה כדאי להשוות בתחזוקה וביטוח? עוד לא החלטתי תקופה.', 'בחרתי 24 חודשים ו־15000 קמ לשנה, לא 12000. רכב משפחתי לשימוש עסקי.', 'המחיר במחשבון 2400 שקל לחודש הוא הערכה, נכון? התקציב שלי נשאר 2500.', 'מה התקופה, הקילומטרז׳, התקציב והשימוש ששמרת? עוד לא להעביר לנציג.'], budget: 2500, action: 'כן, עכשיו תעבירו את הפנייה לנציג לקבלת הצעה. אני לא מאשר עסקה.' },
  { kind: 'lease-en', turns: ['I am considering business leasing for a family car, budget 2500 shekels a month. I am unsure whether 24 or 36 months makes sense. No callback yet.', 'I expect 12000 km a year. What maintenance and insurance terms should I compare? No duration decision yet.', 'I have chosen 24 months and 15000 km a year, not 12000. Family car for business use.', 'The calculator price of 2400 shekels a month is only an estimate, correct? My budget stays 2500.', 'Which term, annual mileage, budget and usage do you remember? Do not pass this to a representative yet.'], budget: 2500, action: 'Please pass the enquiry to a representative for a quote now. I am not accepting a deal.' },
] as const;

describe.each([false, true])('fixed, non-adaptive journeys; controlled reading=%s (NOT live Gemini)', withReading => {
  it.each(['No child seat available?', 'If no child seat is available, what are the options?'])('keeps an availability question distinct from declining a seat: %s', async input => {
    const c = chat(withReading);
    await c.send('I want to rent a family car. We need one child seat.');
    const result = await c.send(input);
    expect(result.state.booking.childSeats).toBe(1);
    expect(c.count()).toBe(0);
  });
  it.each(rentals)('rental $locale: questions, corrections, own seat and repeated confirmation', async s => {
    const c = chat(withReading);
    for (const input of s.turns) { const r = await c.send(input); expect(r.escalate, input).toBe(false); expect(c.count()).toBe(0); }
    const sent = await c.send(s.confirm);
    expect(c.count()).toBe(1);
    expect(sent.state.completedRental).toMatchObject({ pickupLocation: s.pickup, returnLocation: s.ret, returnDate: s.date });
    expect(sent.state.completedRental).toMatchObject({ passengers: s.locale === 'he' ? 4 : 3, luggage: 2, childSeats: 0, vehicleNeed: s.locale === 'he' ? 'רכב משפחתי' : 'family car' });
    const recalled = await c.send(s.recall);
    expect(recalled.reply).toContain(s.locale === 'he' ? '15/12/2026' : '10/12/2026');
    await c.send(s.confirm);
    expect(c.count()).toBe(1);
  });
  it.each(service)('$kind: advisory then explicit request without resubmission', async s => {
    const c = chat(withReading);
    for (const input of s.advisory) expect((await c.send(input)).escalate, input).toBe(false);
    const action = await c.send(s.action);
    expect(action.escalate).toBe(true);
    expect(action.state.serviceReference).toBe('654321');
    const recalled = await c.send(s.recall);
    expect(recalled.reply).toContain('654321');
    expect(recalled.escalate).toBe(false);
    expect(c.count()).toBe(0);
  });
  it.each(commercial)('$kind: no premature handoff, corrected memory and explicit lead only', async s => {
    const c = chat(withReading);
    let result;
    for (const input of s.turns) { result = await c.send(input); expect(result.escalate, input).toBe(false); }
    expect(result!.state.commercial?.budget?.amount).toBe(s.budget);
    expect(result!.state.commercial?.vehiclePreference).toBe('family');
    if (s.kind.startsWith('lease')) expect(result!.state.commercial).toMatchObject({ termMonths: 24, annualMileageKm: 15000 });
    if (s.kind.startsWith('lease')) expect(result!.state.commercial?.usage).toContain('business');
    if (s.kind === 'sale-he') expect(result!.state.commercial?.usage).toEqual(expect.arrayContaining(['family', 'commuting']));
    if (s.kind === 'sale-en') expect(result!.state.commercial?.usage).toEqual(expect.arrayContaining(['family', 'city']));
    const action = await c.send(s.action);
    expect(action.escalate).toBe(true);
    expect(action.state.handoffKind).toBe('commercial');
    expect(c.count()).toBe(0);
  });
  it.each(['he', 'en'])('incident %s: multi-question safety and saved reference', async locale => {
    const c = chat(withReading);
    const turns = locale === 'he' ? [
      'הרכב השכור עמד בחניה ומישהו פגע בו. אף אחד לא נפגע, אבל יש נזק בפגוש ואני לא יודע מה לעשות עכשיו.',
      'אין לי כרגע מספר הזמנה. לצלם גם את הרכב השני ואת המקום? אפשר להמשיך בינתיים בנסיעה או שצריך לחכות להנחיות?',
      'ואם זו אשמת הנהג השני, זה אומר שלא אשלם השתתפות עצמית? אני לא רוצה להודות באחריות לפני שבודקים.',
      'מצאתי, מספר ההזמנה שלי הוא 654321. כבר הזמנתם גרר או שמרתם לי רכב חלופי?',
      'אז איזה מספר הזמנה שמרת, ומה עוד כדאי להכין לשיחה עם הנציג?',
      'כבר יש לך את מספר ההזמנה, נכון? והאם כבר הוזמן גרר?',
    ] : [
      'Our rental car was hit while parked. Nobody was hurt, but the bumper is damaged. What should I do?',
      'My booking reference is not handy. Should I photograph the other car and the location? Can I carry on driving or wait for instructions?',
      'If the other driver caused it, does that mean I will not pay any excess? I do not want to admit liability before it is checked.',
      'I found my booking reference: 654321. Have you already ordered a tow truck or reserved a replacement car?',
      'Which booking reference did you keep, and what should I have ready for the representative?',
      'You already have my booking reference, right? Has a tow truck actually been ordered?',
    ];
    let result;
    for (let i = 0; i < turns.length; i++) { result = await c.send(turns[i]); if (i > 0) expect(result.escalate, turns[i]).toBe(false); }
    expect(result!.reply).toContain('654321');
    expect(c.count()).toBe(0);
  });
});
