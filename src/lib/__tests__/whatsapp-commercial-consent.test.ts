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

describe('commercial advice before handoff', () => {
  it('continues leasing quote questions and indecision until explicit handoff consent', async () => {
    const send = conversation();
    await send('I am interested in leasing for two years.');
    const quote = await send('Can I get a quote?');
    expect(quote.escalate).toBe(false);
    expect(quote.reply).toMatch(/kilometres/i);
    const revised = await send('Actually three years and 15000 km per year. No preference for the car.');
    expect(revised.escalate).toBe(false);
    expect(revised.state.handedOff).not.toBe(true);
    expect(revised.reply).toMatch(/what matters|mainly urban/i);
    const handoff = await send('Please connect me to a representative.');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.history.some(entry => entry.text.includes('three years'))).toBe(true);
  });

  it('keeps a purchase quote and budget correction conversational', async () => {
    const send = conversation();
    await send('אני רוצה לקנות רכב קטן');
    const quote = await send('אפשר לקבל הצעה?');
    expect(quote.escalate).toBe(false);
    expect(quote.reply).toContain('השימוש העיקרי');
    const revised = await send('בעיקר בעיר, תקציב 70000, בעצם אולי משפחתי במקום קטן');
    expect(revised.escalate).toBe(false);
    expect(revised.state.handedOff).not.toBe(true);
    const handoff = await send('תעבירו את הפנייה לנציג');
    expect(handoff.escalate).toBe(true);
    expect(handoff.state.history.some(entry => entry.text.includes('70000'))).toBe(true);
  });

  it('does not interpret no preference as acceptance of an actual handoff invitation', async () => {
    const send = conversation();
    await send('מחפש ליסינג לשנתיים, 15000 קמ בשנה, רכב קטן');
    const undecided = await send('אין לי העדפה');
    expect(undecided.escalate).toBe(false);
    expect(undecided.state.handedOff).not.toBe(true);
  });

  it('accepts a clear yes after an actual representative follow-up offer', async () => {
    const send = conversation();
    const offer = await send('מחפש ליסינג לשנתיים, 15000 קמ בשנה, רכב קטן');
    expect(offer.reply).toContain('נציג');
    const accepted = await send('כן, תתקדמו');
    expect(accepted.escalate).toBe(true);
  });
});
