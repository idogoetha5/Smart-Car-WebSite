import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), evaluation: vi.fn() }));
vi.mock('@/lib/whatsapp-gemini-client', () => ({ generateSmartCarContent: mocks.generate, readJson: JSON.parse }));
vi.mock('@/lib/whatsapp-model-evaluation', () => ({ activeModelEvaluation: mocks.evaluation }));
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import { israelCalendar, readBotTurn, type BotReading } from '@/lib/whatsapp-rebuild-gemini';

// Live Chrome failure on 39c3a4d, 2026-11-09 (evidence/20261109-chrome-he-parents-airport.md):
// a decided weekday range was not stored, "what do you need from me to proceed?"
// did not start the request, and a name+phone+insurance turn skipped the model,
// dropped the insurance question and later asked for the name again.
function chat(initial: RebuildState | null, reply: (input: string) => string) {
  let state = initial;
  const create = vi.fn(async () => 'SIM-PARENTS');
  const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async input => ({ route: 'explore', direction: 'none', fields: {}, reply: reply(input), source: 'gemini', model: 'controlled-fixture', groundedContext: true } as BotReading));
  const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_p, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
  return { send: (input: string) => getRebuiltBotReply('fictional-parents-airport', input, store), create, readTurn };
}
const draft = (history: RebuildState['history']): RebuildState => ({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupLocation: 'נתב״ג', returnLocation: 'נתב״ג', vehicleNeed: 'רכב משפחתי', driverAgeRange: '24-plus', luggage: 2, pickupDate: '2026-11-17', returnDate: '2026-11-26' }, history });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T09:10:00Z')); vi.clearAllMocks(); mocks.evaluation.mockReturnValue(undefined); });
afterEach(() => vi.useRealTimers());

describe('parents arriving at the airport', () => {
  it.each([
    ['he', 'משפחתית, יהיו גם שתי מזוודות גדולות. לאסוף ולהחזיר בנתב״ג. מה אתה צריך ממני כדי להתקדם?'],
    ['en', 'Family car, two big suitcases, pick up and return at the airport. What do you need from me to proceed?'],
  ] as const)('treats asking what is needed to proceed as starting the request, not sending it: %s', async (locale, input) => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale, booking: { pickupDate: '2026-11-17', returnDate: '2026-11-26', driverAgeRange: '24-plus' }, history: [] }, () => locale === 'he' ? 'בשמחה.' : 'Of course.');
    const result = await c.send(input);
    expect(result.state.phase).toBe('booking');
    expect(result.state.completedRequestId).toBeUndefined();
    expect(c.create).not.toHaveBeenCalled();
  });

  it('keeps a name given with a phone after the assistant asked for it, answers insurance and never asks the name again', async () => {
    const c = chat(draft([{ from: 'customer', text: 'מה אתה צריך ממני כדי להתקדם?' }, { from: 'bot', text: 'כדי להשלים את הבקשה חסרים לי רק שמך ומספר הטלפון.' }]), () => 'בשמחה.');
    const result = await c.send('נועה בדיקה, 050-0000000. במחיר כלול ביטוח או שזה בנפרד?');
    expect(result.state.booking.customerName).toBe('נועה בדיקה');
    expect(result.state.phase).toBe('booking');
    expect(result.reply).toMatch(/ביטוח חובה|כיסוי בסיסי/);
    expect(result.reply).not.toContain('050-0000000');
    expect(JSON.stringify(result.state.history.filter(entry => !entry.private))).not.toContain('נועה');
    expect(c.readTurn).not.toHaveBeenCalled();
    const next = await c.send('כן, אבל לא ענית לי על הביטוח');
    expect(next.reply).not.toMatch(/על איזה שם|מה שמך|What name/);
    expect(c.create).not.toHaveBeenCalled();
  });

  it.each(['050-0000000 בבקשה', 'כן, 050-0000000', 'אני לא בטוחה, 050-0000000'])('does not mistake a non-name leading clause for a name: %s', async input => {
    const c = chat(draft([{ from: 'bot', text: 'חסרים לי רק שמך ומספר הטלפון.' }]), () => 'בשמחה.');
    const result = await c.send(input);
    expect(result.state.booking.customerName).toBeUndefined();
  });

  it('does not start a request from a phone number when no rental draft or name prompt exists', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [{ from: 'bot', text: 'איך אפשר לעזור?' }] }, () => 'בשמחה.');
    const result = await c.send('דני כהן, 050-0000000. יש לכם סניף בחיפה?');
    expect(result.state.phase).toBe('explore');
    expect(result.state.booking.customerName).toBeUndefined();
  });

  it.each([
    'גיל 72 הוא מצוין לנהיגה — אפשר לשכור כל עוד יש רישיון בתוקף.',
    'גיל 72 הוא לגמרי בסדר; אפשר לשכור מגיל 21.',
    'Age 72 is no problem, he can rent as long as he has a valid licence.',
  ])('replaces an unconditional older-driver eligibility assurance with the approved conditional answer: %s', async modelReply => {
    const he = /[א-ת]/u.test(modelReply);
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: he ? 'he' : 'en', booking: {}, history: [] }, () => modelReply);
    const result = await c.send(he ? 'אבא שלי בן 72 והוא ינהג, זה בעיה?' : 'My father is 72 and will drive, is that a problem?');
    expect(result.reply).not.toBe(modelReply);
    expect(result.reply).toMatch(/כיסוי הביטוחי|insurance cover/);
    expect(c.create).not.toHaveBeenCalled();
  });
});

describe('weekday calendar for the wording provider', () => {
  it('lists Israel dates with their weekdays so the model need not compute them', () => {
    const days = israelCalendar('2026-11-09');
    expect(days[0]).toBe('2026-11-09 Monday יום שני (today)');
    expect(days[8]).toBe('2026-11-17 Tuesday יום שלישי');
    expect(days[17]).toBe('2026-11-26 Thursday יום חמישי');
    expect(israelCalendar('not-a-date')).toEqual([]);
  });
  it('sends the calendar alongside the date and asks for no guessed weekday dates', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'none', reply: 'בשמחה.', fields: {}, factPatches: [] }) });
    await readBotTurn('משלישי הבא עד החמישי שאחריו', { locale: 'he', phase: 'explore', recent: [], known: {}, today: '2026-11-09' });
    const body = mocks.generate.mock.calls[0][0].body;
    const payload = JSON.parse(body.contents[0].parts[0].text);
    expect(payload.calendarIsrael).toContain('2026-11-17 Tuesday יום שלישי');
    expect(JSON.stringify(body.systemInstruction ?? body)).toContain('calendarIsrael');
  });
});

// Live Chrome replay on b9908ed, 2026-11-09: dates and summary now pass, but the
// model said "אין הגבלת גיל עליונה" (not an approved fact), called the mother
// "אשתך", and the airport branch label lacked gershayim.
describe('wording checks from the b9908ed replay', () => {
  it.each([
    ['אבא שלי בן 72 והוא ינהג, זה בעיה?', 'אפשר לשכור מגיל 21 ואין הגבלת גיל עליונה, כל עוד יש רישיון בתוקף.'],
    ['אם אמא שלי תרצה לנהוג לפעמים צריך להוסיף אותה?', 'לגבי אשתך, כל נהג נוסף חייב להירשם בחוזה לפני הנהיגה.'],
  ])('falls back instead of sending: %s', async (input, modelReply) => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] }, () => modelReply);
    const result = await c.send(input);
    expect(result.reply).not.toBe(modelReply);
    expect(result.reply).not.toMatch(/אין הגבלת גיל|אשתך/);
  });
  it('keeps the model wording when the customer named that relative', async () => {
    const reply = 'אשתך יכולה לנהוג אם תירשם בחוזה כנהגת נוספת לפני הנהיגה.';
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] }, () => reply);
    expect((await c.send('אשתי תרצה לנהוג גם, צריך להוסיף אותה?')).reply).toContain('אשתך');
  });
});

// Live Chrome on 72cd92a: "כל אחד עם מזוודה בינונית" after four travellers was saved as one bag.
describe('one bag per traveller', () => {
  it.each([
    ['he', 'אנחנו 4 חברים', 'כנראה אחד. כל אחד עם מזוודה בינונית זה נכנס ברכב משפחתי רגיל?'],
    ['en', 'We are 4 friends', 'Each of us with a medium suitcase, does that fit in a family car?'],
  ] as const)('stores one bag for each known traveller and stays out of safety: %s', async (locale, first, second) => {
    const c = chat(null, () => locale === 'he' ? 'רכב משפחתי יכול להתאים, וההתאמה תלויה בדגם ובמידות הציוד.' : 'A family car may suit you; fit depends on the model and bag sizes.');
    await c.send(first);
    const result = await c.send(second);
    expect(result.state.booking.passengers).toBe(4);
    expect(result.state.booking.luggage).toBe(4);
    expect(result.source).not.toBe('safety');
  });
});

// Live Chrome on 72cd92a, mandatory garage replay: the model asked
// "האם נשריין את הרכב…?"; "כן יאללה. קוראים לי איתי בדיקה…" and then "אמרתי כן 😅"
// never started the request, and the model claimed "נעדכן את הבקשה".
describe('garage replay acceptance after a reserve-worded offer', () => {
  const ready = (lastBot: string): RebuildState => ({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { pickupDate: '2026-11-10', returnDate: '2026-11-12', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי', driverAgeRange: '24-plus' }, history: [{ from: 'bot', text: lastBot }] });
  it.each([
    'כן יאללה. קוראים לי איתי בדיקה. רק שלא תסגור לי משהו יקר בלי להגיד לי, אני רוצה קודם לדעת מה ההצעה',
    'אמרתי כן 😅',
  ])('starts the request and shows the summary without creating it: %s', async input => {
    const c = chat(ready('האם נשריין את הרכב הקומפקטי לאיסוף מחר מהרצליה ולהחזרה לשם?'), () => 'נעדכן את הבקשה.');
    const result = await c.send(input);
    expect(result.state.phase).toBe('booking');
    expect(result.reply).not.toContain('נעדכן את הבקשה');
    expect(c.create).not.toHaveBeenCalled();
  });
  it('rejects reservation wording from the model', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] }, () => 'האם נשריין את הרכב הקומפקטי לאיסוף מחר?');
    const result = await c.send('מה ההבדל בין קומפקטי למשפחתי?');
    expect(result.reply).not.toMatch(/נשריין/);
  });
});

// Live Chrome on bf710b4: on a pre-consent correction the model said
// "ההשכרה מתומחרת לפי … התעריף המקורי, בלי הפתעות" — a price promise.
describe('no price promises before the quote', () => {
  it.each([
    'לגבי המחיר, ההשכרה מתומחרת לפי ימי ההשכרה והתעריף המקורי, בלי הפתעות.',
    'It will be the same daily rate, no surprises.',
  ])('rejects the model wording: %s', async modelReply => {
    const he = /[א-ת]/u.test(modelReply);
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: he ? 'he' : 'en', booking: {}, history: [] }, () => modelReply);
    const result = await c.send(he ? 'ומה עם המחיר? אני לא רוצה הפתעות' : 'What about the price? I do not want surprises');
    expect(result.reply).not.toMatch(/בלי הפתעות|התעריף המקורי|same daily rate|no surprises/);
  });
  it('still allows saying a previous rate is not guaranteed', async () => {
    const reply = 'An extension may change the rate; the previous rate is not guaranteed.';
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] }, () => reply);
    expect((await c.send('Would an extension cost the same?')).reply).toBe(reply);
  });
});

// Live Chrome on bf710b4: "אוקיי אני מאשר" re-showed the summary; only a bare "מאשר" sent it.
describe('casual final consent', () => {
  const ready = (): RebuildState => ({ version: 2, phase: 'booking', step: 'rental_confirm', locale: 'he', requestKey: 'k', booking: { pickupDate: '2026-11-10', returnDate: '2026-11-13', pickupLocation: 'הרצליה', returnLocation: 'הרצליה', vehicleNeed: 'רכב קומפקטי', driverAgeRange: '24-plus', customerName: 'איתי בדיקה' }, history: [] });
  it.each(['אוקיי אני מאשר', 'סבבה, מאשרת 👍', 'ok I confirm', 'מאשר בבקשה'])('sends once: %s', async input => {
    const c = chat(ready(), () => 'x');
    await c.send(input);
    expect(c.create).toHaveBeenCalledTimes(1);
  });
  it.each(['אני לא מאשר', 'מאשר אבל תשנה את התאריך', 'אוקיי אבל מה המחיר?'])('does not send: %s', async input => {
    const c = chat(ready(), () => 'x');
    await c.send(input);
    expect(c.create).not.toHaveBeenCalled();
  });
});

// Live Chrome on 488bd06 (EN tourist): a German-licence question was dropped by
// the local fallback and "me and my gf" was not counted.
describe('tourist couple with a foreign licence', () => {
  it('counts two travellers and answers the licence question even on the local fallback', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: { pickupDate: '2026-11-20' }, history: [] }, () => 'Your German licence is definitely fine, no problem at all.');
    const result = await c.send("cool. its me and my gf, staying a week, fly back from tlv too. something small is fine. my licence is from germany thats ok right?");
    expect(result.state.booking.passengers).toBe(2);
    expect(result.reply).toMatch(/licen[cs]e|permit|translation/i);
    expect(result.reply).not.toMatch(/definitely fine/);
  });
  it.each(['me and my gf and her brother', 'what if it is me and my wife?', 'אני ואשתי והילד'])('does not force two travellers: %s', async input => {
    const c = chat(null, () => 'OK');
    const result = await c.send(input);
    expect(result.state.booking.passengers === 2).toBe(false);
  });
});

describe('one branch for both legs', () => {
  it.each([
    ['en', 'yeah airport both ways. how much is the deposit btw', 'Ben Gurion Airport'],
    ['en', 'Pick up and return at Herzliya please', 'Herzliya'],
    ['he', 'לאסוף ולהחזיר בנתב״ג', 'נתב״ג'],
    ['he', 'בתל אביב הלוך ושוב', 'תל אביב'],
  ] as const)('stores both locations so the model cannot claim an unsaved route: %s', async (locale, input, label) => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale, booking: { pickupDate: '2026-11-20', returnDate: '2026-11-27', vehicleNeed: locale === 'he' ? 'רכב קומפקטי' : 'compact car' }, history: [] }, () => locale === 'he' ? 'בשמחה.' : 'Sure.');
    const result = await c.send(input);
    expect(result.state.booking.pickupLocation).toBe(label);
    expect(result.state.booking.returnLocation).toBe(label);
  });
  it('keeps a hypothetical route unselected', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] }, () => 'Sure.');
    const result = await c.send('what if we do airport both ways, is that more expensive?');
    expect(result.state.booking.pickupLocation).toBeUndefined();
  });
});

describe('no claims about unsaved details', () => {
  it('rejects "pickup and return are set" when no route was recorded', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] }, () => 'Pickup and return at Ben Gurion Airport are set. The deposit is indicative.');
    const result = await c.send('how much is the deposit btw');
    expect(result.reply).not.toMatch(/are set/);
  });
  it('allows the same wording once the route really is saved', async () => {
    const reply = 'Pickup and return at Ben Gurion Airport are set.';
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: { pickupLocation: 'Ben Gurion Airport', returnLocation: 'Ben Gurion Airport' }, history: [] }, () => reply);
    expect((await c.send('ok thanks, what else do you need to know?')).reply).toContain('are set');
  });
});

// Live Chrome on 488bd06 (EN tourist): "ok sounds good lets do it. im lukas, 29"
// after "Would you like a price quote for your dates?" did not start intake.
describe('casual go-ahead with a name and age', () => {
  it('starts the request, keeps the name privately and records the 24+ group', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: { pickupDate: '2026-11-20', returnDate: '2026-11-27', vehicleNeed: 'compact car', pickupLocation: 'Ben Gurion Airport', returnLocation: 'Ben Gurion Airport', passengers: 2 }, history: [{ from: 'bot', text: 'Would you like a price quote for your dates?' }] }, () => 'Great.');
    const result = await c.send('ok sounds good lets do it. im lukas, 29');
    expect(result.state.phase).toBe('booking');
    expect(result.state.booking.customerName).toBe('lukas');
    expect(result.state.booking.driverAgeRange).toBe('24-plus');
    expect(result.reply).toMatch(/Lukas|lukas|request details|Here are/);
    expect(c.create).not.toHaveBeenCalled();
  });
  it.each(['im not sure yet', "I'm just looking", 'im staying 10 days'])('does not take a phrase as a name: %s', async input => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_dates', locale: 'en', booking: {}, history: [] }, () => 'OK');
    const result = await c.send(input);
    expect(result.state.booking.customerName).toBeUndefined();
  });
});

// Live Chrome on 2bb5906: "back in jerusalem" after "Where will you return it?" was not stored,
// so the bot asked the same question again two turns later.
describe('answering the return-place question in passing', () => {
  it.each([
    ['en', 'Where will you return it?', 'back in jerusalem. is insurance included or do we need to buy extra?', 'Jerusalem'],
    ['he', 'איפה תרצו להחזיר אותו?', 'בהרצליה. הביטוח כלול?', 'הרצליה'],
  ] as const)('stores the return location: %s', async (locale, lastBot, input, label) => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale, booking: { pickupDate: '2026-12-03', returnDate: '2026-12-13', pickupLocation: locale === 'en' ? 'Jerusalem' : 'הרצליה', passengers: 2 }, history: [{ from: 'bot', text: lastBot }] }, () => locale === 'en' ? 'Basic cover is included, subject to an excess.' : 'כיסוי בסיסי כלול בכפוף להשתתפות עצמית.');
    const result = await c.send(input);
    expect(result.state.booking.returnLocation).toBe(label);
  });
  it('does not take a branch from an unrelated question', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [{ from: 'bot', text: 'How can I help?' }] }, () => 'Sure.');
    const result = await c.send('do you have a branch in jerusalem?');
    expect(result.state.booking.returnLocation).toBeUndefined();
  });
});

describe('annoyed repeat of the return place during intake', () => {
  it('takes "jerusalem, i said that already" and moves on', async () => {
    const c = chat({ version: 2, phase: 'booking', step: 'rental_locations', locale: 'en', requestKey: 'k', booking: { passengers: 2, pickupDate: '2026-12-03', returnDate: '2026-12-13', pickupLocation: 'jerusalem', customerName: 'Sarah', driverAgeRange: '24-plus', vehicleNeed: 'compact car' }, history: [{ from: 'bot', text: 'Where will you return it?' }] }, () => 'OK');
    const result = await c.send('jerusalem, i said that already');
    expect(result.state.booking.returnLocation).toBe('Jerusalem');
    expect(result.state.booking.pickupLocation).toBe('Jerusalem');
    expect(result.reply).not.toContain('Where will you return it?');
    expect(result.reply).toMatch(/Here are your request details/);
  });
});

// Live Chrome on 3d8c3d0 after a simulated submission: "is the car reserved now? and when
// will we hear back with the price" got "What dates do you need the car?", and adding a
// child seat was answered as if the sent request could be edited.
describe('after the request was sent', () => {
  const sent = (): RebuildState => ({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, completedRequestId: 'SIM-1', completedRental: { pickupDate: '2026-12-03', returnDate: '2026-12-13', pickupLocation: 'Jerusalem', returnLocation: 'Jerusalem', vehicleNeed: 'compact car' }, history: [] });
  it('answers reserved/price questions from the receipt without restarting intake', async () => {
    const c = chat(sent(), () => 'What dates do you need the car?');
    const result = await c.send('thanks! so is the car reserved now? and when will we hear back with the price');
    expect(result.reply).toMatch(/no car was confirmed|not confirmation/);
    expect(result.reply).toMatch(/price and availability/);
    expect(result.reply).not.toMatch(/What dates/);
  });
  it('passes a post-submit addition to the team honestly, once', async () => {
    const c = chat(sent(), () => 'We can add a child seat to your request.');
    const result = await c.send('oh wait can we add a child seat? my niece might join for one day');
    expect(result.escalate).toBe(true);
    expect(result.reply).toMatch(/already been sent/);
    expect(result.reply).not.toMatch(/We can add a child seat to your request/);
    expect(c.create).not.toHaveBeenCalled();
  });
  it('does not treat a hypothetical as a change', async () => {
    const c = chat(sent(), () => 'Child seats depend on availability.');
    const result = await c.send('what if we add a child seat later, is that possible?');
    expect(result.escalate).toBeFalsy();
  });
});

// Live Chrome on 494402f (young driver, Eilat): "תאריכים 23 עד 26 לחודש" was not stored and
// "יאללה תכין בקשה. עומר בדיקה" lost the name; intake then asked for the date again.
describe('day-only dates and a trailing name', () => {
  it('stores 23–26 of this month and the name, then shows the summary', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: { driverAgeRange: '21-23', passengers: 4, luggage: 4 }, history: [] }, () => 'בשמחה.');
    const dates = await c.send('מתל אביב ולהחזיר שם. משהו שייכנסו 4 תיקים. תאריכים 23 עד 26 לחודש');
    expect(dates.state.booking).toMatchObject({ pickupDate: '2026-11-23', returnDate: '2026-11-26' });
    const start = await c.send('יאללה תכין בקשה. עומר בדיקה');
    expect(start.state.booking.customerName).toBe('עומר בדיקה');
    expect(start.reply).not.toMatch(/באיזה תאריך/);
  });
  it('rolls a passed day into next month and ignores hypotheticals', async () => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: {}, history: [] }, () => 'Sure.');
    const r = await c.send('dates 3 to 6 of the month');
    expect(r.state.booking).toMatchObject({ pickupDate: '2026-12-03', returnDate: '2026-12-06' });
    const h = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] }, () => 'בשמחה.');
    expect((await h.send('אם ניקח 23 עד 26 לחודש כמה זה?')).state.booking.pickupDate).toBeUndefined();
  });
  it.each(['יאללה תכין בקשה. תודה רבה', 'יאללה תכין בקשה. רכב גדול'])('does not take a courtesy or need as a name: %s', async input => {
    const c = chat({ version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] }, () => 'בשמחה.');
    expect((await c.send(input)).state.booking.customerName).toBeUndefined();
  });
});
