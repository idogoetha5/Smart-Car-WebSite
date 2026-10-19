import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildConversations, iterateBank } from '../../../scripts/whatsapp-eval/bank.mjs';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

type Expect = { escalate?: boolean; step?: string; startsRental?: boolean };
type Message = { id: string; category: string; topic?: string; source: string; base: string; text: string; variant: string; expect: Expect };
type Conversation = { id: string; turns: string[]; expect: Record<string, string> };

/**
 * The large bank (scripts/whatsapp-eval/bank.mjs) with Gemini switched off:
 * the fixed rules alone must already route every message safely. CI runs
 * 10,000 messages; WHATSAPP_BANK_FULL=1 runs all 100,000 and writes a report
 * of every failure to WHATSAPP_BANK_REPORT (default /tmp/whatsapp-bank-report.json).
 */
const FULL = process.env.WHATSAPP_BANK_FULL === '1';
const SIZE = Number(process.env.WHATSAPP_BANK_SIZE) || (FULL ? 100_000 : 10_000);

function memoryStore(rentalRequests: FlowState[] = []): { store: WhatsAppFlowStore; state: () => FlowState | null } {
  let state: FlowState | null = null;
  return {
    state: () => state,
    store: {
      activeBooking: async () => null,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = next; },
      createRentalRequest: async (_phone, request) => { rentalRequests.push(request); return 'REQ-1'; },
      getRentalQuotes: async () => [],
      getCarsForSale: async () => [],
      interpretMessage: async () => null,
    },
  };
}

function problems(message: Message, reply: string | undefined, escalated: boolean, step: string | undefined) {
  const found: string[] = [];
  if (!reply?.trim()) found.push('empty reply');
  if (/לא הצלחתי לזהות|לא זיהיתי|did not recognise/.test(reply ?? '')) found.push('said it did not understand');
  if (message.expect.escalate === true && !escalated) found.push('not handed to a person');
  if (message.expect.escalate === false && escalated) found.push('handed off for no reason');
  if (message.expect.startsRental && !step?.startsWith('rental_')) found.push(`no rental started (step ${step})`);
  return found;
}

describe('WhatsApp large question bank, without Gemini', () => {
  it(`routes ${SIZE.toLocaleString('en-US')} customer messages safely`, async () => {
    const failures: Array<Message & { problems: string[]; reply: string }> = [];
    const counts = new Map<string, number>();
    let total = 0;
    for (const message of iterateBank(SIZE) as Iterable<Message>) {
      total += 1;
      const key = `${message.category}/${message.variant}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const { store, state } = memoryStore();
      let result;
      try {
        result = await getWhatsAppFlowReply('972500000000', message.text, store);
      } catch (error) {
        failures.push({ ...message, problems: [`crashed: ${error instanceof Error ? error.message : error}`], reply: '' });
        continue;
      }
      const found = problems(message, result.reply, Boolean(result.escalate), state()?.step);
      if (found.length) failures.push({ ...message, problems: found, reply: result.reply ?? '' });
    }
    if (FULL) {
      const byGroup = Object.fromEntries([...counts].map(([key, n]) => [key, { total: n, failed: failures.filter((f) => `${f.category}/${f.variant}` === key).length }]));
      writeFileSync(process.env.WHATSAPP_BANK_REPORT ?? '/tmp/whatsapp-bank-report.json', JSON.stringify({ total, failed: failures.length, byGroup, failures: failures.slice(0, 20000) }, null, 1));
    }
    // Never: a crash, an empty reply or "I did not understand".
    const broken = failures.filter((f) => f.problems.some((p) => /crashed|empty reply|did not understand/.test(p)));
    expect(broken.slice(0, 20).map((f) => `${f.text} → ${f.problems.join(', ')}`)).toEqual([]);
    // The core messages, as customers normally write them, are routed exactly right by the fixed rules alone.
    const clean = failures.filter((f) => f.source === 'core' && (f.variant === 'clean' || f.text === f.base));
    expect(clean.slice(0, 20).map((f) => `${f.text} → ${f.problems.join(', ')}`)).toEqual([]);
    // The thousands of free phrasings in the lexicon are Gemini's job; without Gemini the fixed rules
    // must not get worse than this (ratchet: lower the limit as the rules improve).
    const core = failures.filter((f) => f.source === 'core').length / total;
    expect(core).toBeLessThan(0.01);
    expect(failures.length / total).toBeLessThan(0.14);
  }, 600_000);

  it('completes full booking conversations from first message to confirmed request', async () => {
    const conversations = buildConversations(Number(process.env.WHATSAPP_CONVERSATIONS) || (FULL ? 5000 : 400)) as Conversation[];
    const failures: string[] = [];
    for (const conversation of conversations) {
      const requests: FlowState[] = [];
      const { store, state } = memoryStore(requests);
      let last = '';
      for (const turn of conversation.turns) {
        const result = await getWhatsAppFlowReply('972500000000', turn, store);
        last = result.reply ?? '';
        if (/לא הצלחתי לזהות|לא זיהיתי|did not recognise/.test(last)) failures.push(`${conversation.id}: "${turn}" → not understood`);
      }
      const request = requests[0] as unknown as Record<string, unknown> | undefined;
      const wrong = request
        ? Object.entries(conversation.expect).filter(([key, value]) => String(request[key] ?? '').replace(/["״]/g, '') !== String(value).replace(/["״]/g, ''))
        : [['request', 'not created']];
      if (!request?.pickupDate || !request?.dropoffDate) wrong.push(['dates', 'missing']);
      if (requests.length > 1) wrong.push(['requests', String(requests.length)]);
      if (wrong.length) failures.push(`${conversation.turns.join(' | ')} → ${wrong.map(([k]) => `${k}=${request?.[k as string] ?? '∅'}`).join(', ')} (step ${state()?.step}; last: ${last.slice(0, 60)})`);
    }
    if (FULL) writeFileSync('/tmp/whatsapp-conversation-report.txt', `${failures.length}/${conversations.length}\n${failures.join('\n')}`);
    expect(failures.slice(0, 10)).toEqual([]);
  }, 1_800_000);
});
