import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('actual tow and replacement status after safety handoff', () => {
  it.each([
    {
      opening: 'חזרתי לרכב השכור בחניה ויש שריטה בדלת. אין נפגעים ואני לא יודע מי עשה את זה. מה צריך לעשות?',
      photos: 'אין לי כרגע מספר הזמנה, אצלם עכשיו. אם הדלת נפתחת כרגיל אפשר להמשיך לנסוע הביתה?',
      charge: 'ואם מישהו אחר עשה את השריטה, זה אומר שאני לא אשלם כלום?',
      status: 'מצאתי את מספר ההזמנה, הוא 654321. כבר הזמנתם גרר או רכב חלופי?',
      recall: 'כבר יש לכם את מספר ההזמנה או צריך לשלוח שוב?',
      confirmation: 'לא ניתן כאן אישור לתיאום גרר או לרכב חלופי',
      conditional: 'דורשים אישור מפורש',
      referenceReply: 'אין צורך לשלוח אותו שוב',
    },
    {
      opening: 'Someone scratched my rental car door while it was parked. Nobody was injured. What should I do?',
      photos: 'I do not have the booking reference yet. I will take photos. Can I continue driving if the door opens normally?',
      charge: 'If someone else scratched it, does that mean I will not have to pay for the damage?',
      status: 'I found the booking reference, it is 654321. Have you already arranged a tow or a replacement car?',
      recall: 'Do you already have my booking reference or do I need to send it again?',
      confirmation: 'This chat has not confirmed a tow or replacement car',
      conditional: 'require explicit confirmation',
      referenceReply: 'do not need to send it again',
    },
  ])('answers compound status and remembers the natural reference: $status', async scenario => {
    let state: RebuildState | null = null;
    const readTurn = vi.fn(async () => null);
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: async () => 'SIM', readTurn,
    };
    const send = (message: string) => getRebuiltBotReply('fictional-arrangement', message, store);
    const initial = await send(scenario.opening);
    expect(initial.escalate).toBe(true);
    const alertAt = initial.state.safetyAlertAt;
    const photos = await send(scenario.photos);
    const charge = await send(scenario.charge);
    const result = await send(scenario.status);
    expect(result.reply).toContain(scenario.confirmation);
    expect(result.reply).toContain(scenario.conditional);
    expect(result.reply).toContain('09-9509757');
    expect(result.reply).not.toMatch(/מה מספר ההזמנה|שלחו את מספר ההזמנה|what is your booking reference|send your booking reference/i);
    expect(result.state.serviceReference).toBe('654321');
    const recall = await send(scenario.recall);
    expect(recall.reply).toContain('654321');
    expect(recall.reply).toContain(scenario.referenceReply);
    for (const followup of [photos, charge, result, recall]) {
      expect(followup.escalate).toBe(false);
      expect(followup.state.safetyAlertAt).toBe(alertAt);
      expect(followup.state.handoffKind).toBe('safety');
    }
    expect(JSON.stringify(readTurn.mock.calls)).not.toContain('654321');
  });

  it.each([
    ['מצאתי את מספר ההזמנה, הוא 654321. אני רק משווה רכבים כרגע.', 'he'],
    ['My booking reference, it is 654321. I am only comparing cars for now.', 'en'],
  ])('redacts natural punctuation and copula before any model call: %s', async (input, locale) => {
    const readTurn = vi.fn(async () => null);
    const result = await getRebuiltBotReply('fictional-private-reference', input, {
      isSimulation: true, loadState: async () => ({ version: 2, phase: 'explore', step: 'menu', locale: locale as 'he' | 'en', booking: {}, history: [] }),
      saveState: async () => {}, activeBooking: async () => null, createRentalRequest: async () => null, readTurn,
    });
    expect(result.state.serviceReference).toBe('654321');
    expect(readTurn).toHaveBeenCalled();
    expect(JSON.stringify(readTurn.mock.calls)).not.toContain('654321');
  });
});
