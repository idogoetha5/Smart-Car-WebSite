import { describe, expect, it } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

/** Conversations without Gemini: the bot must still read people like a person would. */
async function chat(messages: string[]) {
  let state: FlowState | null = null;
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = next; },
    createRentalRequest: async () => null,
  };
  const replies: string[] = [];
  for (const message of messages) replies.push((await getWhatsAppFlowReply('972500000001', message, store)).reply ?? '');
  return { replies, state: state as FlowState | null };
}

describe('human conversation without Gemini', () => {
  it('starts a booking from a car model or a group size, and says it noted it', async () => {
    const car = await chat(['היי', 'קיה פיקנטו']);
    expect(car.state).toMatchObject({ step: 'rental_dates', vehiclePreference: 'ECONOMY_COMPACT' });
    expect(car.replies[1]).toMatch(/קטן וחסכוני/);
    const group = await chat(['היי', 'אני בא עם עוד 3 חברים']);
    expect(group.state?.passengers).toBe(4);
  });

  it('greets a name and answers "what is your name" and "what do you do"', async () => {
    const { replies } = await chat(['היי', 'איך קוראים לך', 'נעים מאוד, אני דני', 'מה אתם בעצם עושים']);
    expect(replies[1]).toMatch(/SmartCar/);
    expect(replies[1].match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(replies[2]).toMatch(/נעים מאוד דני/);
    expect(replies[3]).toMatch(/השכרת רכב|משכירה/);
  });

  it('gives the opening hours, then just Friday', async () => {
    const { replies } = await chat(['היי', 'מה שעות הפתיחה', 'ובשישי?']);
    expect(replies[1]).toMatch(/08:00/);
    expect(replies[2]).toMatch(/08:30–14:00/);
    expect(replies[2]).not.toMatch(/ראשון עד חמישי/);
  });

  it('never records a question, a date or a remark as the name', async () => {
    const { state } = await chat(['צריך רכב מחר לשבוע', 'מהרצליה', 'לאותו מקום', 'ג׳יפון', 'מה שעות הפתיחה', 'בעוד שבועיים', 'וואלה']);
    expect(state?.customerName).toBeUndefined();
  });

  it('does not read "nice to meet you" as a route, and answers "where are you located" mid-booking', async () => {
    const { replies, state } = await chat(['hi', 'we are a family of 5', 'where are you located', 'nice to meet you, I am Tom']);
    expect(replies[2]).toMatch(/Herzliya/);
    expect(state?.pickupLocation).toBeUndefined();
    expect(state?.customerName).toBe('Tom');
  });

  it('notes a place and an email sent early, and a return date on its own', async () => {
    const { replies } = await chat(['אחי צריך אוטו לסופש', 'ירושלים', 'מחר', 'עד ראשון', 'yossi@gmail.com']);
    expect(replies[1]).toMatch(/איסוף מירושלים/);
    expect(replies[3]).toMatch(/^סגור, החזרה ב־/);
    expect(replies[4]).toMatch(/המייל רשום/);
  });

  it('keeps the details when the customer says bye mid-booking, without pushing the next question', async () => {
    const { replies } = await chat(['צריך רכב מחר לשבוע', 'מהרצליה', 'ביי']);
    expect(replies[2]).not.toMatch(/\?/);
  });

  it('follows the customer into Hebrew after an English "hi"', async () => {
    const { replies } = await chat(['hi', 'צריך רכב מחר לשבוע']);
    expect(replies[1]).toMatch(/[א-ת]/);
  });
});
