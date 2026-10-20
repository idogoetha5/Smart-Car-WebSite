import { describe, expect, it } from 'vitest';
import { bookingQuestion, detectSituation, humanLine, variety } from '@/lib/whatsapp-replies';
import { getWhatsAppFlowReply, type FlowState } from '@/lib/whatsapp-flow';

describe('human reply library', () => {
  it('recognises everyday messages', () => {
    expect(detectSituation('מה קורה?')).toBe('how_are_you');
    expect(detectSituation('תודה אחי')).toBe('thanks');
    expect(detectSituation('חחח')).toBe('laugh');
    expect(detectSituation('אתם הכי יקרים בארץ')).toBe('price_objection');
    expect(detectSituation('אני אחשוב על זה')).toBe('thinking');
    expect(detectSituation('מה מזג האוויר מחר?')).toBe('off_topic');
    expect(detectSituation('thanks man')).toBe('thanks');
    expect(detectSituation('אני צריך רכב מחר')).toBeNull();
  });

  it('never repeats a line within a conversation', () => {
    const used: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const line = humanLine('thanks', 'he', `p:${i}`, used);
      expect(used).not.toContain(line);
      used.push(line);
    }
  });

  it('asks a booking question in a new wording each time', () => {
    const used: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const q = bookingQuestion('pickup_date', 'he', `p:${i}`, used);
      expect(used).not.toContain(q);
      used.push(q);
    }
  });

  it('has over a thousand distinct lines and tens of thousands with a booking question', () => {
    expect(variety().lines).toBeGreaterThan(1000);
    expect(variety().withQuestion).toBeGreaterThan(30000);
  });

  it('keeps a long small-talk chat human without Gemini: no menu again, no repeated message', async () => {
    let state: FlowState | null = null;
    const store = { activeBooking: async () => null, loadState: async () => state, saveState: async (_p: string, v: FlowState | null) => { state = v; }, createRentalRequest: async () => null };
    const replies: string[] = [];
    for (const message of ['היי', 'מה קורה?', 'הכל טוב', 'חחח', 'תודה', 'מה מזג האוויר?', 'סבבה', 'תודה אחי', 'ביי']) {
      replies.push((await getWhatsAppFlowReply('972500000000', message, store)).reply ?? '');
    }
    expect(replies.slice(1).some((reply) => reply.includes('1️⃣'))).toBe(false);
    expect(new Set(replies).size).toBe(replies.length);
  });
});
