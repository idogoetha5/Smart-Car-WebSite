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
    expect(result.reply).toMatch(/קבלה או חשבונית על שם החברה מבקשים מנציג/);
  });
});

describe('known pickup branch', () => {
  it('rejects "באיזה סניף בתל אביב תרצה לאסוף" when pickup is saved', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-12', pickupLocation: 'תל אביב' }, history: [] } as RebuildState, 'רשמתי החזרה ביום רביעי. באיזה סניף או כתובת בתל אביב תרצה לאסוף את הרכב?');
    const result = await c.send('עד רביעי');
    expect(result.reply).not.toMatch(/באיזה סניף/);
  });
});

// Live Chrome on 6f15fef (2026-11-11): "מותר לנסוע בכביש 6? מי משלם על זה" got "נדרש מספר הזמנה",
// and a parking ticket got unapproved "pay the municipality directly" advice.
describe('toll roads and fines from the published terms', () => {
  const service = (): RebuildState => ({ version: 2, phase: 'service', step: 'menu', locale: 'he', booking: {}, history: [{ from: 'customer', text: 'אני עם רכב שלכם' }] } as RebuildState);
  it('answers Highway 6 honestly with the office number', async () => {
    const result = await chat(service(), 'x').send('היי אני עם רכב שלכם, מותר לנסוע בכביש 6? מי משלם על זה');
    expect(result.reply).toMatch(/כביש 6/);
    expect(result.reply).toMatch(/על חשבון השוכר/);
    expect(result.reply).toContain('09-9509757');
    expect(result.reply).not.toMatch(/נדרש מספר ההזמנה/);
  });
  it('answers a parking ticket from terms §8', async () => {
    const result = await chat(service(), 'אפשר לשלם את הדו״ח ישירות לעירייה.').send('וקיבלתי דו״ח חניה אתמול בתל אביב 😬 מה קורה עכשיו');
    expect(result.reply).not.toMatch(/SmartCar (?:תשלם|ישלם)|אנחנו נשלם|לא תצטרכו לשלם/);
  });
});

describe('key problems go to a representative', () => {
  it.each([['en', 'also i think i lost one of the car keys at the beach ugh. what do i do'], ['he', 'איבדתי את המפתח של הרכב שלכם בים, מה עושים'], ['he', 'ננעלתי מחוץ לרכב והמפתחות בפנים']] as const)('hands off once with the number: %s', async (locale, input) => {
    const result = await chat(null, 'Please send the booking reference.', locale).send(input);
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('09-9509757');
  });
  it('keeps "what if I lose the key" advisory', async () => {
    const result = await chat(null, 'Keys are covered by the agreement terms.', 'en').send('what if I lose the key during the rental?');
    expect(result.escalate).toBeFalsy();
  });
});

// Live Chrome on 8db0660 (2026-11-11, Hebrew home delivery): "מיום ראשון הבא לשבוע בדיוק" stored only
// pickup, home delivery/collection in רמת גן was not stored, and "יאללה. רוני בדיקה, בן 52" looped.
describe('home delivery for a week', () => {
  it('derives the return date, stores delivery/collection by city and starts on a go-ahead with a name', async () => {
    // The weekday pickup itself comes from the model with the calendar; the fixture supplies it.
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-15' }, history: [{ from: 'customer', text: 'היי, אתם מביאים רכב עד הבית? אני ברמת גן' }, { from: 'bot', text: 'אפשר לתאם מסירה בכתובת שלכם.' }] } as RebuildState, 'רכב קומפקטי יכול להתאים.');
    const second = await c.send('אחלה. מיום ראשון הבא לשבוע בדיוק, קטן, אני לבד. ושיאספו אתו מהבית בסוף גם');
    expect(second.state.booking.pickupDate).toBe('2026-11-15');
    expect(second.state.booking.returnDate).toBe('2026-11-22');
    expect(second.state.booking.pickupLocation).toBe('מסירה עד הבית (רמת גן)');
    expect(second.state.booking.returnLocation).toBe('איסוף מהבית (רמת גן)');
    const third = await c.send('יאללה. רוני בדיקה, בן 52');
    expect(third.state.phase).toBe('booking');
    expect(third.state.booking.customerName).toBe('רוני בדיקה');
    expect(third.reply).toMatch(/אלה פרטי הבקשה/);
  });
  it.each(['מיום ראשון בערך לשבוע', 'אולי לשבוע'])('does not turn an approximate length into a return date: %s', async input => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-15' }, history: [] } as RebuildState, 'בשמחה.');
    expect((await c.send(input)).state.booking.returnDate).toBeUndefined();
  });
});

// Live Chrome on 7d77e88 (EN SUV): "back to tel aviv" and "3 of us" were not stored and
// "ok fine. go ahead, im dan, 34" did not start the request; the return place was asked three times.
describe('compact english rental phrasing', () => {
  it('stores return place and travellers, then starts on go-ahead with a self introduction', async () => {
    const c = chat(null, 'An SUV is a direction to check.', 'en');
    const first = await c.send('hey need an suv from tel aviv nov 20 to nov 24, back to tel aviv. 3 of us');
    expect(first.state.booking).toMatchObject({ returnLocation: 'Tel Aviv', passengers: 3 });
    const go = await c.send('ok fine. go ahead, im dan, 34');
    expect(go.state.phase).toBe('booking');
    expect(go.state.booking.customerName).toBe('dan');
    expect(go.reply).toMatch(/Here are your request details/);
  });
});

describe('card brand question', () => {
  it('answers a card brand question honestly', async () => {
    const c = chat(null, 'The deposit for an SUV is indicative.', 'en');
    const r = await c.send('whats the deposit on an suv and do you take amex?');
    expect(r.reply).toMatch(/card brand is accepted/);
  });
});

// Live Chrome on 5e919d0: the model prefixed the price line to a Highway 6 "who pays" question.
describe('price line only for price questions', () => {
  it('drops the price line from a toll answer', async () => {
    const r = await chat(null, 'המחיר נסגר סופית מול נציג SmartCar, לפי התאריכים, סוג הרכב והתוספות שתבחרו. אפשר לנסוע בכביש 6; האגרות על חשבון השוכר.').send('אפשר לעלות על כביש 6? מי משלם');
    expect(r.reply).not.toContain('המחיר נסגר סופית');
    expect(r.reply).toMatch(/כביש 6/);
  });
});

// Live Chrome on 44546b2: "האם תרצי שנעזור … הנסיעה שלך" assumed a female customer.
describe('gender-neutral Hebrew address', () => {
  it('turns feminine singular into plural only when the model used it', async () => {
    const r = await chat(null, 'לטיול בצפון רכב משפחתי נותן מקום לציוד. האם תרצי שנעזור בפרטים נוספים לגבי הנסיעה שלך?').send('מה מתאים לטיול בצפון?');
    expect(r.reply).toContain('תרצו');
    expect(r.reply).toContain('הנסיעה שלכם');
    expect(r.reply).not.toMatch(/תרצי|שלך(?![\p{L}])/u);
  });
});

// Live Chrome on be627d1 (Jerusalem family story): "רשמתי בקשה" claim, a generic closing
// question instead of the missing return place, and "אני משה כהן" not taken as the name.
describe('jerusalem family rental', () => {
  it('asks for the return place instead of a generic closing question', async () => {
    const known = { version: 2, phase: 'explore', step: 'menu', locale: 'he', history: [{ from: 'customer', text: 'צריך 7 מקומות מחר מירושלים לשלושה ימים' }],
      booking: { passengers: 6, pickupDate: '2026-12-12', returnDate: '2026-12-15', pickupLocation: 'ירושלים', vehicleNeed: 'רכב שבעה מקומות' } } as RebuildState;
    const c = chat(known, 'כן, אפשר להוסיף כיסא בטיחות. האם תרצו להוסיף דבר מה נוסף לבקשה?');
    const r = await c.send('יש לכם כיסא לתינוק? הקטן בן שנה');
    expect(r.reply).toMatch(/להחזיר/);
    expect(r.reply).not.toMatch(/דבר מה נוסף/);
  });
  it('does not claim a request was recorded', async () => {
    const r = await chat(null, 'בשמחה! רשמתי בקשה לרכב שבעה מקומות ממירושלים מחר.').send('אהלן צריך 7 מקומות מחר מירושלים לשלושה ימים');
    expect(r.reply).not.toMatch(/רשמתי בקשה/);
  });
  it.each([['סבבה תפתח לי בקשה, אני משה כהן', 'משה כהן'], ['יאללה נתקדם. שמי דנה לוי', 'דנה לוי']])('takes the Hebrew self-introduction as the name: %s', async (input, name) => {
    const c = chat(null, 'x');
    await c.send('צריך רכב משפחתי מתל אביב מ-20.12 עד 23.12, להחזיר בתל אביב');
    const r = await c.send(input);
    expect(r.state.booking.customerName).toBe(name);
  });
  it.each(['סבבה תפתח לי בקשה, אני בן 38', 'יאללה תפתח בקשה, אני הנהג', 'תפתח בקשה. אני רוצה משפחתי'])('does not take non-names: %s', async (input) => {
    const c = chat(null, 'x');
    await c.send('צריך רכב משפחתי מתל אביב מ-20.12 עד 23.12, להחזיר בתל אביב');
    const r = await c.send(input);
    expect(r.state.booking.customerName).toBeUndefined();
  });
});

describe('hebrew adults and children count', () => {
  it.each([['אנחנו 2 מבוגרים ו3 ילדים', 5], ['שני מבוגרים ושלושה ילדים', 5], ['3 מבוגרים עם 2 ילדים', 5]])('%s', async (phrase, n) => {
    const r = await chat(null, 'x').send(`היי צריך רכב 7 מקומות מירושלים, מה-18.12 לארבעה ימים. ${phrase}`);
    expect(r.state.booking.passengers).toBe(n);
  });
});

describe('booster seat question', () => {
  it.each(['לירושלים חזרה. יש לכם כיסא בוסטר?', 'do you have a booster?', 'רגע אנחנו 5 לא 2, ותוסיף בוסטר אחד', 'please add one booster seat'])('stores one seat: %s', async (input) => {
    const r = await chat(null, 'x').send(input);
    expect(r.state.booking.childSeats).toBe(1);
  });
});

// Live Chrome on 36b92c8: a beeping rental got speculative technical wording without the number.
describe('beeps and strange noises go to a representative', () => {
  it.each([['he', 'היי לקחתי מכם רכב אתמול בהרצליה, הוא מצפצף כל פעם שאני נוסע מעל 90, זה תקין?'], ['en', 'the rental keeps beeping when I drive, is that normal?'], ['en', 'hearing a weird noise from the front wheel']] as const)('%s: %s', async (locale, input) => {
    const r = await chat(null, 'It may be a built-in speed alert.', locale).send(input);
    expect(r.escalate).toBe(true);
    expect(r.reply).toContain('09-9509757');
  });
  it('adds the number when the wording says to contact the service centre', async () => {
    const r = await chat(null, 'כדי לבדוק את זה מומלץ ליצור קשר עם מוקד השירות שלנו.').send('מה שעות הפעילות שלכם בשישי?');
    if (/מוקד השירות/.test(r.reply)) expect(r.reply).toContain('09-9509757');
  });
});

describe('after a beep handoff', () => {
  it('answers a replacement ask and a booking number specifically', async () => {
    const c = chat(null, 'x');
    const first = await c.send('היי לקחתי מכם רכב אתמול בהרצליה, הוא מצפצף כל פעם שאני נוסע מעל 90, זה תקין?');
    expect(first.reply).toMatch(/צפצוף או רעש/);
    expect(first.reply).not.toMatch(/נורת אזהרה/);
    const swap = await c.send('אוקיי אבל אפשר להחליף לי רכב? זה מעצבן');
    expect(swap.reply).toMatch(/החלפת רכב/);
    expect(swap.escalate).toBe(false);
    const ref = await c.send('הזמנה 884512');
    expect(ref.reply).toContain('884512');
    expect(ref.state.serviceReference).toBe('884512');
  });
});

// Live Chrome on bf2f85d (Hebrew private leasing, Corolla hybrid): broken "20, לשנה" and a stall after all details.
describe('leasing with a named model', () => {
  it('keeps the model, rejects a broken figure and offers the representative step', async () => {
    const replies = ['בליסינג פרטי לקורולה ל־36 חודשים המחיר נסגר מול נציג. מהו הקילומטראז׳ השנתי?', 'מעולה, 20, לשנה מתאים מאוד לליסינג פרטי. האם תרצו להוסיף תקציב?'];
    let i = 0;
    let state = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] } as RebuildState;
    const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: replies[i++] ?? 'x', source: 'gemini', model: 'f', groundedContext: true } as BotReading));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
    await getRebuiltBotReply('lease', 'היי כמה עולה ליסינג פרטי על קורולה היברידית ל3 שנים?', store);
    expect(state.commercial?.vehicleModel).toBe('קורולה היברידית');
    const r = await getRebuiltBotReply('lease', 'אני עושה בערך 20 אלף קמ בשנה', store);
    expect(r.reply).not.toMatch(/20, לשנה/);
    expect(r.reply).toMatch(/נציג SmartCar/);
    const yes = await getRebuiltBotReply('lease', 'כן', store);
    expect(yes.escalate).toBe(true);
  });
});

// Live Chrome on 25e3610 (Tucson): no price line, and "בערך 15 אלף בשנה" after the mileage question was not taken.
describe('leasing Tucson replay', () => {
  it('states the owner price line, takes a bare mileage answer and offers the representative', async () => {
    const replies = ['ליסינג פרטי ל־4 שנים על טוסון הוא אפשרות טובה. מהו הקילומטראז׳ השנתי הצפוי?', 'מעולה. מה התקציב החודשי המועדף?'];
    let i = 0;
    let state = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] } as RebuildState;
    const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: replies[i++] ?? 'x', source: 'gemini', model: 'f', groundedContext: true } as BotReading));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
    const first = await getRebuiltBotReply('tucson', 'שלום, מעניין אותי ליסינג פרטי על טוסון ל4 שנים, כמה זה בחודש?', store);
    expect(first.reply).toMatch(/נסגר סופית מול נציג SmartCar/);
    const second = await getRebuiltBotReply('tucson', 'בערך 15 אלף בשנה', store);
    expect(state.commercial?.annualMileageKm).toBe(15000);
    expect(second.reply).toMatch(/נציג SmartCar/);
    const yes = await getRebuiltBotReply('tucson', 'כן תעביר', store);
    expect(yes.escalate).toBe(true);
  });
});

// Live Chrome on 6832c25: model offer "האם תרצו שנחזור אליכם עם הצעה מפורטת?" + "כן תעביר" did not hand off,
// and the model claimed a representative would return with an offer.
describe('model-worded leasing offer', () => {
  it('treats "שנחזור אליכם" as the representative offer', async () => {
    const known = { version: 2, phase: 'explore', step: 'menu', locale: 'he', interest: 'leasing', booking: {}, commercial: { termMonths: 48, annualMileageKm: 15000, vehicleModel: 'טוסון' },
      history: [{ from: 'customer', text: 'ליסינג על טוסון ל4 שנים' }, { from: 'bot', text: 'נציג SmartCar ישמח לעבור איתכם על הפרטים. האם תרצו שנחזור אליכם עם הצעה מפורטת?' }] } as RebuildState;
    const r = await chat(known, 'בשמחה! נציג SmartCar יעבור איתכם על הפרטים ויחזור אליכם עם הצעה מסודרת.').send('כן תעביר');
    expect(r.escalate).toBe(true);
  });
  it('states the owner price line even when the model mentions an offer', async () => {
    const r = await chat(null, 'ליסינג פרטי על טוסון הוא אפשרות טובה, נתאים לכם הצעה. מה הקילומטראז׳ השנתי?').send('שלום, מעניין אותי ליסינג פרטי על טוסון ל4 שנים, כמה זה בחודש?');
    expect(r.reply).toMatch(/נסגר סופית מול נציג SmartCar/);
  });
});

// Live Chrome on ba0bdc6 (Kia Niro): "תודה רציתי לשאול," salutation, model name without the brand,
// and a reply with no offer so "כן בבקשה" went nowhere.
describe('leasing Kia Niro replay', () => {
  it('keeps the brand, rejects the echoed salutation and offers the representative', async () => {
    const replies = ['בליסינג פרטי לקיה נירו המחיר נקבע בהצעה. מהו הקילומטראז׳ השנתי?', 'תודה רציתי לשאול, 18 אלף ק"מ מתאים לליסינג פרטי. נציג SmartCar יעזור לכם לבנות את ההצעה.'];
    let i = 0;
    let state = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] } as RebuildState;
    const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: replies[i++] ?? 'x', source: 'gemini', model: 'f', groundedContext: true } as BotReading));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
    await getRebuiltBotReply('niro', 'היי רציתי לשאול על ליסינג פרטי לקיה נירו לשלוש שנים, מה המחיר?', store);
    expect(state.commercial?.vehicleModel).toBe('קיה נירו');
    const second = await getRebuiltBotReply('niro', 'משהו כמו 18 אלף', store);
    expect(second.reply).not.toMatch(/רציתי לשאול/);
    expect(second.reply).toMatch(/תרצו ש(?:אעביר|נציג)/);
    const yes = await getRebuiltBotReply('niro', 'כן בבקשה', store);
    expect(yes.escalate).toBe(true);
  });
});

// Live Chrome on 98003bd (English business leasing): "3 yrs" and "25k a year" were not taken,
// so the bot asked for the term three times.
describe('english business leasing shorthand', () => {
  it('takes yrs, k-a-year mileage, fleet size and the go-ahead', async () => {
    let state = { version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] } as RebuildState;
    const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: 'Business leasing for an Octavia is a good fit. Is there anything else you would like to add?', source: 'gemini', model: 'f', groundedContext: true } as BotReading));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
    await getRebuiltBotReply('biz', 'hey, looking at business leasing for 2 company cars, something like a skoda octavia, 3 yrs', store);
    expect(state.commercial).toMatchObject({ termMonths: 36, fleetSize: 2, vehicleModel: 'skoda octavia' });
    const second = await getRebuiltBotReply('biz', 'each does maybe 25k a year', store);
    expect(state.commercial?.annualMileageKm).toBe(25000);
    expect(second.reply).toMatch(/representative/i);
    const go = await getRebuiltBotReply('biz', 'sure pass it on. its for my company, im avi', store);
    expect(go.escalate).toBe(true);
  });
});

// Live Chrome on 03724e9 (Hebrew used-car purchase): "יש לנו מבחר רכבים משומשים" stock claim, no pointer to the listing.
describe('used-car purchase', () => {
  it('rejects a stock claim and links the cars-for-sale page', async () => {
    const r = await chat(null, 'בשמחה! יש לנו מבחר רכבים משומשים ונשמח לעזור. מה השימוש המתוכנן?').send('היי ראיתי שאתם מוכרים רכבים משומשים, יש לכם משהו משפחתי עד 80 אלף?');
    expect(r.reply).not.toMatch(/יש לנו מבחר/);
    expect(r.reply).toContain('https://www.smartcar.co.il/he/cars-for-sale');
  });
  it('does not repeat the link on the next turn and fixes "בה בהחלט"', async () => {
    const c = chat(null, 'אפשר בה בהחלט לתאם הגעה לסניף. איזה סניף נוח לכם?');
    await c.send('היי ראיתי שאתם מוכרים רכבים משומשים, יש לכם משהו משפחתי?');
    const r = await c.send('אפשר לבוא לראות מחר?');
    expect(r.reply).not.toContain('cars-for-sale');
    expect(r.reply).not.toMatch(/בה בהחלט/);
  });
});

// Live Chrome on d4441bb (English tourist at Ben Gurion): arrival not taken as pickup, and the model
// denied the published ₪150 airport surcharge.
describe('airport arrival and surcharge', () => {
  it('takes landing at the airport as pickup and returning there as return', async () => {
    const r = await chat(null, 'A compact is a good start.', 'en').send('hi! landing at ben gurion dec 4 at 11pm, need a small car till dec 10, returning at the airport too');
    expect(r.state.booking).toMatchObject({ pickupLocation: 'Ben Gurion Airport', returnLocation: 'Ben Gurion Airport' });
  });
  it('states the airport surcharge and never denies it', async () => {
    const r = await chat(null, 'There is no separate public branch fee for airport collection.', 'en').send('is there an extra charge for the airport?');
    expect(r.reply).not.toMatch(/no separate/i);
    expect(r.reply).toMatch(/₪150/);
  });
  it('hebrew arrival', async () => {
    const r = await chat(null, 'x').send('אנחנו נוחתים בנתב״ג ב-4.12 בלילה וצריכים רכב עד 10.12, נחזיר גם בנתב״ג');
    expect(r.state.booking).toMatchObject({ pickupLocation: 'נתב״ג', returnLocation: 'נתב״ג' });
  });
});
