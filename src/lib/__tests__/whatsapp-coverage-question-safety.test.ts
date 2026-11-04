import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, isRebuiltSafetyMessage, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const create = vi.fn(async () => 'unexpected');
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: create, readTurn: async () => null,
  };
  return { send: (input: string) => getRebuiltBotReply('fictional-coverage-question', input, store), create };
}

describe('coverage questions keep rental intake separate from actual incidents', () => {
  it.each([
    ['Hi, I would like to rent a family car from Herzliya on 9 December 2026 and return it in Tel Aviv on 12 December 2026. I am 36, travelling with my partner and our child, with one suitcase.', 'My name is Avery Demo. I prefer to keep this on WhatsApp without email.', 'One more change: please return it on 13 December 2026 in Tel Aviv. Before I confirm, does the basic cover include accident damage, and can I assume there is no excess?', /subject to an excess/i],
    ['אני רוצה לשכור רכב משפחתי מ-9/12 עד 12/12, איסוף מהרצליה והחזרה בתל אביב. אני בן 36, נוסע עם בת הזוג שלי והילד שלנו, עם מזוודה אחת.', 'השם הוא אורי בדיקה. לא רוצה למסור מייל.', 'עוד שינוי: נחזיר ב-13 בדצמבר 2026 בתל אביב. לפני שאני מאשר, האם הביטוח הבסיסי כולל נזקי תאונה והאם אין השתתפות עצמית?', /השתתפות עצמית/u],
  ])('answers cover/excess and retains the corrected request without a handoff: %s', async (opening, name, policy, answer) => {
    const chat = conversation();
    await chat.send(opening);
    await chat.send(name);
    const result = await chat.send(policy);
    expect(result.source).not.toBe('safety');
    expect(result.escalate).not.toBe(true);
    expect(result.state.handedOff).not.toBe(true);
    expect(result.state.step).toBe('rental_confirm');
    expect(result.state.booking).toMatchObject({ passengers: 3, luggage: 1, pickupDate: '2026-12-09', returnDate: '2026-12-13' });
    expect(result.reply).toMatch(answer);
    expect(result.reply).toContain('13/12/2026');
    expect(chat.create).not.toHaveBeenCalled();
  });

  it.each([
    'Does basic insurance cover accident damage?',
    'What does the cover include for a collision?',
    'האם הכיסוי כולל נזקי תאונה?',
    'מה הביטוח מכסה בתאונה?',
  ])('does not route a general coverage question to safety: %s', input => {
    expect(isRebuiltSafetyMessage(input)).toBe(false);
  });

  it.each([
    'Does insurance cover accident damage? I crashed my rental car today.',
    'I crashed my rental car and does insurance cover accident damage?',
    'Does insurance cover accident damage, my rental car was hit just now.',
    'What does insurance cover after the accident?',
    'Does insurance cover accident damage? My rental car has a flat tyre.',
    'Does insurance cover accident damage? My rental car will not start, I need a tow now.',
    'האם הביטוח כולל נזקי תאונה? עכשיו עברתי תאונה עם הרכב השכור.',
    'עברתי תאונה ברכב השכור והאם הביטוח כולל נזקי תאונה?',
    'מה הביטוח מכסה אחרי התאונה?',
    'האם הביטוח כולל נזקי תאונה? יש פנצ׳ר ברכב השכור.',
  ])('preserves current collision and breakdown safety beside coverage wording: %s', async input => {
    expect(isRebuiltSafetyMessage(input)).toBe(true);
    const result = await conversation().send(input);
    expect(result.source).toBe('safety');
    expect(result.escalate).toBe(true);
    expect(result.state.handoffKind).toBe('safety');
    expect(result.reply).toContain('09-9509757');
  });
});
