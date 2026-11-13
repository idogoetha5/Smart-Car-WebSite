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
    expect(result.reply).toMatch(/להחזיר גם בהרצליה\?/);
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
    expect(r.reply).toMatch(/surcharge/);
    expect(r.reply).not.toMatch(/150|₪/);
  });
  it('hebrew arrival', async () => {
    const r = await chat(null, 'x').send('אנחנו נוחתים בנתב״ג ב-4.12 בלילה וצריכים רכב עד 10.12, נחזיר גם בנתב״ג');
    expect(r.state.booking).toMatchObject({ pickupLocation: 'נתב״ג', returnLocation: 'נתב״ג' });
  });
});

describe('airport tourist replay', () => {
  it('answers a late flight and starts intake on "ok lets do it. <name>, <age>"', async () => {
    const c = chat(null, 'Thank you, Sarah. A SmartCar representative will finalise the request with you.', 'en');
    await c.send('hi! landing at ben gurion dec 4 at 11pm, need a small car till dec 10, returning at the airport too');
    const late = await c.send('what happens if my flight is late? and is there an extra charge for the airport?');
    expect(late.reply).toMatch(/delayed/);
    const go = await c.send('ok lets do it. sarah cohen, 27');
    expect(go.state.phase).toBe('booking');
    expect(go.state.booking.customerName).toBe('sarah cohen');
    expect(go.state.booking.driverAgeRange).toBe('24-plus');
    expect(go.reply).not.toMatch(/will finalise the request/);
  });
});

// Owner decision 2026-11-12: mention the airport surcharge, never its amount.
describe('airport surcharge without an amount', () => {
  it.each([['he', 'יש תוספת על איסוף מנתב״ג?'], ['en', 'is there an extra fee for picking up at the airport?']] as const)('%s', async (locale, input) => {
    const r = await chat(null, 'The airport surcharge is ₪150.', locale).send(input);
    expect(r.reply).toMatch(/תוספת|surcharge/);
    expect(r.reply).not.toMatch(/150|₪/);
  });
});

// Owner, 2026-11-12: answer like a person; mention the website only when asked about it.
describe('airport surcharge wording', () => {
  it('does not mention the website unless asked', async () => {
    const r = await chat(null, 'x').send('יש תוספת על איסוף מנתב״ג?');
    expect(r.reply).toMatch(/תוספת/);
    expect(r.reply).not.toMatch(/אתר/);
  });
  it('explains the website estimate when the customer asks about it', async () => {
    const r = await chat(null, 'x').send('באתר ראיתי מחיר, התוספת של נתב״ג כלולה בו?');
    expect(r.reply).toMatch(/לא כלולה במחיר המשוער שמופיע באתר/);
    expect(r.reply).not.toMatch(/150|₪/);
  });
});

// Live Chrome on f2429db: the model copied the fact's instruction wording to the customer.
describe('no instruction text in replies', () => {
  it('rejects a reply that speaks about "the customer"', async () => {
    const r = await chat(null, 'רק אם הלקוח שואל על המחיר שמופיע באתר: התוספת על נתב״ג אינה כלולה במחיר המשוער שבאתר.').send('ובאתר כשראיתי את המחיר התוספת של נתב״ג כבר הייתה כלולה?');
    expect(r.reply).not.toMatch(/הלקוח/);
    expect(r.reply).toMatch(/לא כלולה במחיר המשוער/);
  });
});

describe('website follow-up after the airport answer', () => {
  it('answers "was it included on the website?" from context', async () => {
    const c = chat(null, 'המחיר הסופי ייסגר מול נציג SmartCar. האם תרצו לבדוק פרטים נוספים?');
    await c.send('היי, אם אני אוסף את הרכב בנתב״ג יש תוספת?');
    const r = await c.send('ובאתר כשראיתי את המחיר זה כבר היה כלול?');
    expect(r.reply).toMatch(/לא כלולה במחיר המשוער שמופיע באתר/);
  });
});

describe('airport surcharge amount question', () => {
  it('does not invent that the amount varies', async () => {
    const r = await chat(null, 'את סכום התוספת לנתב״ג סוגרים מול נציג SmartCar, מכיוון שהוא משתנה.').send('כמה בערך התוספת של נתב״ג?');
    expect(r.reply).not.toMatch(/משתנה/);
    expect(r.reply).not.toMatch(/150|₪/);
    expect(r.reply).toMatch(/נציג SmartCar/);
  });
});

describe('airport surcharge amount follow-up', () => {
  it('answers "כמה בערך התוספת?" without an amount or an invented reason', async () => {
    const c = chat(null, 'התוספת המדויקת נקבעת בהתאם להזמנה.');
    await c.send('היי, אם אני אוסף את הרכב בנתב״ג יש תוספת?');
    const r = await c.send('כמה בערך התוספת?');
    expect(r.reply).toMatch(/מוסר נציג SmartCar/);
    expect(r.reply).not.toMatch(/בהתאם להזמנה|משתנה|150|₪/);
  });
});

// Live Chrome on f04f261: moving an upcoming booking got the extension text, and the bot kept
// asking "shall we pass it on?" after the reference and the new date were given.
describe('moving an upcoming booking', () => {
  it('answers with the published 48h rule, takes the reference and hands off on the concrete change', async () => {
    const c = chat(null, 'בשמחה, נעדכן את הבקשה. האם תרצו שנעביר את השינוי לבדיקה?');
    const first = await c.send('היי יש לי הזמנה לשבוע הבא, אפשר להזיז אותה ביומיים?');
    expect(first.reply).toMatch(/48 שעות לפני האיסוף/);
    expect(first.reply).toMatch(/מספר ההזמנה/);
    const ref = await c.send('מספר הזמנה 556120');
    expect(ref.state.serviceReference).toBe('556120');
    const change = ref.escalate ? ref : await c.send('במקום ראשון שיהיה שלישי, אותו מספר ימים');
    expect(change.escalate).toBe(true);
    expect(change.reply).not.toMatch(/נעדכן את הבקשה/);
    const pay = await c.send('ויש על זה תשלום?');
    expect(pay.reply).toMatch(/48 שעות לפני האיסוף/);
    expect(pay.reply).not.toMatch(/מועד ההחזרה הקיים/);
  });
});

// Live Chrome on d9ac586 (English cancellation): "my car booking" not recognised, no handoff after the
// reference, and an invented refund timing.
describe('english cancellation of a car booking', () => {
  it('hands off with the reference and does not invent refund timing', async () => {
    const c = chat(null, 'Refunds typically show up within a few business days.', 'en');
    const first = await c.send('hi, my trip got cancelled, need to cancel my car booking for this saturday. do i get my money back?');
    expect(first.reply).toMatch(/72 hours/);
    expect(first.reply).toMatch(/booking reference/);
    const ref = await c.send('ref 440871');
    expect(ref.escalate).toBe(true);
    const timing = await c.send('how long until the refund comes through?');
    expect(timing.reply).not.toMatch(/business days|few days/i);
  });
});

// Live Chrome on 300ed99 (English, car won't start): "do not continue driving" for a stationary car,
// then the same line for "will someone come?" and for the booking number.
describe('car will not start', () => {
  it('gives a stationary-breakdown reply, an honest answer about help and acknowledges the reference', async () => {
    const c = chat(null, 'x', 'en');
    const first = await c.send('hey the rental wont start, just clicks when i turn the key. im at a gas station near haifa');
    expect(first.escalate).toBe(true);
    expect(first.reply).not.toMatch(/continue driving/);
    expect(first.reply).toContain('09-9509757');
    const come = await c.send('were ok, just stuck. will someone come?');
    expect(come.reply).toMatch(/cannot send help/);
    const ref = await c.send('booking 662310');
    expect(ref.reply).toContain('662310');
    const cancel = await c.send('hi, my trip got cancelled, need to cancel my car booking for this saturday. do i get my money back?');
    expect(cancel.reply).toMatch(/cancellation request/);
    expect(cancel.reply).toMatch(/72 hours/);
    expect(cancel.reply).not.toMatch(/keep driving/);
  });
});

// Live Chrome on 22edfad (young driver + friend): weekday-prefixed dates lost the pickup, and the
// friend's age replaced the main driver's age group.
describe('young driver with a friend', () => {
  it('keeps the 21-23 group and reads weekday-prefixed dates', async () => {
    const c = chat(null, 'x');
    await c.send('אהלן אני בן 22, אפשר לשכור אצלכם? צריך רכב לסופש מתל אביב');
    const dates = await c.send('מחמישי 19.11 עד ראשון 22.11, מחזיר בתל אביב');
    expect(dates.state.booking).toMatchObject({ pickupDate: '2026-11-19', returnDate: '2026-11-22', returnLocation: 'תל אביב' });
    const friend = await c.send('ואפשר שגם חבר שלי ינהג? הוא בן 25');
    expect(friend.state.booking.driverAgeRange).toBe('21-23');
    const go = await c.send('משהו קטן מספיק. סבבה תפתח בקשה, יונתן לוי');
    expect(go.state.booking.vehicleNeed).toBe('רכב קומפקטי');
    expect(go.state.booking.customerName).toBe('יונתן לוי');
    expect(go.reply).toMatch(/אלה פרטי הבקשה/);
  });
  it.each(['מיום חמישי 19.11 עד יום ראשון 22.11', 'thu 19.11 to sun 22.11'])('weekday-prefixed range: %s', async (input) => {
    const r = await chat(null, 'x').send(input);
    expect(r.state.booking).toMatchObject({ pickupDate: '2026-11-19', returnDate: '2026-11-22' });
  });
});

// Live Chrome on de9734f: "מיום רביעי 19.11" (19.11.2026 is a Thursday).
describe('weekday next to a date', () => {
  it.each([
    ['he', 'מעולה, רשמתי איסוף מיום רביעי 19.11 ועד יום ראשון 22.11.', 'מחמישי 19.11 עד ראשון 22.11, מחזיר בתל אביב'],
    ['en', 'Great, pickup on Wed Nov 19 and return on Sun Nov 22.', 'thu 19.11 to sun 22.11, returning in tel aviv'],
  ] as const)('rejects a wrong weekday (%s)', async (locale, model, input) => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
    try {
      const r = await chat(null, model, locale).send(input);
      expect(r.reply).not.toMatch(/רביעי 19\.11|Wed Nov 19/);
    } finally { vi.useRealTimers(); }
  });
});

// Live Chrome on e19c057 (extension from Eilat with a fuel question in between): the later
// "כן תבדקו לי, הזמנה 771204" got a generic service handoff, not the extension request.
describe('extension accepted after a side question', () => {
  it('treats "כן תבדקו לי" as accepting the earlier extension offer', async () => {
    const replies = ['הארכה דורשת בדיקת זמינות ואישור. האם תרצו שנבדוק עבורכם את אפשרות ההארכה מול נציג?', 'המדיניות היא מלא־מלא.', 'x'];
    let i = 0;
    let state = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] } as RebuildState;
    const readTurn = vi.fn(async () => ({ route: 'service', direction: 'none', fields: {}, reply: replies[Math.min(i++, 2)], source: 'gemini', model: 'f', groundedContext: true } as BotReading));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
    await getRebuiltBotReply('ext', 'היי אני עם הרכב שלכם עכשיו באילת, אפשר להחזיר אותו בעוד יומיים במקום מחר?', store);
    await getRebuiltBotReply('ext', 'ואם אני מחזיר בלי דלק מלא מה קורה?', store);
    const r = await getRebuiltBotReply('ext', 'כן תבדקו לי, הזמנה 771204', store);
    expect(r.escalate).toBe(true);
    expect(r.state.handoffKind).toBe('booking_change');
    expect(r.reply).toMatch(/בקשת השינוי|הארכה/);
  });
});

describe('extension check requested without an explicit offer', () => {
  it('hands off "כן תבדקו לי, הזמנה …" after an extension question', async () => {
    const c = chat(null, 'x');
    const first = await c.send('היי אני עם הרכב שלכם עכשיו באילת, אפשר להחזיר אותו בעוד יומיים במקום מחר?');
    expect(first.reply).toMatch(/תרצו שנבדוק/);
    await c.send('ואם אני מחזיר בלי דלק מלא מה קורה?');
    const r = await c.send('כן תבדקו לי, הזמנה 771204');
    expect(r.escalate).toBe(true);
    expect(r.state.handoffKind).toBe('booking_change');
  });
});

// Live Chrome on dc37ef6 (English business trip to Jerusalem): branch and "same place" not stored,
// an invoice promise, and "great, book it. mark stein, 45, …" did not start intake.
describe('english business trip to Jerusalem', () => {
  it('stores the route, does not promise an invoice and starts intake', async () => {
    const c = chat(null, 'Yes, we can issue an invoice for your company. Anything else?', 'en');
    const first = await c.send('hi need a car in jerusalem for a work trip, mon nov 23 morning to wed nov 25, same place');
    expect(first.state.booking).toMatchObject({ pickupLocation: 'Jerusalem', returnLocation: 'Jerusalem', pickupDate: '2026-11-23', returnDate: '2026-11-25' });
    const invoice = await c.send('nothing fancy. can i get an invoice for my company?');
    expect(invoice.reply).not.toMatch(/we can issue an invoice/i);
    expect(invoice.reply).toMatch(/representative/i);
    expect(invoice.state.booking.vehicleNeed).toBe('compact car');
    const go = await c.send('great, book it. mark stein, 45, mark.stein@example.com');
    expect(go.state.phase).toBe('booking');
    expect(go.state.booking.customerName).toBe('mark stein');
    expect(go.state.booking.driverAgeRange).toBe('24-plus');
    expect(go.state.booking.customerEmail).toBe('mark.stein@example.com');
  });
});

// Live Chrome on 94a899c: Saturday pickup got "branches closed, pick up Friday", and "יש על זה תוספת?"
// was read as an airport question. The website publishes a Shabbat notice (possible extra charge, arranged in advance).
describe('shabbat pickup', () => {
  it('states the published Shabbat notice and answers the surcharge follow-up', async () => {
    const c = chat(null, 'הסניפים שלנו סגורים בשבת, אפשר לאסוף ביום שישי.');
    const first = await c.send('שלום, אפשר לקבל רכב בשבת בבוקר בהרצליה? 28.11 עד 1.12');
    expect(first.reply).toMatch(/אפשר לתאם מראש איסוף או החזרה בשבת/);
    expect(first.state.booking.pickupLocation).toBe('הרצליה');
    expect(first.reply).toMatch(/להחזיר/);
    const fee = await c.send('יש על זה תוספת?');
    expect(fee.reply).toMatch(/^כן, על איסוף או החזרה בשבת עשויה להיות תוספת/);
    expect(fee.reply).not.toMatch(/נתב/);
  });
});

describe('vehicle stated at the start of a go-ahead message', () => {
  it.each([['משפחתי. יאללה תפתח בקשה, אבי כהן בן 40', 'רכב משפחתי'], ['SUV. ok lets do it. dan levi, 33', 'SUV']])('%s', async (input, vehicle) => {
    const locale = /[א-ת]/.test(input) ? 'he' : 'en';
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale, history: [], booking: { passengers: 4, luggage: 2, pickupDate: '2026-12-12', returnDate: '2026-12-15', pickupLocation: locale === 'he' ? 'הרצליה' : 'Herzliya', returnLocation: locale === 'he' ? 'הרצליה' : 'Herzliya' } } as RebuildState, 'x', locale);
    const r = await c.send(input);
    expect(r.state.booking.vehicleNeed).toBe(vehicle);
  });
});

// Live Chrome on fae43ff (English private leasing, Tucson): "maybe … for 2 years, around 15k" lost the term
// and model, and "ok yes pass it to someone" asked for the term instead of handing off.
describe('tentative leasing preferences', () => {
  it('keeps tentative term/model and hands off on "pass it to someone"', async () => {
    let state = { version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] } as RebuildState;
    const readTurn = vi.fn(async () => ({ route: 'explore', direction: 'none', fields: {}, reply: 'Would you like to check available Tucson offers?', source: 'gemini', model: 'f', groundedContext: true } as BotReading));
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn };
    await getRebuiltBotReply('tent', 'hi, thinking about private leasing, maybe a hyundai tucson for 2 years, around 15k km a year', store);
    expect(state.commercial).toMatchObject({ termMonths: 24, annualMileageKm: 15000, vehicleModel: 'hyundai tucson' });
    await getRebuiltBotReply('tent', 'actually make it 20k km. and what if i want to end the lease early?', store);
    expect(state.commercial).toMatchObject({ termMonths: 24, annualMileageKm: 20000 });
    const r = await getRebuiltBotReply('tent', 'ok yes pass it to someone', store);
    expect(r.escalate).toBe(true);
  });
});

// Live Chrome on b1c2b59: "תביאו לי רכב הביתה לפתח תקווה" asked where to pick up.
describe('home delivery phrased as "bring it home to <city>"', () => {
  it('stores home delivery with the city', async () => {
    const r = await chat(null, 'x').send('היי, אפשר שתביאו לי רכב הביתה לפתח תקווה? מ-3.12 עד 7.12');
    expect(r.state.booking.pickupLocation).toBe('מסירה עד הבית (פתח תקווה)');
    expect(r.reply).not.toMatch(/מאיפה תרצו לאסוף/);
  });
});

describe('name after a "תפתח בקשה" clause', () => {
  it('skips the command clause and takes the name', async () => {
    const c = chat(null, 'x');
    await c.send('היי, אפשר שתביאו לי רכב הביתה לפתח תקווה? מ-3.12 עד 7.12');
    await c.send('כן ושתאספו אותו מהבית בסוף');
    const r = await c.send('רכב קטן, אני לבד. תפתח בקשה, רינה שמש בת 35');
    expect(r.state.booking.customerName).toBe('רינה שמש');
    expect(r.reply).toMatch(/אלה פרטי הבקשה/);
  });
});

describe('hebrew wording cleanup', () => {
  it('removes vowel marks and fixes "בתואם מראש"', async () => {
    const r = await chat(null, 'אפשר לתאם מסירה בכתובת שלכם בתואֵם מראש, בכפוף לזמינות. איזה סוג רכב תרצו?').send('מה אתם ממליצים לטיול?');
    expect(r.reply).not.toMatch(/[\u05B0-\u05BC]/u);
    expect(r.reply).not.toMatch(/בתואם/);
  });
});

describe('home collection acknowledged', () => {
  it('says the collection was noted and asks for the vehicle', async () => {
    const c = chat(null, 'נשמח לעזור לכם לבחור רכב מתאים.');
    await c.send('היי, אפשר שתביאו לי רכב הביתה לפתח תקווה? מ-3.12 עד 7.12');
    const r = await c.send('כן ושתאספו אותו מהבית בסוף');
    expect(r.reply).toMatch(/^רשמתי גם איסוף של הרכב מהבית/);
    expect(r.reply).toMatch(/איזה רכב/);
  });
});

// Live Chrome on 614fa1f (English, scraped in a parking lot): no handoff, a liability "yes you pay",
// a generic line for "can i keep driving" and "my booking is 905512" not parsed.
describe('parking-lot scrape on a rental', () => {
  it('hands off, does not decide liability and takes the booking number', async () => {
    const c = chat(null, 'Yes, repair costs up to the excess are the renter\'s responsibility.', 'en');
    const first = await c.send('ugh someone scraped my rental in a parking lot in tel aviv, small dent on the rear door. nobody hurt');
    expect(first.escalate).toBe(true);
    expect(first.reply).toContain('09-9509757');
    const pay = await c.send('do i have to pay for it?');
    expect(pay.reply).not.toMatch(/renter's responsibility|yes, you/i);
    const ref = await c.send('ok thanks, my booking is 905512');
    expect(ref.state.serviceReference).toBe('905512');
    expect(ref.reply).toContain('905512');
  });
});

// Live Chrome on 0314617 (cheapest car for a month from Jerusalem): invented "מודיעין", and
// "כמה בערך לחודש?" got no price line.
describe('month-long rental price questions', () => {
  it('rejects an invented city', async () => {
    const r = await chat(null, 'נשמח לסייע בבחירת קבוצת רכב ממודיעין הסניף בירושלים. איזה סוג רכב תרצו?').send('היי מה הרכב הכי זול שיש לכם? צריך לחודש שלם מירושלים, מתחילת ינואר');
    expect(r.reply).not.toMatch(/מודיעין/);
  });
  it('states the owner price line for "כמה בערך לחודש?"', async () => {
    const r = await chat(null, 'נשמח לעזור לכם לבחור רכב מתאים. לאילו תאריכים תצטרכו את הרכב?').send('כמה בערך לחודש? רק שאדע אם זה בטווח שלי');
    expect(r.reply).toMatch(/המחיר נסגר סופית מול נציג SmartCar/);
  });
});

// Live Chrome on c4e0b4b: the name was stored as "מחזיר בירושלים".
describe('route clause is not a name', () => {
  it('takes "דוד מזרחי", not "מחזיר בירושלים"', async () => {
    const c = chat(null, 'x');
    await c.send('היי מה הרכב הכי זול שיש לכם? צריך לחודש שלם מירושלים, מתחילת ינואר');
    const r = await c.send('אוקיי, מה-3.1 עד ה-2.2, מחזיר בירושלים. תפתח בקשה, דוד מזרחי בן 50');
    expect(r.state.booking.customerName).toBe('דוד מזרחי');
  });
});

// Live Chrome on 39764b1 (English used-car purchase): no listing link, "Yes, we offer financing",
// and the enquiry switched to leasing.
describe('english used-car purchase with financing', () => {
  it('links the listing, does not promise financing and stays a purchase', async () => {
    const c = chat(null, 'Yes, we offer financing options for vehicle purchases. Would you prefer leasing or a direct purchase?', 'en');
    const first = await c.send('hey do you sell used cars? looking for a hybrid under 90k shekels');
    expect(first.reply).toContain('https://www.smartcar.co.il/en/cars-for-sale');
    const fin = await c.send('do you do financing?');
    expect(fin.reply).toMatch(/cannot confirm financing/i);
    expect(fin.state.interest).toBe('sale');
    const call = await c.send('ok have someone call me, im noa');
    expect(call.escalate).toBe(true);
    expect(call.reply).not.toMatch(/leasing/i);
  });
});

// Live regression sweep on 13346c1: "צריך לקחת ממנו פרטים?" after a collision got the generic safety line;
// "תבטלו לי את ההזמנה בבקשה, 334455" asked for the booking number.
describe('regression sweep 2026-11-12', () => {
  it('answers the other-driver details question', async () => {
    const c = chat(null, 'x');
    await c.send('מישהו נכנס בי מאחורה ברמזור, אני עם הרכב שלכם');
    const r = await c.send('צריך לקחת ממנו פרטים?');
    expect(r.reply).toMatch(/פרטי הנהג השני/);
  });
  it('takes a lone booking number in a cancellation message', async () => {
    const r = await chat(null, 'x').send('תבטלו לי את ההזמנה בבקשה, 334455');
    expect(r.state.serviceReference).toBe('334455');
    expect(r.escalate).toBe(true);
  });
});

describe('regression sweep 2026-11-12 (2)', () => {
  it('answers a refund question after a cancellation handoff with the tiers', async () => {
    const c = chat(null, 'x');
    await c.send('תבטלו לי את ההזמנה בבקשה, 334455');
    const r = await c.send('יחזירו לי את הכסף?');
    expect(r.reply).toMatch(/72/);
    expect(r.reply).toMatch(/לא מתבצע אוטומטית/);
  });
  it('"יאללה תפתח, משה לוי בן 45" starts intake and the model cannot claim the details were saved', async () => {
    const c = chat(null, 'הפרטים שלכם נשמרו לבקשת ההשכרה. האם תרצו להוסיף משהו?');
    await c.send('היי צריך רכב 7 מקומות מחר בבוקר מהרצליה לשלושה ימים, להחזיר בתל אביב. אנחנו 6');
    const r = await c.send('יאללה תפתח, משה לוי בן 45');
    expect(r.state.phase).toBe('booking');
    expect(r.state.booking.customerName).toBe('משה לוי');
    expect(r.reply).not.toMatch(/נשמרו לבקשת/);
  });
});

// Live Chrome on 3b50763: a 12.12.2026 (Saturday) return reached the summary without the website's Shabbat notice.
describe('summary notices', () => {
  it('adds the Shabbat and airport notices without amounts', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', history: [], booking: { vehicleNeed: 'compact car', passengers: 2, pickupDate: '2026-12-08', returnDate: '2026-12-12', pickupLocation: 'Ben Gurion Airport', returnLocation: 'Herzliya' } } as RebuildState, 'x', 'en');
    const r = await c.send('ok go ahead, im tom berg, 31');
    expect(r.reply).toMatch(/Saturday pickup or return/);
    expect(r.reply).toMatch(/Ben Gurion Airport carries a surcharge/);
    expect(r.reply).not.toMatch(/₪|150/);
  });
});

// Live Chrome on 25ce3b0: "can i add another driver to my booking 551199? its my wife" got the policy but no handoff.
describe('additional driver on an existing booking', () => {
  it.each([['en', 'can i add another driver to my booking 551199? its my wife'], ['he', 'אפשר להוסיף את אשתי כנהגת להזמנה 551199?']] as const)('%s hands off with the licence note', async (locale, input) => {
    const r = await chat(null, locale === 'he' ? 'אפשר לבקש להוסיף נהג.' : 'You can ask to add another driver.', locale).send(input);
    expect(r.escalate).toBe(true);
    expect(r.state.serviceReference).toBe('551199');
    expect(r.reply).toMatch(/licen[cs]e|רישיון/);
  });
});

describe('policy question after a handoff', () => {
  it('answers the foreign-licence question instead of repeating the receipt', async () => {
    const c = chat(null, 'You can ask to add another driver.', 'en');
    await c.send('can i add another driver to my booking 551199? its my wife');
    const r = await c.send('does she need an international licence? shes american');
    expect(r.reply).toMatch(/IDP|International Driving Permit|translation/i);
    expect(r.reply).toMatch(/already with a SmartCar representative/);
  });
});

// Live Chrome on 87253b8 (wedding up north): "אוסף מת\"א" not stored, and "וזה יוצא יקר?" got no price line.
describe('casual wedding trip', () => {
  it('reads ת"א and answers "יוצא יקר?" with the owner price line', async () => {
    const c = chat(null, 'רכב משפחתי יכול להתאים. איפה תרצו להחזיר?');
    const first = await c.send('הייי מה קורה😊 תשמע אני צריך אוטו לחתונה של אחי בצפון, משהו נחמד לא סתם קטנטן, אנחנו 4 + תיק כל אחד. בערך מה 17 לחודש הבא עד ה 20, אוסף מת"א');
    expect(first.state.booking.pickupLocation).toBe('תל אביב');
    const price = await c.send('רגע לא, עדיף מה 18. וזה יוצא יקר?');
    expect(price.reply).toMatch(/המחיר נסגר סופית מול נציג SmartCar/);
  });
  it.each([['אוסף מת״א ומחזיר בי-ם', 'תל אביב', 'ירושלים'], ['איסוף בנתבג והחזרה בת"א', 'נתב״ג', 'תל אביב']])('%s', async (input, pickup, ret) => {
    const r = await chat(null, 'x').send(`צריך רכב 3.12 עד 6.12, ${input}`);
    expect(r.state.booking).toMatchObject({ pickupLocation: pickup, returnLocation: ret });
  });
});

describe('casual wedding trip (2)', () => {
  it('reads "מה 17 לחודש הבא עד ה 20" and "תרשום על שם אלון ברק, אני 29"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
    try {
      const c = chat(null, 'x');
      const first = await c.send('הייי מה קורה😊 תשמע אני צריך אוטו לחתונה של אחי בצפון, משהו נחמד לא סתם קטנטן, אנחנו 4 + תיק כל אחד. בערך מה 17 לחודש הבא עד ה 20, אוסף מת"א');
      expect(first.state.booking).toMatchObject({ pickupDate: '2026-12-17', returnDate: '2026-12-20', pickupLocation: 'תל אביב' });
      const go = await c.send('אחזיר גם בת"א. משפחתי. סבבה תרשום על שם אלון ברק, אני 29');
      expect(go.state.booking.customerName).toBe('אלון ברק');
      expect(go.state.phase).toBe('booking');
    } finally { vi.useRealTimers(); }
  });
});

// Live Chrome on 1d1a5aa: a customer waiting 40 minutes at the branch got three identical robotic lines.
describe('frustrated customer waiting at the branch', () => {
  it('acknowledges, gives the fastest route and does not promise compensation', async () => {
    const c = chat(null, 'x', 'en');
    const first = await c.send('this is ridiculous. im at your tel aviv branch for 40 min, nobody is here and my pickup was at 10. booking 778820');
    expect(first.escalate).toBe(true);
    expect(first.reply).toMatch(/sorry you have been waiting/i);
    expect(first.reply).toContain('778820');
    const urgent = await c.send('seriously?? i have a flight to catch, i need the car NOW');
    expect(urgent.reply).toMatch(/urgent/i);
    const comp = await c.send('fine. but i want some kind of compensation for this');
    expect(comp.reply).toMatch(/cannot promise compensation/i);
  });
});

// Live Chrome on 8485966: a mother booking for her daughter — "היא בת 24" was not stored.
describe('booking for a family member', () => {
  it('takes the daughter\'s age as the driver age', async () => {
    const c = chat(null, 'x');
    await c.send('שלום אני מתקשרת בשביל הבת שלי היא מגיעה מחול בעוד שבועיים והיא צריכה רכב לכמה ימים היא נוחתת בנתבג');
    const r = await c.send('היא בת 24 יש לה רישיון ישראלי');
    expect(r.state.booking.driverAgeRange).toBe('24-plus');
  });
});

// Live Chrome on c5aba0f (mixed Hebrew/English, changes of mind): "רשמתי את בקשתכם", vehicle switch
// "בעצם תעשה משפחתי" ignored, and "רועי אזולאי בן 26 תסגור" did not start intake.
describe('changes of mind and casual closing', () => {
  it('switches the vehicle, blocks the claim and starts intake on "תסגור"', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', history: [], booking: { pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'הרצליה', vehicleNeed: 'רכב פנאי' } } as RebuildState, 'בשמחה! רשמתי את בקשתכם לרכב. האם תרצו להוסיף משהו?');
    const swap = await c.send('בעצם תעשה משפחתי זה יותר זול לא?');
    expect(swap.state.booking.vehicleNeed).toBe('רכב משפחתי');
    expect(swap.reply).not.toMatch(/רשמתי את בקשתכם/);
    const go = await c.send('כן נחזיר בירושלים. רועי אזולאי בן 26 תסגור');
    expect(go.state.phase).toBe('booking');
    expect(go.state.booking.customerName).toBe('רועי אזולאי');
  });
});

// Live Chrome on 33f65c4: "על החזרה בסניף שונים עשויה לחול תוספת" — no one-way fee is published.
describe('no invented one-way fee', () => {
  it('rejects a different-branch surcharge claim', async () => {
    const r = await chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', history: [], booking: { pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'הרצליה' } } as RebuildState,
      'אפשר לאסוף מהרצליה ולהחזיר בירושלים. על החזרה בסניף שונים עשויה לחול תוספת.').send('ואם אני רוצה להחזיר בירושלים במקום?');
    expect(r.reply).not.toMatch(/תוספת/);
  });
});

// Live Chrome on ca1bae5: four numbered questions, only the credit-card one answered.
describe('several questions in one message', () => {
  it('answers each known topic', async () => {
    const r = await chat(null, 'x').send('שאלות: 1. מאיזה גיל אפשר? 2. צריך כרטיס אשראי? 3. אפשר לצאת עם הרכב לאילת? 4. יש לכם רכבים חשמליים?');
    expect(r.reply).toMatch(/21/);
    expect(r.reply.match(/כרטיס אשראי תקף/g)).toHaveLength(1);
    expect(r.reply.length).toBeLessThan(520);
    expect(r.reply).toMatch(/נציג SmartCar ישמח/);
    expect(r.reply).toMatch(/כרטיס אשראי/);
    expect(r.reply).toMatch(/חשמליים/);
  });
  it('english', async () => {
    const r = await chat(null, 'x', 'en').send('quick questions: 1) minimum age? 2) do i need a credit card? 3) is fuel included?');
    expect(r.reply.split('•').length).toBe(4);
    expect(r.reply).not.toMatch(/answer the rest/);
  });
});

// Live Chrome on 9593a2d: "איפה תרצו להחזיר אותו?" was appended to four replies in a row while the
// customer asked other things. A representative asks once, answers, and confirms the obvious default.
describe('no repeated question after every answer', () => {
  const start = () => chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-19', returnDate: '2026-11-22', pickupLocation: 'הרצליה' }, history: [{ from: 'customer', text: 'מחמישי עד ראשון מהרצליה' }, { from: 'bot', text: 'איפה תרצו להחזיר אותו?' }] } as RebuildState, 'באיסוף נדרש כרטיס אשראי תקף על שם השוכר. איפה תרצו להחזיר אותו?');
  it('answers a side question without re-asking', async () => {
    const r = await start().send('אפשר לשלם מזומן?');
    expect(r.reply).toMatch(/כרטיס אשראי/);
    expect(r.reply).not.toMatch(/איפה תרצו להחזיר/);
  });
  it('confirms the same place on a go-ahead, and takes "כן" as the answer', async () => {
    const c = start();
    const r = await c.send('טוב תשריין לי אחד');
    expect(r.reply).not.toMatch(/איפה תרצו להחזיר/);
    if (/להחזיר גם בהרצליה\?/.test(r.reply)) {
      const yes = await c.send('כן');
      expect(yes.state.booking.returnLocation).toBe('הרצליה');
    }
  });
});

// Live Chrome on 6465929: after "the most economical is a small car", "טוב תשריין לי אחד" did not take the
// small car, and "יוסי בדיקה, בן 35" was ignored while the vehicle question repeated three times.
describe('a representative understands what was just offered', () => {
  it('takes the recommended category on a go-ahead and keeps a name given early', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-19', returnDate: '2026-11-22', pickupLocation: 'הרצליה', returnLocation: 'הרצליה' }, history: [{ from: 'customer', text: 'מה הכי זול שיש לכם' }, { from: 'bot', text: 'האפשרות החסכונית ביותר היא מכונית קטנה, שמתאימה לזוג או ליחיד.' }] } as RebuildState, 'x');
    const first = await c.send('טוב תשריין לי אחד');
    expect(first.state.booking.vehicleNeed).toBe('רכב קומפקטי');
    const second = await c.send('יוסי בדיקה, בן 35');
    expect(second.state.booking.customerName).toBe('יוסי בדיקה');
    expect(second.state.booking.driverAgeRange).toBe('24-plus');
  });
});

// Live Chrome on 6465929: "אאחר בשעה" was answered as an extension request, a reply contained Thai letters,
// and after the handoff every message (even "תודה אחי") got the same receipt line.
describe('running late and human follow-ups', () => {
  it('treats a delay on a return as a heads-up with the owner rule', async () => {
    const c = chat(null, 'לפי התנאים, ניקוי חריג עשוי להיות מחויב מהפיקדון; כדאי לנער את החול לפני ההחזרה.');
    const late = await c.send('היי אני אמור להחזיר היום ב5 את הרכב אבל תקוע בפקקים, אאחר בשעה בערך');
    // Owner decision 2026-11-13: up to an hour is fine; more than an hour, call the office.
    expect(late.escalate).toBeFalsy();
    expect(late.reply).toMatch(/עד שעה בהחזרה זה בסדר/);
    expect(late.reply).toContain('09-9509757');
    expect(late.reply).not.toMatch(/הארכ/);
  });
  it('keeps a hypothetical advisory and rejects foreign-script glitches', async () => {
    const r = await chat(null, 'חיוב על יวัน נוסף תלוי באישור.').send('מה קורה אם אני מאחר בהחזרה?');
    expect(r.escalate).toBeFalsy();
    expect(r.reply).not.toMatch(/วัน/);
  });
});

// Owner direction 2026-11-13: code decides, the model speaks. Fixed application wording is reworded by the
// model only when it keeps the facts (numbers, phone, question shape, language).
describe('rewording of fixed application replies', () => {
  const run = async (rewrite: string, input = 'אני רוצה להאריך את הרכב בעוד שבוע, אפשר?') => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'fixture', groundedContext: true } as BotReading),
      rewordTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: rewrite, source: 'gemini', model: 'fixture', groundedContext: true, rephrased: true } as BotReading) };
    return getRebuiltBotReply('fictional-reword', input, store);
  };
  it('uses a rewording that keeps the phone number', async () => {
    const r = await run('בשמחה, קיבלנו את הבקשה להאריך בשבוע. ההארכה תיכנס לתוקף רק אחרי שנבדוק זמינות ונאשר; אם זה דחוף אפשר להתקשר ל־09-9509757.');
    expect(r.reply).toMatch(/^בשמחה, קיבלנו את הבקשה/);
    expect(r.escalate).toBe(true);
  });
  it.each([
    'בשמחה, ההארכה אושרה. נתראה!',
    'קיבלנו את הבקשה. ההארכה תעלה 200 ₪ ליום; לעזרה התקשרו ל־09-9509757.',
    'We received your request; call 09-9509757 for urgent help.',
  ])('keeps the application wording when the rewording changes facts: %s', async rewrite => {
    const r = await run(rewrite);
    expect(r.reply).not.toBe(rewrite);
    expect(r.reply).toContain('09-9509757');
  });
});

// Live on 54632e2: the model read "landing at TLV" as an airport pickup, but the code dropped it and later
// asked "Where would you like to pick it up?".
describe('trusting the model on a branch pickup', () => {
  const reading = (fields: BotReading['fields']) => ({ route: 'book', direction: 'none', fields, reply: 'Sure.', source: 'gemini', model: 'f', groundedContext: true } as BotReading);
  const run = async (input: string, fields: BotReading['fields'], locale: 'he' | 'en' = 'en') => {
    let state: RebuildState | null = { version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(), readTurn: async () => reading(fields) };
    return (await getRebuiltBotReply('fictional-tlv', input, store)).state.booking;
  };
  it('keeps the airport for a landing message', async () => {
    expect((await run('hi, landing at TLV on dec 3 at 2am, can someone meet me with the car?', { pickupLocation: { value: 'TLV', evidence: 'TLV' } })).pickupLocation).toBe('Ben Gurion Airport');
  });
  it('does not turn a destination into the pickup', async () => {
    expect((await run('we are driving to Jerusalem for a week', { pickupLocation: { value: 'Jerusalem', evidence: 'Jerusalem' } })).pickupLocation).toBeUndefined();
    expect((await run('אנחנו נוסעים לירושלים לשבוע', { pickupLocation: { value: 'ירושלים', evidence: 'ירושלים' } }, 'he')).pickupLocation).toBeUndefined();
  });
});

// Live on 81ff53b: "רציתי לבטל את ההזמנה שלי למחר" was answered "נציג SmartCar יבדוק ויטפל בבקשה" with no
// handoff behind it. The promise must be real.
describe('a promise that a representative will handle it is backed by a handoff', () => {
  it('passes the case on when the model says a representative will deal with it', async () => {
    let state: RebuildState | null = { version: 2, phase: 'service', step: 'menu', locale: 'he', booking: {}, history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'בסדר גמור. נציג SmartCar יבדוק את הפרטים ויטפל בבקשה.', source: 'gemini', model: 'f', groundedContext: true } as BotReading) };
    const r = await getRebuiltBotReply('fictional-promise', 'שכחתי משקפי שמש ברכב שהחזרתי אתמול בהרצליה', store);
    if (r.source === 'gemini') { expect(r.escalate).toBe(true); expect(r.state.handedOff).toBe(true); expect(r.reply).toContain('09-9509757'); }
    else expect(r.reply).not.toMatch(/יטפל בבקשה/);
  });
});

// Live on 7dd693d: "שישי עד מוצש" — the model read Saturday as the return, but the date evidence "מוצש" was
// refused and its reply "מיום שישי ה־13.11 עד מוצאי השבת ה־14.11" was rejected as unsupported numbers.
describe('Israeli date forms in model replies', () => {
  it('keeps a return read from מוצ״ש and allows 13.11 for a known date', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T08:00:00Z'));
    try {
      let state: RebuildState | null = { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] };
      const reply = 'בסדר גמור, איסוף בהרצליה מיום שישי ה־13.11 עד מוצאי השבת ה־14.11. איזה רכב תרצו?';
      const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
        readTurn: async () => ({ route: 'book', direction: 'none', fields: { pickupDate: { value: '2026-11-13', evidence: 'שישי' }, returnDate: { value: '2026-11-14', evidence: 'מוצש' }, pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' } }, reply, source: 'gemini', model: 'f', groundedContext: true } as BotReading) };
      const r = await getRebuiltBotReply('fictional-motzash', 'מהרצליה, שישי עד מוצש', store);
      expect(r.state.booking.returnDate).toBe('2026-11-14');
      expect(r.reply).toContain('13.11');
    } finally { vi.useRealTimers(); }
  });
});

// Live on 4202d22: a rewording promised "נציג יחזור אליכם מחר בבוקר" (the timing guard had an operator-precedence
// bug), and "הוא ברח, לא לקחתי פרטים" after a collision got the safety receipt again.
describe('timing promises and safety follow-up statements', () => {
  it('rejects a rewording that adds a callback time', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'x', source: 'gemini', model: 'f', groundedContext: true } as BotReading),
      rewordTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'בשמחה, קיבלנו את הבקשה להאריך. נציג יחזור אליכם מחר בבוקר; ההארכה תקפה רק אחרי אישור. לעזרה מיידית ל־09-9509757.', source: 'gemini', model: 'f', groundedContext: true, rephrased: true } as BotReading) };
    const r = await getRebuiltBotReply('fictional-timing', 'אני רוצה להאריך את הרכב בעוד שבוע, אפשר?', store);
    expect(r.reply).not.toMatch(/מחר בבוקר/);
  });
  it('answers a statement after a collision with the model, keeping the safety line', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'לא נורא שלא לקחתם פרטים. צלמו את הנזק ואת המקום, וכדאי לבדוק אם יש מצלמות בחניון.', source: 'gemini', model: 'f', groundedContext: true } as BotReading) };
    await getRebuiltBotReply('fictional-hitrun', 'נהג ממונית חסם אותי בחניה והרכב שלכם קיבל מכה קטנה בדלת', store);
    const r = await getRebuiltBotReply('fictional-hitrun', 'הוא ברח, לא לקחתי פרטים', store);
    expect(r.reply).toMatch(/לא נורא/);
    expect(r.reply).toContain('09-9509757');
  });
});

// Live on 1194bd0: delivery to a hotel/home was understood by the model but not kept, so the bot asked which
// branch to pick up from; and the office number in history reached the model as "[phone removed]".
describe('home or hotel delivery as the pickup', () => {
  const run = async (input: string, value: string, locale: 'he' | 'en') => {
    let state: RebuildState | null = { version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'book', direction: 'none', fields: { pickupLocation: { value, evidence: value } }, reply: 'Sure.', source: 'gemini', model: 'f', groundedContext: true } as BotReading) };
    return (await getRebuiltBotReply('fictional-delivery', input, store)).state.booking.pickupLocation;
  };
  it('keeps the city only', async () => {
    expect(await run('hey, can you deliver a car to my hotel in herzliya tomorrow morning?', 'my hotel in herzliya', 'en')).toBe('Home delivery (Herzliya)');
    expect(await run('אפשר שמישהו יביא לי את הרכב לבית בנתניה?', 'לבית בנתניה', 'he')).toBe('מסירה עד הבית (נתניה)');
  });
  it('never stores a street address', async () => {
    expect((await run('תביאו לי את הרכב להרצל 12 בנתניה', 'הרצל 12 בנתניה', 'he')) ?? '').not.toMatch(/12|הרצל/);
  });
});

// Live on 43ed4a4: after a hit-and-run the model's answer named the office number and was rejected twice
// (contact_or_link, then unsupported_number), so the customer got the fixed receipt again.
describe('the office number in a model answer', () => {
  it('is accepted in a safety follow-up', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply: 'מצטער לשמוע שהוא ברח. כדאי לצלם את הנזק, ובכל מקרה לדווח ל־SmartCar בתוך שעה בטלפון 09-9509757.', source: 'gemini', model: 'f', groundedContext: true } as BotReading) };
    await getRebuiltBotReply('fictional-office', 'נהג ממונית חסם אותי בחניה והרכב שלכם קיבל מכה קטנה בדלת', store);
    const r = await getRebuiltBotReply('fictional-office', 'הוא ברח, לא לקחתי פרטים', store);
    expect(r.reply).toMatch(/מצטער לשמוע שהוא ברח/);
    expect(r.reply.match(/09-9509757/g)).toHaveLength(1);
  });
});

// Owner decision 2026-11-14: a problem with the car the customer has (live: "the car smells like cigarettes, i just
// picked it up") goes to a representative immediately with the office number. The model decides that, not a word list.
describe('the model decides when a representative is needed now', () => {
  const run = async (input: string, needsRepresentative: boolean, reply: string, locale: 'he' | 'en' = 'en') => {
    let state: RebuildState | null = { version: 2, phase: 'explore', step: 'menu', locale, booking: {}, history: [] };
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, n) => { state = structuredClone(n); }, activeBooking: async () => null, createRentalRequest: vi.fn(),
      readTurn: async () => ({ route: 'service', direction: 'none', fields: {}, reply, source: 'gemini', model: 'f', groundedContext: true, needsRepresentative } as BotReading) };
    return getRebuiltBotReply('fictional-needs-rep', input, store);
  };
  it('hands off with the office number when the model says a person must act', async () => {
    const r = await run('bro the car smells like cigarettes, i just picked it up', true, "Sorry about that — that's not how the car should be.");
    expect(r.escalate).toBe(true);
    expect(r.state.handedOff).toBe(true);
    expect(r.reply).toMatch(/representative/);
    expect(r.reply).toContain('09-9509757');
  });
  it('does not hand off a question about what would happen', async () => {
    const r = await run('what if the car smells of smoke when I get it?', true, 'If the car is not clean at pickup, tell us right away and we will sort it out.');
    expect(r.escalate).toBeFalsy();
  });
  it('does not hand off when the model says no person is needed', async () => {
    const r = await run('is the car cleaned between rentals?', false, 'Yes, every car is cleaned before it is handed over.');
    expect(r.escalate).toBeFalsy();
  });
});

// Live on 9842d31: "what happens if i get a flat tire?" raised a safety alert to the office.
describe('what-if questions about incidents', () => {
  it.each(['what happens if i get a flat tire?', 'מה עושים אם יש פנצ׳ר בדרך?'])('do not raise an alert: %s', async input => {
    const r = await chat(null, 'If you get a flat tyre, stop somewhere safe and call the office; do not change it yourself.', /[א-ת]/.test(input) ? 'he' : 'en').send(input);
    expect(r.escalate).toBeFalsy();
  });
  it.each(['i have a flat tire right now on route 1', 'יש לי פנצ׳ר עכשיו בכביש 6'])('still raise one for a real report: %s', async input => {
    const r = await chat(null, 'x', /[א-ת]/.test(input) ? 'he' : 'en').send(input);
    expect(r.escalate).toBe(true);
  });
});

