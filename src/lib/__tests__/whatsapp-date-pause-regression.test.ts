import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('Chrome undecided-date conversation', () => {
  it('answers a child-seat side question without re-requesting explicitly unknown dates', async () => {
    let state: RebuildState | null = null;
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => 'SIM',
      readTurn: async () => ({ route: 'explore', direction: 'family', reply: 'What dates do you need the car?', fields: {}, source: 'gemini', model: 'test' }),
    };
    const send = (message: string) => getRebuiltBotReply('fictional', message, store);
    await send('We are two adults with a baby and a stroller. I do not know the dates yet. Would a small car work?');
    const next = await send('That sounds reasonable, but I still do not know the dates. Can we request a child seat and leave the dates open?');
    expect(next.reply).not.toMatch(/what dates|which exact|pickup date/i);
    expect(next.reply).toMatch(/child.seat request/i);
    const later = await send('Thanks, I will come back when I know the dates.');
    expect(later.reply).not.toMatch(/what dates|which exact|pickup date/i);
  });
});
