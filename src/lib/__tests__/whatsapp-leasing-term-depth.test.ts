import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
  };
  return (message: string) => getRebuiltBotReply('fictional-leasing-term', message, store);
}

describe('leasing term questions ahead of repeated intake', () => {
  it('answers the exact English comparison, maintenance and commitment sequence without repeating vehicle intake', async () => {
    const send = conversation();
    await send('Hi, I am considering leasing a car, but I am unsure whether 24 or 36 months makes sense. Mostly city driving, around 12,000 km a year.');
    const compared = await send('Probably a small automatic, though sometimes I take two kids. No representative yet please. Can you compare 24 and 36 months and explain what I should check in the monthly payment?');
    expect(compared.reply).toContain('24 months');
    expect(compared.reply).toContain('36 months');
    expect(compared.reply).toContain('total cost');
    expect(compared.reply).not.toMatch(/private leasing|which route|what vehicle type/i);
    const maintenance = await send('Private use, yes, but I was asking about 24 vs 36 months and whether maintenance is included.');
    expect(maintenance.reply).toContain('maintenance');
    expect(maintenance.reply).not.toMatch(/What vehicle type|Which route/i);
    const correction = await send('A small automatic. Actually make it 15,000 km annually and 24 months. Have I committed to anything by discussing this?');
    expect(correction.reply).toContain('no commitment');
    expect(correction.reply).not.toMatch(/What vehicle type|Which route/i);
    expect(correction.escalate).toBe(false);
    const next = await send('What is the next step?');
    expect(next.reply).not.toMatch(/choose a vehicle type|What vehicle type/i);
    expect(next.state.handedOff).not.toBe(true);
  });

  it('answers Hebrew term and maintenance questions before vehicle intake', async () => {
    const send = conversation();
    await send('אני מתעניין בליסינג, 12000 קמ לשנה');
    const compared = await send('רכב קטן אוטומטי, בלי נציג כרגע. מה ההבדל בין 24 חודשים מול 36 חודשים ומה לבדוק בתשלום החודשי?');
    expect(compared.reply).toContain('24 חודשים');
    expect(compared.reply).toContain('36 חודשים');
    expect(compared.reply).toContain('תנאי היציאה');
    const maintenance = await send('והטיפולים כלולים?');
    expect(maintenance.reply).toContain('אין להניח שתחזוקה כלולה');
    expect(maintenance.escalate).toBe(false);
  });

  it('does not truncate a legitimate route question when representative handoff is deferred', async () => {
    const send = conversation();
    await send('I am interested in leasing for two years and 15000 km a year.');
    await send('No representative yet please.');
    const question = await send('What is the difference between private and business leasing?');
    expect(question.reply).toContain('Which route would you like us to check?');
    expect(question.reply).not.toMatch(/Which route$/);
  });
});
