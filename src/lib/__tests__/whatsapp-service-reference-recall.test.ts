import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const readTurn = vi.fn(async () => null);
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn,
  };
  return { send: (message: string) => getRebuiltBotReply('fictional', message, store), readTurn };
}

describe('durable service reference recall', () => {
  it('answers Hebrew recall through cancellation and conditional refund discussion', async () => {
    const { send, readTurn } = conversation();
    await send('אני רוצה לבטל את ההזמנה שלי.');
    await send('מספר ההזמנה שלי הוא 654321.');
    await send('הביטול כבר אושר ומה עם הזיכוי?');
    const recalled = await send('אוקיי. צריך לשלוח שוב את מספר ההזמנה או שכבר יש לכם אותו?');
    expect(recalled.state.serviceReference).toBe('654321');
    expect(recalled.reply).toContain('654321');
    expect(recalled.reply).toContain('אין צורך לשלוח אותו שוב');
    expect(JSON.stringify(readTurn.mock.calls)).not.toContain('654321');
  });

  it('retains English reference after thirteen follow-ups without leaking it to the provider', async () => {
    const { send, readTurn } = conversation();
    await send('I have an existing rental booking and want to cancel it.');
    await send('My booking reference is 654321.');
    for (let turn = 0; turn < 13; turn++) await send('Thank you, I will wait.');
    const recalled = await send('Do you already have my booking reference or do I need to send it again?');
    expect(recalled.state.history.some(entry => entry.from === 'customer' && entry.text.includes('654321'))).toBe(false);
    expect(recalled.reply).toContain('654321');
    expect(recalled.reply).toContain('do not need to send it again');
    expect(JSON.stringify(readTurn.mock.calls)).not.toContain('654321');
  });

  it('does not claim a number is saved when no reference was provided', async () => {
    const { send } = conversation();
    await send('יש לי הזמנה קיימת');
    const recalled = await send('כבר יש לכם את מספר ההזמנה או צריך לשלוח שוב?');
    expect(recalled.state.serviceReference).toBeUndefined();
    expect(recalled.reply).not.toContain('כבר שמור');
  });
});
