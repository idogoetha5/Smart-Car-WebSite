import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('leasing type advice from stated use', () => {
  it.each([
    ['I am considering private leasing for two years.', 'About 15000 km a year. Mostly city driving alone, sometimes with my partner. What type would you suggest?', /compact/i, /family car/i],
    ['אני מתעניין בליסינג לשנתיים', 'בערך 15000 קמ בשנה, בעיקר נסיעות בעיר לבד או בזוג. מה תציע?', /קומפקטי/, /משפחתית/],
  ])('answers an advisory follow-up: %s', async (opening, message, compact, family) => {
    let state: RebuildState | null = null;
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
    };
    await getRebuiltBotReply('fictional', opening, store);
    const result = await getRebuiltBotReply('fictional', message, store);
    expect(result.reply).toMatch(compact);
    expect(result.reply).toMatch(family);
    expect(result.reply).not.toMatch(/What vehicle type|איזה סוג רכב תרצו/);
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
  });
});
