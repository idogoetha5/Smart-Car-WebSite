import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation() {
  let state: RebuildState | null = null;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
  };
  return (message: string) => getRebuiltBotReply('fictional-leasing-offer', message, store);
}

describe('leasing offer acceptance questions before generic comparison', () => {
  it('answers the exact sixth-turn correction and preserves advisory state and known preferences', async () => {
    const send = conversation();
    await send('Hi, I am considering leasing a car, but I am unsure whether 24 or 36 months makes sense. Mostly city driving, around 12,000 km a year.');
    await send('Probably a small automatic, though sometimes I take two kids. No representative yet please. Can you compare 24 and 36 months and explain what I should check in the monthly payment?');
    await send('Private use. I am leaning towards 24 months now. Is maintenance included?');
    await send('Make that 15,000 km a year and 24 months. What preferences do you remember?');
    const question = await send('That is right. If I request an offer, do I have to accept it immediately? I still want to compare the total cost first.');
    expect(question.reply).toContain('does not accept a deal');
    expect(question.reply).toContain('total cost');
    expect(question.reply).not.toMatch(/Private leasing serves|Which route|What vehicle type/i);
    expect(question.escalate).toBe(false);
    const correction = await send('I meant whether asking for an offer obliges me to accept it. I am not asking about business leasing.');
    expect(correction.reply).toContain('does not accept a deal');
    expect(correction.reply).not.toMatch(/Private leasing serves|Which route/i);
    expect(correction.state.commercial).toMatchObject({ termMonths: 24, annualMileageKm: 15000 });
    expect(correction.state.handedOff).not.toBe(true);
  });

  it('answers Hebrew acceptance and total-cost comparison without drifting into leasing routes', async () => {
    const send = conversation();
    await send('אני מתעניין בליסינג לרכב קטן אוטומטי, 24 חודשים ו15000 קמ לשנה');
    await send('בלי נציג כרגע, רק בודק אפשרויות');
    const question = await send('אם אבקש הצעה, אני חייב לקבל אותה מיד? אני רוצה להשוות את העלות הכוללת קודם.');
    expect(question.reply).toContain('אינה מחייבת לקבל את ההצעה מיד');
    expect(question.reply).not.toContain('ליסינג פרטי מיועד');
    const comparison = await send('מה חשוב להשוות בעלות הכוללת?');
    expect(comparison.reply).toContain('עלות הכוללת');
    expect(comparison.reply).not.toContain('ליסינג פרטי מיועד');
    expect(comparison.escalate).toBe(false);
  });
});
