import { describe, expect, it } from 'vitest';
import bank from '../../../scripts/whatsapp-eval/questions.json';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

type Question = { topic: string; text: string; expect: { escalate?: boolean; step?: string } };

/**
 * Runs the whole question bank (scripts/whatsapp-eval) through the flow with
 * Gemini switched off. Even without the model, the bot must never hand an
 * ordinary question to a person, must hand off every emergency and explicit
 * request for one, and must start a rental when asked.
 */
describe('WhatsApp question bank, without Gemini', () => {
  it('routes every question in the bank correctly', async () => {
    const failures: string[] = [];
    for (const question of bank as Question[]) {
      let state: FlowState | null = null;
      const store: WhatsAppFlowStore = {
        isSimulation: true,
        activeBooking: async () => null,
        loadState: async () => state,
        saveState: async (_phone, next) => { state = next; },
        createRentalRequest: async () => null,
        interpretMessage: async () => null,
      };
      const result = await getWhatsAppFlowReply('simulation', question.text, store);
      const step = (state as FlowState | null)?.step;
      if (question.expect.escalate !== undefined && Boolean(result.escalate) !== question.expect.escalate) failures.push(`${question.text} → escalate ${Boolean(result.escalate)}`);
      if (question.expect.step && step !== question.expect.step) failures.push(`${question.text} → step ${step}`);
      if (/לא הצלחתי לזהות|לא זיהיתי/.test(result.reply ?? '')) failures.push(`${question.text} → not understood`);
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
