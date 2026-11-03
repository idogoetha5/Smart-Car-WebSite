import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

function conversation(initial: RebuildState | null = null) {
  let state = initial;
  const store: RebuildStore = {
    isSimulation: true, loadState: async () => state,
    saveState: async (_phone, next) => { state = structuredClone(next); },
    activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
  };
  return (message: string) => getRebuiltBotReply('fictional', message, store);
}

describe('commercial memory after the rolling conversation window', () => {
  it('recalls only latest English facts after fourteen advisory turns, including a mixed commitment question', async () => {
    const send = conversation();
    await send('I want leasing for two years, budget 70000 shekels, 12000 km a year. I prefer a compact car.');
    await send('Budget now 60000. I am unsure whether 24 or 36 months makes sense.');
    await send('Probably a small automatic. Actually make it 24 months and 15000 km annually.');
    for (let i = 0; i < 14; i++) await send('What should I check about maintenance?');
    const recalled = await send('What details do you remember, and have I committed to a deal?');
    expect(recalled.state.history.length).toBeLessThanOrEqual(20);
    expect(recalled.state.history.some(entry => entry.text.includes('70000'))).toBe(false);
    expect(recalled.reply).toMatch(/60000 ILS/);
    expect(recalled.reply).toMatch(/24 months/);
    expect(recalled.reply).toMatch(/15000 km/);
    expect(recalled.reply).toMatch(/compact/);
    expect(recalled.reply).toMatch(/no commitment/);
    expect(recalled.reply).not.toMatch(/70000|12000|36 months/);
    expect(recalled.escalate).toBe(false);
  });

  it('recalls the lowered Hebrew budget and cleared vehicle choice after thirteen turns', async () => {
    const send = conversation();
    await send('אני רוצה לקנות רכב קטן, תקציב 70000 שקל');
    await send('בעצם התקציב ירד ל־60000. לא בחרתי סוג רכב, נשאיר את זה פתוח.');
    for (let i = 0; i < 13; i++) await send('מה כולל השירות שלכם ברכישה?');
    const recalled = await send('מה הפרטים ששמרת עליי ומה התקציב?');
    expect(recalled.reply).toMatch(/60000 ILS/);
    expect(recalled.reply).toContain('פתוחה');
    expect(recalled.reply).not.toMatch(/70000|קומפקטי/);
    expect(recalled.state.commercial?.vehiclePreference).toBeNull();
  });

  it('seeds a legacy commercial state once and keeps updates after handoff', async () => {
    const send = conversation({ version: 2, phase: 'service', step: 'menu', locale: 'en', booking: {}, interest: 'sale', handedOff: true,
      handoffAt: new Date().toISOString(), handoffKind: 'commercial',
      history: [{ from: 'customer', text: 'I want a family car, budget 70000 shekels. My name is Private Name, private@example.invalid.' }],
    });
    const corrected = await send('Thanks. Budget now 60000, not 70000.');
    expect(corrected.state.commercial?.budget?.amount).toBe(60000);
    expect(JSON.stringify(corrected.state.commercial)).not.toMatch(/Private|example/);
    const recalled = await send('What details do you remember?');
    expect(recalled.reply).toMatch(/60000 ILS/);
    expect(recalled.reply).not.toMatch(/70000/);
  });
});
