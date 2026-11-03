import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('damage liability after several safety follow-ups', () => {
  it.each([
    ['חזרתי לרכב השכור בחניה ויש שריטה בדלת. אין נפגעים ואני לא יודע מי עשה את זה. מה צריך לעשות?', 'אין לי כרגע מספר הזמנה, אצלם עכשיו. אם הדלת נפתחת כרגיל אפשר להמשיך לנסוע הביתה?', /אל תמשיכו לנסוע/, /הנחיה לגבי המשך הנסיעה/],
    ['Someone scratched my rental car while parked, no injuries. What should I do?', 'I do not have the booking reference. I will take photos. Can I continue driving home?', /do not continue driving/i, /guidance before continuing/i],
  ])('answers the driving question alongside photos and a missing reference', async (opening, followup, caution, guidance) => {
    let state: RebuildState | null = null;
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn: async () => null,
    };
    await getRebuiltBotReply('fictional', String(opening), store);
    const result = await getRebuiltBotReply('fictional', String(followup), store);
    expect(result.reply).toMatch(caution);
    expect(result.reply).toMatch(guidance);
    expect(result.escalate).toBe(false);
  });

  it.each([
    'ואם מישהו אחר עשה את השריטה, זה אומר שאני לא אשלם כלום?',
    'אם אדם אחר שרט, אנחנו עדיין נשלם?',
    'אני שואל לגבי התשלום על הנזק וההשתתפות העצמית.',
  ])('answers liability without promising free repair: %s', async message => {
    let state: RebuildState | null = null;
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => 'SIM-DAMAGE',
      readTurn: async () => null,
    };
    const send = (input: string) => getRebuiltBotReply('fictional-damage', input, store);
    await send('מישהו שרט את הרכב השכור בחניה, אין נפגעים. מה לעשות?');
    await send('צילמתי את השריטה ואת סביבת הרכב.');
    await send('הרכב נראה תקין. מותר לי להמשיך לנסוע?');
    const result = await send(message);
    expect(result.reply).toContain('התשלום על הנזק תלוי');
    expect(result.reply).toContain('אי אפשר לקבוע חיוב לפני בדיקת האירוע');
    expect(result.reply).not.toContain('לא תשלמו');
    expect(result.state.handoffKind).toBe('safety');
  });
});
