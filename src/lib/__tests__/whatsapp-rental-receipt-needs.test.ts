import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

const scenarios = [
  { locale: 'en' as const, start: 'I would like to rent a family car from Herzliya on 9 December 2026 and return it in Tel Aviv on 13 December 2026. I am 36, travelling with my partner and our child, with one suitcase.', name: 'My name is Avery Demo. No email please.', add: 'We would like one child seat for our three-year-old.', remove: 'Actually we do not need a child seat, we are bringing our own. Please remove it from the request.', confirm: 'I confirm', recall: 'So is the car already confirmed? Remind me which return city and date you kept, and did you keep a requested child seat?', needsRecall: 'Remind me how many passengers and bags you kept.', seatRecall: 'Did you keep a requested child seat?', noSeat: 'No child seat is requested', unknownSeat: 'No child-seat request detail was recorded', positiveSeat: 'Requested child seats: 1', passenger: 'Passengers: 3', bag: 'Bags: 1', location: 'Tel Aviv', unconfirmed: 'no car was confirmed' },
  { locale: 'he' as const, start: 'אני רוצה לשכור רכב משפחתי מ-9/12 עד 13/12, איסוף מהרצליה והחזרה בתל אביב. אני בן 36, נוסע עם בת הזוג שלי והילד שלנו, עם מזוודה אחת.', name: 'השם הוא אורי בדיקה. בלי מייל.', add: 'נרצה כיסא בטיחות אחד לילד בן שלוש.', remove: 'בעצם לא צריך כיסא בטיחות, אנחנו מביאים משלנו. תסירו את הכיסא מהבקשה.', confirm: 'אני מאשר', recall: 'אז הרכב כבר מאושר? תזכיר לי איזה תאריך ועיר החזרה שמרת והאם שמרת בקשת כיסא בטיחות?', needsRecall: 'תזכיר לי כמה נוסעים ומזוודות רשמת.', seatRecall: 'האם שמרת בקשה לכיסא בטיחות?', noSeat: 'לא נכללה בקשה לכיסא בטיחות', unknownSeat: 'לא נרשם פרט לגבי בקשת כיסא בטיחות', positiveSeat: 'בקשת כיסאות בטיחות: 1', passenger: 'נוסעים: 3', bag: 'מזוודות: 1', location: 'תל אביב', unconfirmed: 'לא אושר רכב' },
];

function conversation() {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'SIM-RECEIPT');
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: create, readTurn: async () => null,
  };
  return { send: (input: string) => getRebuiltBotReply('fictional-receipt-needs', input, store), create };
}

for (const scenario of scenarios) {
  describe(`completed rental needs receipt in ${scenario.locale}`, () => {
    it('recalls removed seat plus route, status, passengers and bags after submission', async () => {
      const chat = conversation();
      for (const input of [scenario.start, scenario.name, scenario.add, scenario.remove, scenario.confirm]) await chat.send(input);
      const result = await chat.send(scenario.recall);
      expect(result.reply).toContain(scenario.unconfirmed);
      expect(result.reply).toContain(scenario.location);
      expect(result.reply).toContain('13/12/2026');
      expect(result.reply).toContain(scenario.noSeat);
      expect(result.reply).toContain(scenario.passenger);
      expect(result.reply).toContain(scenario.bag);
      expect(result.state.completedRental?.childSeats).toBe(0);
      expect(result.state.booking).toEqual({});
      expect(chat.create).toHaveBeenCalledTimes(1);
      const needs = await chat.send(scenario.needsRecall);
      expect(needs.reply).toContain(scenario.passenger);
      expect(needs.reply).toContain(scenario.bag);
      expect(chat.create).toHaveBeenCalledTimes(1);
    });

    it('keeps a positive seat count conditional rather than confirming availability', async () => {
      const chat = conversation();
      for (const input of [scenario.start, scenario.name, scenario.add, scenario.confirm]) await chat.send(input);
      const result = await chat.send(scenario.seatRecall);
      expect(result.reply).toContain(scenario.positiveSeat);
      expect(result.reply).toMatch(/subject to availability|בכפוף לזמינות/u);
      expect(result.state.completedRental?.childSeats).toBe(1);
      expect(chat.create).toHaveBeenCalledTimes(1);
    });

    it('does not infer a refused or zero seat count when no seat detail was supplied', async () => {
      const chat = conversation();
      for (const input of [scenario.start, scenario.name, scenario.confirm]) await chat.send(input);
      const result = await chat.send(scenario.seatRecall);
      expect(result.reply).toContain(scenario.unknownSeat);
      expect(result.reply).not.toContain(scenario.noSeat);
      expect(result.state.completedRental?.childSeats).toBeUndefined();
      expect(chat.create).toHaveBeenCalledTimes(1);
    });
  });
}
