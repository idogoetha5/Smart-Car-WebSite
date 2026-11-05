import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('deposit reference is not consent to stop answering service questions', () => {
  it.each([
    ['Hello, I would like to pay the deposit for booking #654321', 'Before I contact anyone, is that advance payment the same as the security hold on a credit card at pickup, or are they separate? I only want to understand the process here for now.', 'Have you actually checked whether my payment arrived, or do you only have the booking reference I typed? Please remind me which reference you have.', 'An advance payment and the security hold are separate; payment receipt needs confirmation through the official channel.'],
    ['שלום, אני רוצה לשלם מקדמה עבור ההזמנה שלי מספר #654321', 'מקדמה ופיקדון בכרטיס באיסוף זה אותו דבר או נפרד? אני רק מברר כאן כרגע.', 'התשלום שלי כבר התקבל? תזכיר לי איזה מספר הזמנה יש לכם.', 'מקדמה ופיקדון הם נפרדים; קבלת תשלום מאומתת בערוץ הרשמי.'],
  ])('keeps the exact website entry and subsequent questions advisory: %s', async (prefill, distinction, recall, answer) => {
    let state: RebuildState | null = null;
    const readTurn = vi.fn<NonNullable<RebuildStore['readTurn']>>(async () => ({ route: 'service', direction: 'none', fields: {}, source: 'gemini', model: 'test', groundedContext: true, reply: answer }));
    const create = vi.fn(async () => 'unexpected');
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = structuredClone(next); }, activeBooking: async () => null, createRentalRequest: create, readTurn };
    const send = (input: string) => getRebuiltBotReply('fictional-deposit', input, store);
    const first = await send(prefill);
    const second = await send(distinction);
    const third = await send(recall);
    for (const result of [first, second, third]) { expect(result.escalate).toBe(false); expect(result.state.handedOff).not.toBe(true); }
    expect(second.reply).toBe(answer);
    expect(third.reply).toContain('654321');
    expect(JSON.stringify(readTurn.mock.calls)).not.toContain('654321');
    expect(create).not.toHaveBeenCalled();
    // A queued alert remains queued, but it must not turn questions into a
    // canned loop or enqueue a second alert. Actual staff silence is upstream.
    state = { ...third.state, handedOff: true, handoffKind: 'service_issue', handoffAt: new Date().toISOString() };
    const queued = await send(distinction);
    expect(queued.escalate).toBe(false);
    expect(queued.state.handedOff).toBe(true);
    expect(queued.reply).toBe(answer);
  });
});
