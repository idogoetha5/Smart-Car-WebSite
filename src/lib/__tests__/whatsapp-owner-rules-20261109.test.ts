import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

// Owner decisions, 2026-11-09: (1) a dashboard warning light goes straight to a representative,
// with no technical advice from the bot; (2) the bot does not discuss prices — the final price is
// set with a SmartCar representative.
function chat(initial: RebuildState | null, modelReply: string, locale: 'he' | 'en' = 'he') {
  let state = initial ?? ({ version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] } as RebuildState);
  const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: modelReply, source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-owner-rules', input, store), readTurn };
}

describe('warning light goes straight to a representative', () => {
  it.each([
    ['he', 'נדלקה לי נורה צהובה בלוח, מה זה אומר?'],
    ['he', 'נורת שמן נדלקה באמצע הנסיעה'],
    ['en', 'Hi, I am renting one of your cars and a yellow tyre pressure light just came on. Is it dangerous?'],
    ['en', 'check engine light is on in the rental'],
  ] as const)('hands off with the office number and no technical advice: %s', async (locale, input) => {
    const c = chat(null, 'Please inflate the tyres to the recommended pressure.', locale);
    const result = await c.send(input);
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('service_issue');
    expect(result.reply).toContain('09-9509757');
    expect(result.reply).not.toMatch(/inflate|לנפח|recommended pressure/);
    expect(c.readTurn).not.toHaveBeenCalled();
  });
  it('does not repeat the alert on a follow-up warning-light message', async () => {
    const c = chat(null, 'x');
    await c.send('נדלקה לי נורה צהובה בלוח');
    const again = await c.send('הנורה עדיין דלוקה, נדלקה שוב נורה אדומה בלוח');
    expect(again.escalate).toBe(false);
  });
  it.each(['מה קורה אם נדלקת נורה בזמן השכירות?', 'what if a warning light comes on during the rental?'])('keeps hypotheticals advisory: %s', async input => {
    const result = await chat(null, 'בזמן השכירות פנו לנציג.').send(input);
    expect(result.escalate).toBeFalsy();
  });
});

describe('no price talk', () => {
  it.each([
    'רכב קומפקטי יוצא בערך 250 ₪ ליום.',
    'Two small cars are usually cheaper than one large car.',
    'A compact costs around 300 NIS per day.',
  ])('rejects model price wording: %s', async modelReply => {
    const he = /[א-ת]/u.test(modelReply);
    const result = await chat(null, modelReply, he ? 'he' : 'en').send(he ? 'כמה בערך זה עולה ליום?' : 'how much is it roughly per day?');
    expect(result.reply).not.toBe(modelReply);
    expect(result.reply).toMatch(/נסגר סופית מול נציג SmartCar|final price is set with a SmartCar representative/);
  });
  it('still allows the approved indicative deposit', async () => {
    const reply = 'For a compact car, the indicative deposit is ₪1,500 on a credit card in the renter’s name.';
    const result = await chat(null, reply, 'en').send('how much is the deposit?');
    expect(result.reply).toBe(reply);
  });
});

// Live Chrome on 7ae01c5 (Hebrew sale): "שמעתי שאתם מוכרים גם רכבים… יד 2… עד 60 אלף" was routed
// to rental, "משהו קטן ואמין, אוטומט" was not stored and the inspection question was ignored.
describe('casual used-car purchase', () => {
  it('routes to sale, keeps budget and preference against a hypothetical, answers the inspection question', async () => {
    const c = chat(null, 'נשמח לעזור.');
    const first = await c.send('שמעתי שאתם מוכרים גם רכבים. מחפשת משהו יד 2 לבת שלי שמתחילה לנהוג, עד 60 אלף');
    expect(first.state.interest).toBe('sale');
    expect(first.reply).not.toMatch(/לאילו תאריכים/);
    const second = await c.send('משהו קטן ואמין, אוטומט. אם אעלה ל70 יהיה משהו הרבה יותר טוב? ויש בדיקה במכון לפני?');
    expect(second.state.commercial?.budget?.amount).toBe(60000);
    expect(second.state.commercial?.vehiclePreference).toBe('compact');
    expect(second.reply).toMatch(/בדיקה במכון/);
  });
});

// Live Chrome on 7ae01c5 (Hebrew family rental): "זוג עם 2 ילדים" counted 2, "צריך שני כיסאות
// בטיחות אחד לתינוק ואחד לבן 4" stored 1 seat, the model said "רשמתי את ההזמנה", and the
// conversation stalled without asking the return place.
describe('family rental details', () => {
  it('counts four travellers and two seats, rejects booking claims and asks the return place', async () => {
    const c = chat(null, 'רשמתי את ההזמנה לאיסוף מהרצליה עם שני כיסאות בטיחות.');
    const first = await c.send('היי אנחנו זוג עם 2 ילדים קטנים, צריכים רכב לחופשה בגליל');
    expect(first.state.booking.passengers).toBe(4);
    const second = await c.send('מהרצליה, מה 15.12 עד ה 19.12. צריך שני כיסאות בטיחות אחד לתינוק ואחד לבן 4');
    expect(second.state.booking.childSeats).toBe(2);
    expect(second.reply).not.toContain('רשמתי את ההזמנה');
    expect(second.reply).toMatch(/[?؟]/);
  });
  it.each(['couple with two kids, need a car in the north', 'we are a couple with 1 child'])('english family counts: %s', async input => {
    const result = await chat(null, 'Sure.', 'en').send(input);
    expect(result.state.booking.passengers).toBe(input.includes('two') ? 4 : 3);
  });
});

describe('no stall in a rental draft', () => {
  it('asks the missing return place when the model reply asks nothing', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { passengers: 4, pickupDate: '2026-12-15', returnDate: '2026-12-19', pickupLocation: 'הרצליה' }, history: [] } as RebuildState, 'עגלה נכנסת בדרך כלל במשפחתי, וההתאמה תלויה בדגם ובמידות העגלה.');
    const result = await c.send('ועגלה נכנסת במשפחתי?');
    expect(result.reply).toMatch(/איפה תרצו להחזיר אותו\?/);
  });
});

describe('name in the middle of a go-ahead message', () => {
  it('keeps "דנה בדיקה" and the main driver age group', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { passengers: 4, childSeats: 1, pickupDate: '2026-12-15', returnDate: '2026-12-19', pickupLocation: 'הרצליה' }, history: [{ from: 'bot', text: 'איפה תרצו להחזיר אותו?' }] } as RebuildState, 'בשמחה.');
    const result = await c.send('להחזיר גם בהרצליה. יאללה בואו נתקדם, דנה בדיקה, נהג ראשי בעלי בן 38');
    expect(result.state.booking.customerName).toBe('דנה בדיקה');
    expect(result.state.booking.driverAgeRange).toBe('24-plus');
    expect(result.reply).not.toMatch(/על איזה שם/);
  });
});

// Live Chrome on 8c03a3e: "מהרצליה, מה 15.12 עד ה 19.12" was not parsed locally, and the model's
// "רשמתי איסוף והחזרה בהרצליה" was sent although no return was saved.
describe('spaced Hebrew date range and partial route claims', () => {
  it('stores 15.12–19.12 and rejects the unsaved return claim', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { passengers: 4 }, history: [] } as RebuildState, 'מעולה, רשמתי איסוף והחזרה בהרצליה עם שני כיסאות בטיחות.');
    const result = await c.send('מהרצליה, מה 15.12 עד ה 19.12. צריך שני כיסאות בטיחות אחד לתינוק ואחד לבן 4');
    expect(result.state.booking).toMatchObject({ pickupDate: '2026-12-15', returnDate: '2026-12-19', childSeats: 2 });
  });
  it('rejects a return claim when neither return place nor date is saved', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupLocation: 'הרצליה' }, history: [] } as RebuildState, 'מעולה, רשמתי איסוף והחזרה בהרצליה.');
    const result = await c.send('מה כדאי לקחת, משפחתי או SUV?');
    expect(result.reply).not.toContain('רשמתי איסוף והחזרה');
  });
});

describe('return place with "גם"', () => {
  it.each(['להחזיר גם בהרצליה', 'נחזיר גם בהרצליה בסוף', 'להחזיר את הרכב גם בהרצליה'])('stores the return place: %s', async input => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupLocation: 'הרצליה' }, history: [] } as RebuildState, 'בשמחה.');
    expect((await c.send(input)).state.booking.returnLocation).toBe('הרצליה');
  });
});

// Live Chrome on a365bc0 (EN leasing): "maybe 12k km a year" was not stored (asked again), the
// leasing insurance question got the rental cover text, and "actually make it 3 years if thats
// cheaper" stayed at 24 months while the model said it switched.
describe('casual English leasing details', () => {
  it('keeps estimates and term changes, and does not answer leasing with rental cover', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', interest: 'leasing', commercial: { termMonths: 24, usage: ['business'] }, booking: {}, history: [] } as RebuildState, 'Insurance in leasing is included only if stated in the offer.', 'en');
    const second = await c.send('mostly city driving, maybe 12k km a year. budget around 3000 a month. is insurance included?');
    expect(second.state.commercial?.annualMileageKm).toBe(12000);
    expect(second.reply).not.toMatch(/Every rental includes basic cover/);
    const third = await c.send('actually make it 3 years if thats cheaper per month. and i only have a us licence, problem?');
    expect(third.state.commercial?.termMonths).toBe(36);
  });
  it('still ignores a pure what-if mileage', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', interest: 'leasing', commercial: { annualMileageKm: 15000 }, booking: {}, history: [] } as RebuildState, 'Mileage changes the offer.', 'en');
    const result = await c.send('what if I drove 30k km a year instead?');
    expect(result.state.commercial?.annualMileageKm).toBe(15000);
  });
});

describe('leasing callback and recall in one message', () => {
  it('passes the lead on and lists what was saved', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', interest: 'leasing', commercial: { termMonths: 36, annualMileageKm: 12000, usage: ['business', 'city'], budget: { amount: 3000, currency: 'unspecified' } }, booking: {}, history: [] } as RebuildState, 'How many km per year?', 'en');
    const result = await c.send('ok cool. can someone call me tomorrow with offers? what do you have on me so far');
    expect(result.escalate).toBe(true);
    expect(result.reply).toMatch(/36 months/);
    expect(result.reply).toMatch(/12000 km/);
    expect(result.reply).not.toMatch(/how many kilometres/i);
  });
});

// Live Chrome on 9d8bb3a (2026-11-11, Hebrew business trip): "סדאן נגיד" was not stored while the
// model said "בחרנו בקבוצה המשפחתית"; the airport-return reply said "כשתדעו את התאריכים"
// although dates were known.
describe('business trip wording', () => {
  it('stores a sedan as the family group and rejects an unsaved vehicle claim', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-12', pickupLocation: 'תל אביב' }, history: [] } as RebuildState, 'רשמנו החזרה ביום רביעי, ובחרנו בקבוצה המשפחתית.');
    const result = await c.send('עד רביעי. משהו נוח לנסיעות ארוכות, סדאן נגיד');
    expect(result.state.booking.vehicleNeed).toBe('רכב משפחתי (סדאן)');
  });
  it('rejects a vehicle choice claim when no vehicle is saved', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] } as RebuildState, 'בחרנו בקבוצה המשפחתית שמתאימה לנסיעות ארוכות.');
    const result = await c.send('מה מתאים לנסיעות ארוכות?');
    expect(result.reply).not.toContain('בחרנו בקבוצה');
  });
  it('does not ask for dates already given when the return is at the airport', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-12', returnDate: '2026-11-18', pickupLocation: 'תל אביב', vehicleNeed: 'רכב משפחתי (סדאן)' }, history: [] } as RebuildState, 'x');
    const result = await c.send('בעצם עד חמישי, הוסיפו לי פגישה. ואפשר להחזיר בנתב״ג כי יש לי טיסה?');
    expect(result.reply).not.toMatch(/כשתדעו את התאריכים/);
  });
});

describe('business go-ahead', () => {
  it('starts the request on "סבבה תפתח בקשה", keeps the name and answers the company receipt question', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-12', returnDate: '2026-11-19', pickupLocation: 'תל אביב', returnLocation: 'נתב״ג', vehicleNeed: 'רכב משפחתי (סדאן)' }, history: [{ from: 'customer', text: 'צריך רכב לפגישות בחיפה ובבאר שבע' }] } as RebuildState, 'בשמחה, פתחנו את הבקשה. האם תרצה להוסיף כיסא בטיחות?');
    const result = await c.send('סבבה תפתח בקשה. איתי בדיקה בן 45. צריך קבלה על שם החברה');
    expect(result.state.phase).toBe('booking');
    expect(result.state.booking.customerName).toBe('איתי בדיקה');
    expect(result.reply).not.toMatch(/פתחנו את הבקשה|כיסא בטיחות/);
    expect(result.reply).toMatch(/קבלה או חשבונית על שם החברה/);
  });
});
