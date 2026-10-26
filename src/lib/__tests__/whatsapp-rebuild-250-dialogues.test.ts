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

function conversation(index: number) {
  let state: RebuildState | null = null;
  let requests = 0;
  const turns: Array<{ message: string; result: RebuildResult }> = [];
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => { requests += 1; return `SIM-${index}`; },
    readTurn: async () => index % 2 === 0 ? null : modelReading,
  };
  const send = async (message: string) => {
    const result = await getRebuiltBotReply(`scenario-${index}`, message, store);
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
