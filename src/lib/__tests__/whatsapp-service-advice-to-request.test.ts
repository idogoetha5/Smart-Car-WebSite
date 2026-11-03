import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation(withModel: boolean) {
  let state: RebuildState | null = null;
  const readTurn = vi.fn(async () => withModel ? {
    route: 'service' as const, direction: 'none' as const, fields: {}, source: 'gemini' as const,
    model: 'test', groundedContext: true,
    reply: 'An extension needs availability and price review before confirmation. Would you like us to review the request?',
  } : null);
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => { throw new Error('Must not create a new rental'); }, readTurn,
  };
  return { send: (input: string) => getRebuiltBotReply('fictional-extension-request', input, store), readTurn };
}

describe('existing rental advisory discussion becomes an actual extension request', () => {
  it('uses the saved natural reference to hand off the exact third-turn request once', async () => {
    const { send, readTurn } = conversation(true);
    const first = await send('Hi, I have an existing rental and may need two extra days. Is that possible?');
    const second = await send('Before asking for a change, could you explain what might affect the price for two extra days? I am not requesting a change yet.');
    for (const advisory of [first, second]) {
      expect(advisory.escalate).toBe(false);
      expect(advisory.state.handedOff).not.toBe(true);
      expect(advisory.reply).not.toMatch(/send.*reference|what is.*reference/i);
    }
    const actual = await send('Actually I only need one extra day, not two. I found it: my booking reference, it is 654321. I would like to request that extension now, subject to your confirmation.');
    expect(actual.escalate).toBe(true);
    expect(actual.source).toBe('local');
    expect(actual.state.handoffKind).toBe('booking_change');
    expect(actual.state.serviceReference).toBe('654321');
    expect(actual.reply).toMatch(/not approved|not confirmed/i);
    expect(actual.reply).not.toMatch(/would you like.*review|send.*reference/i);
    const recall = await send('Do you already have my booking reference or do I need to send it again?');
    expect(recall.reply).toContain('654321');
    expect(recall.reply).toContain('do not need to send it again');
    expect(recall.escalate).toBe(false);
    expect(JSON.stringify(readTurn.mock.calls)).not.toContain('654321');
  });

  it.each([
    'My booking reference, it is 654321. What if I ever need an extension for an extra day? I am only asking, not requesting a change.',
    'מספר ההזמנה, הוא 654321. אם אצטרך להאריך ביום, מה התנאים? אני רק שואל ולא מבקש הארכה.',
  ])('a known reference and hypothetical extension are not handoff consent: %s', async input => {
    const { send } = conversation(false);
    await send('I have an existing rental and may need two extra days.');
    const result = await send(input);
    expect(result.state.serviceReference).toBe('654321');
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
    expect(result.reply).not.toMatch(/what is.*reference|send.*reference|מה מספר ההזמנה/iu);
  });
});
