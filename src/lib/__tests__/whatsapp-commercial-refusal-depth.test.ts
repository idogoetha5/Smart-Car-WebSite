import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
  };
  return (message: string) => getRebuiltBotReply('fictional', message, store);
}

describe('commercial questions alongside a representative refusal', () => {
  it('answers the Hebrew family comparison and viewing question while respecting refusal', async () => {
    const send = conversation();
    await send('אני רוצה לקנות רכב, תקציב 70000');
    const comparison = await send('בלי נציג כרגע, רוצה להבין איתך. אנחנו זוג ושני ילדים, רוב השבוע אני נוסע לבד. קטן או משפחתי עדיף?');
    expect(comparison.reply).toMatch(/קומפקטי/);
    expect(comparison.reply).toMatch(/משפחתית/);
    expect(comparison.reply).not.toMatch(/שאעביר|שנציג/);
    expect(comparison.escalate).toBe(false);
    const repeated = await send('אני שואל על ההבדל: רכב קטן מול משפחתי למשפחה של ארבעה.');
    expect(repeated.reply).toMatch(/המושבים|נוסעים/);
    const viewing = await send('אפשר לראות רכב לפני שאני מחליט? אין לי דגם כרגע.');
    expect(viewing.reply).toContain('צפייה');
    expect(viewing.reply).not.toContain('תרצה שנציג');
    expect(viewing.escalate).toBe(false);
  });

  it('answers English inclusions and keeps later updates advisory until an explicit request', async () => {
    const send = conversation();
    await send('I want leasing for two years, 15000 km annually, compact car.');
    const inclusions = await send('No representative yet please. What is included in the monthly payment?');
    expect(inclusions.reply).toMatch(/included depends|payment|cover|services/i);
    expect(inclusions.reply).not.toMatch(/Would you like.*representative/i);
    expect(inclusions.escalate).toBe(false);
    const update = await send('Thanks. Keep the term three years, not two years.');
    expect(update.reply).not.toMatch(/Would you like.*representative/i);
    expect(update.escalate).toBe(false);
    const explicit = await send('Please pass the details to a representative.');
    expect(explicit.escalate).toBe(true);
  });
});
