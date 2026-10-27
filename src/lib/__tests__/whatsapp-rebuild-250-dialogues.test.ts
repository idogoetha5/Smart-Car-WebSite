import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildResult, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import type { BotReading } from '@/lib/whatsapp-rebuild-gemini';

const modelReading: BotReading = {
  route: 'explore', direction: 'suv',
  reply: 'רכב פנאי יכול להתאים. לאילו תאריכים תצטרכו את הרכב?',
  fields: {}, source: 'gemini', model: 'scenario-model',
};

function futureRange(index: number): string {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 60 + index);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  const format = (date: Date) => `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  return `${format(start)}-${format(end)}`;
}

function conversation(index: number, readingOverride?: BotReading) {
  let state: RebuildState | null = null;
  let requests = 0;
  const turns: Array<{ message: string; result: RebuildResult }> = [];
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => { requests += 1; return `SIM-${index}`; },
    readTurn: async () => readingOverride ?? (index % 2 === 0 ? null : modelReading),
  };
  const send = async (message: string) => {
    const result = await getRebuiltBotReply(`scenario-${index}`, message, store);
    if (turns.length > 0 && !/^(?:שלום|היי|Hi)$/i.test(message)) expect(result.reply).not.toBe(turns.at(-1)?.result.reply);
    turns.push({ message, result });
    expect(result.reply.trim()).not.toBe('');
    expect(result.reply).not.toMatch(/אין לי גישה|תהליך פנימי|המחיר באתר|I don't have access/i);
    return result;
  };
  return { send, state: () => state, requests: () => requests, turns };
}

async function completeRental(chat: ReturnType<typeof conversation>, english: boolean, index: number) {
  const locations = [
    { he: 'איסוף מהרצליה והחזרה בתל אביב', en: 'Pickup in Herzliya and return in Tel Aviv', returnHe: 'תל אביב', returnEn: 'Tel Aviv' },
    { he: 'איסוף מתל אביב והחזרה בהרצליה', en: 'Pickup in Tel Aviv and return in Herzliya', returnHe: 'הרצליה', returnEn: 'Herzliya' },
    { he: 'איסוף מהרצליה והחזרה בנתבג', en: 'Pickup in Herzliya and return at Ben Gurion Airport', returnHe: 'נתבג', returnEn: 'Ben Gurion Airport' },
  ];
  const location = locations[index % locations.length];
  const age = index % 3 === 0 ? '21–23' : '24+';
  for (let turn = 0; turn < 10 && chat.state()?.step !== 'rental_confirm'; turn += 1) {
    const state = chat.state();
    expect(state?.phase).toBe('booking');
    const draft = state!.booking;
    if (!draft.pickupDate || !draft.returnDate) await chat.send(futureRange(index));
    else if (!draft.pickupLocation || !draft.returnLocation) await chat.send(english ? location.en : location.he);
    else if (!draft.vehicleNeed) await chat.send(english ? 'A small car' : 'רכב קטן');
    else if (!draft.driverAgeRange) await chat.send(age);
    else if (!draft.customerName) await chat.send(english ? 'Noa Cohen' : 'נועה כהן');
    else if (!draft.customerEmail) await chat.send('noa@example.invalid');
  }
  expect(chat.state()?.step).toBe('rental_confirm');
  const summary = chat.turns.at(-1)!.result.reply;
  expect(summary).toContain(english ? `Driver age: ${age}` : `גיל הנהג: ${age}`);
  expect(summary).toContain(english ? `Return: ${location.returnEn}` : `החזרה: ${location.returnHe}`);
  const completed = await chat.send(english ? 'I confirm' : 'אני מאשרת');
  expect(completed.escalate).toBe(true);
  expect(chat.requests()).toBe(1);
  expect(completed.state.completedRequestId).toMatch(/^SIM-/);
}

describe('250 complete SmartCar customer dialogues', () => {
  const rentalOpenings = [
    'אני רוצה לשכור רכב קטן', 'אני צריך רכב קטן להשכרה', 'רוצה לשכור רכב משפחתי',
    'אני רוצה לשכור רכב פנאי', 'I need a rental car for five people and three bags',
  ];
  for (let index = 0; index < 50; index += 1) {
    it(`rental request ${index + 1}/50`, async () => {
      const chat = conversation(index);
      await chat.send(index % 5 === 4 ? 'Hi' : 'שלום');
      const opening = await chat.send(rentalOpenings[index % rentalOpenings.length]);
      expect(opening.state.phase).toBe('booking');
      await completeRental(chat, opening.state.locale === 'en', index);
      expect(chat.turns.length).toBeGreaterThanOrEqual(6);
    });
  }

  const adviceOpenings = [
    'אנחנו חמישה עם שלוש מזוודות, איזה רכב יתאים?',
    'איזה רכב כדאי לטיול משפחתי בצפון?',
    'מה מתאים לנסיעות בעיר עם הרבה עצירות?',
    'אני צריך 7 מקומות ו-4 מזוודות',
    'יש איתנו שני ילדים וכיסא בטיחות, מה כדאי?',
  ];
  for (let index = 0; index < 50; index += 1) {
    it(`consultation into rental ${index + 1}/50`, async () => {
      const chat = conversation(index + 50);
      await chat.send('היי מה נשמע?');
      const advice = await chat.send(adviceOpenings[index % adviceOpenings.length]);
      expect(advice.state.phase).toBe('explore');
      const started = await chat.send('אני רוצה לשכור רכב מתאים');
      expect(started.state.phase).toBe('booking');
      await completeRental(chat, false, index + 50);
      expect(chat.turns.length).toBeGreaterThanOrEqual(7);
    });
  }

  const leasingOpenings = [
    'מחפש ליסינג פרטי לשנתיים, 20 אלף קמ בשנה, רכב קטן',
    'רוצה ליסינג עסקי לשלוש שנים עם רכב משפחתי',
    'אני צריך הצעת ליסינג פרטי לרכב פנאי',
    'יש לכם ליסינג לרכב קומפקטי לשנה?',
    'מחפש ליסינג עסקי עם 25 אלף קמ בשנה',
  ];
  for (let index = 0; index < 50; index += 1) {
    it(`leasing enquiry ${index + 1}/50`, async () => {
      const chat = conversation(index + 100);
      await chat.send('שלום');
      await chat.send(leasingOpenings[index % leasingOpenings.length]);
      const price = await chat.send('כמה זה עולה בחודש?');
      expect(price.reply).toMatch(/תשלום|הצעה|מחיר/);
      const handoff = await chat.send('כן, תתקדמו');
      expect(handoff.escalate).toBe(true);
      expect(handoff.state.handoffKind).toBe('commercial');
      expect(handoff.reply).toContain('נציג SmartCar');
      const after = await chat.send('מתי חוזרים אליי?');
      expect(after.reply).toContain('בהקדם');
      expect(chat.turns.length).toBe(5);
    });
  }

  const saleOpenings = [
    'אני רוצה לקנות רכב משפחתי עד 80 אלף שקל',
    'מחפש רכב קומפקטי לקנייה בתקציב 60 אלף',
    'יש לכם רכבי פנאי למכירה?',
    'אני רוצה רכב משומש לקנייה',
    'רוצה לקנות רכב משפחתי בתקציב 90 אלף',
  ];
  for (let index = 0; index < 50; index += 1) {
    it(`sale enquiry ${index + 1}/50`, async () => {
      const chat = conversation(index + 150);
      await chat.send('שלום');
      await chat.send(saleOpenings[index % saleOpenings.length]);
      if (index % 5 === 2 || index % 5 === 3) await chat.send('רכב משפחתי בתקציב 70 אלף שקל');
      await chat.send('מה יש לכם?');
      const handoff = await chat.send(index % 4 === 0 ? 'כן תודה' : 'כן, תתקדמו');
      expect(handoff.escalate).toBe(true);
      expect(handoff.state.handoffKind).toBe('commercial');
      expect(handoff.reply).toContain('נציג SmartCar');
      const after = await chat.send('מתי חוזרים אליי?');
      expect(after.reply).toContain('בהקדם');
      expect(chat.turns.length).toBeGreaterThanOrEqual(5);
    });
  }

  const serviceOpenings = [
    'אני רוצה לבטל את ההזמנה שלי',
    'יש לי הזמנה קיימת ואני צריך לשנות את יום ההחזרה',
    'חויבתי פעמיים על ההשכרה',
    'הרכב ששכרתי מלוכלך',
    'המזגן ברכב השכור לא עובד',
  ];
  const accidentOpenings = [
    'נתקעתי עם הרכב, הוא לא מניע', 'קרה לי פנצ׳ר בכביש',
    'הייתה לי תאונה עם הרכב השכור', 'יש עשן מהרכב',
    'יש רעש בבלמים ואני על הכביש',
  ];
  for (let index = 0; index < 50; index += 1) {
    it(`service or accident ${index + 1}/50`, async () => {
      const chat = conversation(index + 200);
      await chat.send('שלום');
      if (index < 25) {
        const issue = await chat.send(serviceOpenings[index % serviceOpenings.length]);
        if (index % serviceOpenings.length === 0) {
          expect(issue.reply).toContain('מספר ההזמנה');
          const reference = await chat.send('מספר הזמנה 123456');
          expect(reference.escalate).toBe(true);
        } else expect(issue.escalate).toBe(true);
        const followup = await chat.send('מתי חוזרים אליי?');
        expect(followup.reply).toContain('בהקדם');
      } else {
        const incident = await chat.send(accidentOpenings[index % accidentOpenings.length]);
        expect(incident.source).toBe('safety');
        expect(incident.escalate).toBe(true);
        expect(incident.reply).toMatch(/בטוח|סכנה|חירום/);
        const tow = await chat.send('צריך גרר');
        expect(tow.reply).toContain('09-9509757');
        expect(tow.escalate).toBe(false);
        await chat.send('אני במקום בטוח');
      }
      await chat.send('תודה');
      expect(chat.turns.length).toBeGreaterThanOrEqual(4);
    });
  }
});

describe('owner-reported consultation regression', () => {
  for (const route of [0, 1]) {
    it(`answers a solo traveller and advances the full request (${route === 0 ? 'local' : 'model reading'})`, async () => {
      const chat = conversation(300 + route);
      await chat.send('היי');
      const recommendation = await chat.send('מה אתה ממליץ לאדם אחד לשבוע');
      expect(recommendation.reply).toMatch(/קומפקט|קטן/);
      const dates = await chat.send(futureRange(route));
      expect(dates.state.booking.pickupDate).toBeTruthy();
      expect(dates.state.booking.returnDate).toBeTruthy();
      const places = await chat.send('תל אביב גם להחזיר גם לאסוף');
      expect(places.state.booking.pickupLocation).toBe('תל אביב');
      expect(places.state.booking.returnLocation).toBe('תל אביב');
      expect(places.reply).not.toMatch(/באיזה תאריך|מאיפה.*לאסוף|איפה.*להחזיר/);
      const challenge = await chat.send('מה אתה ממליץ לאדם אחד');
      expect(challenge.reply).toMatch(/קומפקט|קטן/);
      expect(challenge.reply).not.toMatch(/איזה סוג רכב תרצו|כמה נוסעים וציוד/);
      const uncertain = await chat.send('לא יודע');
      expect(uncertain.reply).not.toBe(challenge.reply);
    });
  }

  it('keeps the exact screenshot facts in advice and completes only after a clear request', async () => {
    const chat = conversation(302);
    await chat.send('היי');
    const secondGreeting = await chat.send('היי');
    expect(secondGreeting.reply).toContain('היי שוב');
    await chat.send('נעים מאוד');
    const recommendation = await chat.send('מה אתה ממליץ לאדם אחד לשבוע');
    expect(recommendation.reply).toContain('קומפקטי');
    const dates = await chat.send('25/11-16/1');
    expect(dates.state.phase).toBe('explore');
    expect(dates.state.booking.pickupDate).toMatch(/-11-25$/);
    expect(dates.state.booking.returnDate).toMatch(/-01-16$/);
    const locations = await chat.send('תל אביב גם להחזיר גם לאסוף');
    expect(locations.state.phase).toBe('explore');
    expect(locations.state.booking.pickupLocation).toBe('תל אביב');
    expect(locations.state.booking.returnLocation).toBe('תל אביב');
    const followup = await chat.send('מה אתה ממליץ לאדם אחד');
    expect(followup.reply).toContain('קומפקטי');
    const uncertain = await chat.send('לא יודע');
    expect(uncertain.reply).not.toContain('איזה סוג רכב תרצו');
    const clarification = await chat.send('אתה סוגר לי רכב?');
    expect(clarification.reply).toContain('הרכב והמחיר יאושרו');
    expect(chat.state()?.phase).toBe('explore');
    const start = await chat.send('כן');
    expect(start.state.phase).toBe('booking');
    expect(start.state.step).toBe('rental_age');
    await chat.send('24+');
    await chat.send('נועה כהן');
    const summary = await chat.send('noa@example.invalid');
    expect(summary.state.step).toBe('rental_confirm');
    expect(summary.reply).toContain('איסוף: תל אביב');
    expect(summary.reply).toContain('החזרה: תל אביב');
    const completed = await chat.send('אני מאשרת');
    expect(completed.escalate).toBe(true);
    expect(chat.requests()).toBe(1);
  });
});

describe('regressions found in 15 live Gemini conversations', () => {
  it.each([
    'בטח, איסוף והחזרה בתל אביב. מהו יעד האיסוף המועדף עליך?',
    'נרשם איסוף והחזרה מתל אביב. באיזה סניף בתל אביב תרצה לאסוף את הרכב?',
    'איסוף מהרצליה והחזרה בתל אביב. באיזו עיר תרצו שנחפש את נקודת האיסוף?',
  ])('does not accept a model question for an already supplied pickup: %s', async modelReply => {
    const chat = conversation(400, { ...modelReading, reply: modelReply });
    await chat.send('מה אתה ממליץ לאדם אחד לשבוע');
    await chat.send(futureRange(1));
    const place = await chat.send('תל אביב גם להחזיר גם לאסוף');
    expect(place.state.booking.pickupLocation).toBe('תל אביב');
    expect(place.reply).not.toMatch(/מהו יעד האיסוף|מאיפה.*לאסוף|באיזה סניף.*לאסוף|באיזו עיר.*נקודת האיסוף/);
  });

  it('answers known family luggage without asking for the counts again', async () => {
    const chat = conversation(401);
    await chat.send('אנחנו חמישה עם שלוש מזוודות, שני ילדים, מה מתאים?');
    const fit = await chat.send('זה באמת יספיק למזוודות?');
    expect(fit.reply).toContain('5 נוסעים ו־3 מזוודות');
    expect(fit.reply).not.toContain('כמה נוסעים ומזוודות');
  });

  it('answers a compact-car advice question instead of returning to dates', async () => {
    const chat = conversation(402);
    await chat.send('נוסע אחד לעבודה בעיר. איזה רכב כדאי?');
    const advice = await chat.send('מה חשוב לבדוק ברכב קטן?');
    expect(advice.reply).toMatch(/נוחות ישיבה|גיר/);
  });

  it('keeps car advice specific when Gemini classifies it as policy', async () => {
    const chat = conversation(412, { ...modelReading, route: 'policy' });
    await chat.send('נוסע אחד לעבודה בעיר. איזה רכב כדאי?');
    const advice = await chat.send('מה חשוב לבדוק ברכב קטן?');
    expect(advice.reply).toMatch(/נוחות ישיבה|גיר/);
    expect(advice.reply).not.toContain('מה בדיוק חשוב לך לברר');
  });

  it('does not treat a vehicle correction as a pickup city', async () => {
    const chat = conversation(403);
    await chat.send('רוצה לשכור רכב קטן 12/12-16/12');
    const corrected = await chat.send('בעצם מעדיף רכב פנאי');
    expect(corrected.state.booking.pickupLocation).toBeUndefined();
    expect(corrected.state.booking.vehicleNeed).toBe('רכב פנאי');
    expect(corrected.reply).toContain('מאיפה');
  });

  it('answers what leasing includes and handles the switch to rental', async () => {
    const chat = conversation(404);
    await chat.send('מה ההבדל בין ליסינג פרטי להשכרה?');
    const answer = await chat.send('מה כלול בליסינג?');
    expect(answer.reply).toContain('מה שכלול בליסינג');
    const switchToRental = await chat.send('נראה לי עדיף לי לשכור לחודש');
    expect(switchToRental.state.interest).toBeUndefined();
    expect(switchToRental.reply).toContain('השכרה');
  });

  it('keeps a leasing enquiry useful before and after a representative handoff', async () => {
    const chat = conversation(413);
    await chat.send('מחפש ליסינג פרטי לשנתיים, 20 אלף קמ בשנה, רכב קטן');
    const included = await chat.send('מה כלול?');
    const repeated = await chat.send('מה כולל השירות?');
    expect(repeated.reply).not.toBe(included.reply);
    const next = await chat.send('מה צריך בשביל להתקדם?');
    expect(next.escalate).toBe(false);
    const handoff = await chat.send('כן תתקדמו עם הצעה');
    expect(handoff.escalate).toBe(true);
    const payment = await chat.send('יש תשלום ראשוני?');
    expect(payment.reply).toContain('תשלום ראשוני');
    expect(payment.reply).not.toContain('קיבלנו את הפרטים על ליסינג');
  });

  it('answers purchase process questions and waits for explicit handoff', async () => {
    const chat = conversation(414);
    await chat.send('אני רוצה לקנות רכב משפחתי עד 80 אלף שקל');
    const options = await chat.send('מה יש לכם?');
    const service = await chat.send('מה כולל השירות?');
    expect(service.reply).toContain('נסיעת מבחן');
    const availability = await chat.send('יש רכב זמין עכשיו?');
    expect(availability.reply).not.toBe(options.reply);
    const next = await chat.send('מה צריך בשביל להתקדם?');
    expect(next.escalate).toBe(false);
    const handoff = await chat.send('תעבירו לנציג שיחזור אליי');
    expect(handoff.escalate).toBe(true);
  });

  it('remembers a sale vehicle type, answers price and availability, then hands off', async () => {
    const chat = conversation(405);
    const opening = await chat.send('אני רוצה לקנות רכב פנאי');
    expect(opening.reply).toContain('תקציב');
    const price = await chat.send('מה המחיר?');
    expect(price.reply).toContain('המחיר תלוי');
    const budget = await chat.send('יש משהו עד 100 אלף?');
    expect(budget.reply).not.toContain('איזה סוג רכב תרצה');
    const options = await chat.send('מה האפשרויות?');
    expect(options.reply).not.toBe(budget.reply);
    const handoff = await chat.send('אני רוצה שיחזרו אליי');
    expect(handoff.escalate).toBe(true);
  });

  it('adds a later billing complaint to an existing service request', async () => {
    const chat = conversation(406);
    await chat.send('אני רוצה לבטל את ההזמנה שלי');
    await chat.send('מספר הזמנה 123456');
    const billing = await chat.send('בנוסף חויבתי פעמיים');
    expect(billing.reply).toContain('החיוב');
    expect(billing.reply).not.toContain('בקשת השינוי');
  });

  it('acknowledges a roadside location instead of repeating the previous safety answer', async () => {
    const chat = conversation(407);
    await chat.send('הרכב לא מניע ואני בצד הדרך');
    await chat.send('צריך גרר');
    const safe = await chat.send('אני במקום בטוח');
    const location = await chat.send('הכתובת היא תל אביב');
    expect(location.reply).toContain('המיקום');
    expect(location.reply).not.toBe(safe.reply);
  });

  it('gives concrete next steps after a rental accident', async () => {
    const chat = conversation(415);
    await chat.send('הייתה לי תאונה עם הרכב השכור');
    await chat.send('אני במקום בטוח');
    const next = await chat.send('מה הצעד הבא?');
    expect(next.reply).toContain('דווחו על התאונה בתוך שעה');
    const prepare = await chat.send('יש משהו שכדאי להכין?');
    expect(prepare.reply).toContain('מספר ההזמנה');
    expect(prepare.reply).not.toBe(next.reply);
  });

  it('keeps roadside breakdown advice separate from accident reporting', async () => {
    const chat = conversation(416);
    await chat.send('הרכב לא מניע ואני בצד הדרך');
    const next = await chat.send('מה הצעד הבא?');
    expect(next.reply).toContain('עזרה או גרר');
    expect(next.reply).not.toMatch(/תאונה|דוח תאונה/);
  });

  it('keeps a cancellation labelled correctly after handoff', async () => {
    const chat = conversation(417);
    await chat.send('אני רוצה לבטל את ההזמנה שלי');
    await chat.send('מספר הזמנה 123456');
    const next = await chat.send('מה הצעד הבא?');
    expect(next.reply).toContain('בקשת הביטול');
    expect(next.reply).not.toContain('בקשת השינוי');
    const prepare = await chat.send('יש משהו שכדאי להכין?');
    expect(prepare.reply).toContain('מספר ההזמנה שכבר מסרתם');
  });

  it('answers the additional-driver question during a rental consultation', async () => {
    const chat = conversation(408);
    await chat.send('מה אתה ממליץ לאדם אחד לשבוע?');
    const answer = await chat.send('יש אפשרות להוסיף נהג?');
    expect(answer.reply).toContain('נהג נוסף');
    expect(answer.reply).toContain('רישיון');
    expect(answer.reply).not.toContain('מה בדיוק חשוב לך לברר');
  });

  it('moves from vague rental timing to trip needs when asked for a suggestion', async () => {
    const chat = conversation(409);
    await chat.send('אני שוקל השכרה בשבוע הבא');
    const suggestion = await chat.send('מה תציעו לי?');
    expect(suggestion.reply).toMatch(/כמה אנשים ומזוודות/);
    expect(suggestion.reply).not.toContain('לאילו תאריכים');
  });

  it('answers a side question without repeating the last booking question', async () => {
    const chat = conversation(410);
    await chat.send('אני רוצה לשכור רכב משפחתי 10/12-14/12');
    await chat.send('איסוף מהרצליה והחזרה בתל אביב');
    const answer = await chat.send('יש אפשרות להוסיף נהג?');
    expect(answer.reply).toContain('נהג נוסף');
    expect(answer.reply).not.toContain('מה קבוצת הגיל');
    const age = await chat.send('24+');
    expect(age.reply).toContain('שם');
  });

  it('takes an explicit wish to continue through a complete saved family request', async () => {
    const chat = conversation(418);
    await chat.send('אנחנו ארבעה עם שתי מזוודות ומחפשים רכב לשבוע');
    const recommendation = await chat.send('איזה גודל תמליצו?');
    expect(recommendation.reply).toContain('רכב משפחתי');
    await chat.send('רוצים 11/12-18/12');
    const locations = await chat.send('איסוף בנתבג והחזרה בתל אביב');
    expect(locations.reply).not.toMatch(/כתובת בתל אביב|איזו סביבה/);
    const proceed = await chat.send('אני רוצה להתקדם');
    expect(proceed.state.phase).toBe('booking');
    expect(proceed.reply).toContain('קבוצת הגיל');
    await chat.send('24+');
    await chat.send('שני כהן');
    await chat.send('shani@example.invalid');
    const finish = await chat.send('אני מאשרת');
    expect(finish.state.completedRequestId).toBeDefined();
    expect(chat.requests()).toBe(1);
  });

  it('starts the rental request when a young driver asks to send it', async () => {
    const chat = conversation(419);
    await chat.send('אני בן 23 ורוצה לשכור רכב קטן');
    await chat.send('12/12-16/12');
    await chat.send('איסוף מתל אביב והחזרה בתל אביב');
    const proceed = await chat.send('אני רוצה לשלוח בקשה');
    expect(proceed.state.phase).toBe('booking');
    expect(proceed.state.booking.driverAgeRange).toBe('21-23');
    const repeatedAge = await chat.send('21-23');
    expect(repeatedAge.reply).toMatch(/כבר רשומה/);
    expect(repeatedAge.reply).toContain('שם');
    await chat.send('איתן לוי');
    await chat.send('eitan@example.invalid');
    const finish = await chat.send('אני מאשר');
    expect(finish.state.completedRequestId).toBeDefined();
    expect(chat.requests()).toBe(1);
  });

  it('does not promise luggage comfort without checking a specific seven-seat car', async () => {
    const chat = conversation(421, {
      ...modelReading,
      reply: 'לרכב עם 7 מקומות יהיה מספיק מרחב לכל הנוסעים והמזוודות בנוחות מירבית. באילו תאריכים?',
    });
    const answer = await chat.send('אנחנו שישה עם שלוש מזוודות');
    expect(answer.reply).not.toContain('יהיה מספיק מרחב לכל הנוסעים והמזוודות');
    expect(answer.reply).toMatch(/לבדוק|לוודא/);
    const followUp = await chat.send('צריך שבעה מקומות?');
    expect(followUp.reply).not.toBe(answer.reply);
    expect(followUp.reply).toMatch(/כן, ל־6 נוסעים/);
  });

  it('answers where pickup is possible and continues a same-place request', async () => {
    const chat = conversation(422);
    await chat.send('רוצה רכב משפחתי לתאריכים 10/12-14/12');
    const pickup = await chat.send('מאיפה אפשר לאסוף?');
    expect(pickup.reply).toContain('הרצליה');
    expect(pickup.reply).toContain('תל אביב');
    expect(pickup.reply).toContain('מאיפה תרצו לאסוף');
    await chat.send('הרצליה');
    const samePlace = await chat.send('להחזיר לאותו מקום');
    expect(samePlace.state.booking.returnLocation).toBe('הרצליה');
    const continueReply = await chat.send('אני רוצה להתקדם');
    expect(continueReply.reply).toContain('כדי להתקדם');
    expect(continueReply.reply).not.toBe(samePlace.reply);
    await chat.send('24+');
    await chat.send('ניר כהן');
    await chat.send('nir@example.invalid');
    const finish = await chat.send('אני מאשר');
    expect(finish.state.completedRequestId).toBeDefined();
  });

  it('keeps the pending pickup city through side questions in advice', async () => {
    const chat = conversation(423, {
      ...modelReading,
      reply: 'רכב משפחתי יכול להתאים. באיזה סניף תרצה לאסוף את הרכב?',
    });
    await chat.send('רוצה רכב משפחתי לתאריכים 10/12-14/12');
    const branches = await chat.send('מאיפה אפשר לאסוף?');
    expect(branches.reply).toContain('מאיפה תרצו לאסוף');
    await chat.send('מה עם ביטוח?');
    const city = await chat.send('הרצליה');
    expect(city.state.booking.pickupLocation).toBe('הרצליה');
    await chat.send('יש אפשרות להוסיף נהג?');
    const samePlace = await chat.send('להחזיר לאותו מקום');
    expect(samePlace.state.booking.returnLocation).toBe('הרצליה');
    const proceed = await chat.send('אני רוצה להתקדם');
    expect(proceed.state.phase).toBe('booking');
    expect(proceed.reply).toContain('גיל');
    await chat.send('24+');
    await chat.send('ניר כהן');
    await chat.send('nir@example.invalid');
    const finish = await chat.send('אני מאשר');
    expect(finish.state.completedRequestId).toBeDefined();
  });

  it('answers both recommendation and insurance, then finishes the family request', async () => {
    const chat = conversation(424);
    const first = await chat.send('רוצה רכב למשפחה עם ילד וכיסא בטיחות');
    expect(first.state.booking.vehicleNeed).toBe('רכב משפחתי');
    const combined = await chat.send('מה כדאי וגם מה עם הביטוח?');
    expect(combined.reply).toContain('רכב משפחתי');
    expect(combined.reply).toContain('ביטוח');
    const repeatedInsurance = await chat.send('מה עם ביטוח?');
    expect(repeatedInsurance.reply).not.toBe(combined.reply);
    await chat.send('אני רוצה לשכור');
    await chat.send('10/12-14/12');
    await chat.send('איסוף מתל אביב והחזרה בהרצליה');
    await chat.send('24+');
    await chat.send('ענבר כהן');
    await chat.send('inbar@example.invalid');
    const finish = await chat.send('אני מאשרת');
    expect(finish.state.completedRequestId).toBeDefined();
    expect(chat.requests()).toBe(1);
  });

  it('acknowledges a vehicle correction while age remains missing', async () => {
    const chat = conversation(411);
    await chat.send('אני רוצה לשכור רכב 10/12-14/12');
    await chat.send('איסוף מהרצליה והחזרה בהרצליה');
    const before = chat.turns.at(-1)!.result.reply;
    const corrected = await chat.send('רכב קטן');
    expect(corrected.reply).toContain('רשמתי');
    expect(corrected.reply).toContain('21–23');
    expect(corrected.reply).not.toBe(before);
  });
});
