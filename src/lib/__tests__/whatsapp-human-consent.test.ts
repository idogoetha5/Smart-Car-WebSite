import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function chat() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null,
    createRentalRequest: async () => 'SIM-CONSENT',
    readTurn: async () => ({ route: 'human', direction: 'none', reply: 'A representative will call.', fields: {}, source: 'gemini', model: 'misclassification-test' }),
  };
  return (message: string) => getRebuiltBotReply('fictional-human-consent', message, store);
}

describe('explicit consent before optional human handoff', () => {
  it('keeps a leasing discussion open when the customer changes term and declines contact', async () => {
    const send = chat();
    await send('I am interested in leasing for two years.');
    await send('What is included?');
    await send('Would a compact or family car be a better starting point?');
    const result = await send('Let us keep compact and family open. Actually three years instead of two. I am not ready to speak to a representative yet.');
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
    expect(result.state.interest).toBe('leasing');
    expect(result.state.history.at(-2)?.text).toContain('three years');
    const yes = await send('Please connect me to a representative now.');
    expect(yes.escalate).toBe(true);
  });

  it.each([
    'אני לא רוצה לדבר עם נציג עדיין, רק מתעניין בליסינג.',
    'I do not want a representative yet. I am considering leasing.',
    'I am considering leasing for two years.',
  ])('does not accept a bare model handoff classification as customer consent: %s', async message => {
    const result = await chat()(message);
    expect(result.escalate).toBe(false);
    expect(result.state.handedOff).not.toBe(true);
  });

  it('does not weaken the immediate safety path when contact is declined', async () => {
    const result = await chat()('My rental car has a flat tyre. I do not want a representative.');
    expect(result.source).toBe('safety');
    expect(result.escalate).toBe(true);
  });
});
