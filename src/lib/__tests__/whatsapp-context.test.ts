import { appendFileSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

const cases = JSON.parse(readFileSync(process.env.CONTEXT_CASES ?? new URL('../../../scripts/whatsapp-eval/lexicon/brain/context-cases.json', import.meta.url), 'utf8')) as { cases: Case[] };

type Case = { pre?: string[]; m: string; esc?: boolean; rental?: boolean; reply?: string; notReply?: string; field?: Record<string, string> };

function isoInDays(days: number) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  today.setDate(today.getDate() + days);
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Trigger words in the wrong context ("לא צריך נציג", "מה קורה אם יש תאונה?",
 * "אחי עשה תאונה ועכשיו צריך רכב"): without Gemini the bot must still read
 * the whole sentence, not jump on one word.
 */
describe('reads the context around trigger words', () => {
  it.each((cases.cases as Case[]).map((c) => [c.m, c] as const))('%s', async (_name, c) => {
    let state: FlowState | null = null;
    const store: WhatsAppFlowStore = {
      activeBooking: async () => null,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = next; },
      createRentalRequest: async () => null,
    };
    for (const message of c.pre ?? []) await getWhatsAppFlowReply('972500000777', message, store);
    const result = await getWhatsAppFlowReply('972500000777', c.m, store);
    const final = state as FlowState | null;
    const problems: string[] = [];
    if (c.esc !== undefined && Boolean(result.escalate) !== c.esc) problems.push(`escalate ${Boolean(result.escalate)}`);
    if (c.rental !== undefined && /^rental_/.test(final?.step ?? '') !== c.rental) problems.push(`step ${final?.step}`);
    if (c.reply && !new RegExp(c.reply).test(result.reply ?? '')) problems.push('reply lacks the answer');
    if (c.notReply && new RegExp(c.notReply).test(result.reply ?? '')) problems.push('reply took the wrong meaning');
    for (const [field, value] of Object.entries(c.field ?? {})) {
      const want = /^\+\d+$/.test(value) ? isoInDays(Number(value.slice(1))) : value;
      if ((final as Record<string, unknown> | null)?.[field] !== want) problems.push(`${field}=${String((final as Record<string, unknown> | null)?.[field])}`);
    }
    if (process.env.CONTEXT_LOG) appendFileSync(process.env.CONTEXT_LOG, `${problems.length ? 'XX' : 'OK'} ${c.m} | ${problems.join(', ')} | ${(result.reply ?? '').replace(/\n+/g, ' ⏎ ').slice(0, 140)}\n`);
    expect(problems).toEqual([]);
  });
});
