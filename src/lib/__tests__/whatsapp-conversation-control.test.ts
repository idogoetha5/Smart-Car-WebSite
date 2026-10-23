import { describe, expect, it } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';
import { parseConversationControl } from '@/lib/whatsapp-conversation-control';

function setup() {
  let state: FlowState | null = { step: 'rental_confirm', locale: 'he', customerName: 'דני לוי', customerEmail: 'old@example.com', pickupDate: '2027-01-10', dropoffDate: '2027-01-12', pickupLocation: 'הרצליה', dropoffLocation: 'הרצליה', vehiclePreference: 'SUV', conversationMemory: 'old@example.com', history: [{ from: 'customer', text: 'old@example.com' }] };
  let created = 0;
  let modelCalls = 0;
  const store: WhatsAppFlowStore = {
    engine: 'local', activeBooking: async () => null, loadState: async () => state,
    saveState: async (_, next) => { state = next; },
    createRentalRequest: async () => { created++; return 'not-expected'; },
    interpretMessage: async () => { modelCalls++; return null; },
  };
  return { send: (text: string) => getWhatsAppFlowReply('control-customer', text, store), state: () => state, created: () => created, modelCalls: () => modelCalls };
}

describe('customer-controlled conversation memory', () => {
  it.each(['forget everything about luggage', 'delete everything about musical instruments', 'תמחק הכל לגבי המטען'])('keeps a scoped everything request from becoming a full reset: %s', text => {
    expect(parseConversationControl(text)).toEqual({ kind: 'forget', fields: ['luggage'] });
  });
  it.each(['תתקן רק את ההנחה, בלי להתחיל מחדש', 'תזכיר לי מה סיכמנו וללא איפוס השיחה', 'Forget the seat discussion for now. Recap our arrival plan without starting a booking.'])('does not reset or erase for a negated reset or paused topic: %s', text => {
    expect(parseConversationControl(text)).toBeNull();
  });
  it.each(['תשנה את ההחזרה לעשרה בפברואר 2030', 'change return date to 10 February 2030'])('edits only the return date: %s', async text => {
    const chat = setup();
    await chat.send(text);
    expect(chat.state()?.dropoffDate).toBe('2030-02-10');
    expect(chat.state()?.pickupDate).toBe('2027-01-10');
    expect(chat.state()?.dropoffLocation).toBe('הרצליה');
    expect(chat.state()?.customerName).toBe('דני לוי');
    expect(chat.state()?.pendingEdit).toBeUndefined();
    expect(chat.created()).toBe(0);
  });
  it('does not accept a return before pickup and asks only for that endpoint', async () => {
    const chat = setup();
    const result = await chat.send('תשנה את תאריך ההחזרה ל9 בינואר 2027');
    expect(chat.state()?.dropoffDate).toBe('2027-01-12');
    expect(chat.state()?.pendingEdit).toBe('dropoffDate');
    expect(result.reply).toContain('תאריך ההחזרה');
    await chat.send('13 בינואר 2027');
    expect(chat.state()?.dropoffDate).toBe('2027-01-13');
  });
  it('repeats the updated draft on request instead of demanding confirmation', async () => {
    const chat = setup();
    await chat.send('לפני שאאשר תשנה את ההחזרה לעשרה בפברואר 2030');
    const result = await chat.send('תזכיר לי מה סיכמנו לפני שאאשר');
    expect(result.reply).toContain('10/02/2030');
    expect(result.reply).toContain('הרצליה');
    expect(result.reply).toContain('דני לוי');
    expect(result.reply).not.toContain('https://');
    expect(chat.created()).toBe(0);
    expect(chat.state()?.step).toBe('rental_confirm');
  });
  it.each(['תתחיל מההתחלה', 'נתחיל מחדש', 'תמחק הכל', 'start over', 'forget everything'])('resets only on an explicit instruction: %s', async text => {
    const chat = setup();
    const reply = await chat.send(text);
    expect(reply.conversationControl).toBe(true);
    expect(chat.state()).toEqual({ step: 'menu', locale: 'he', returningChecked: true, history: [] });
    expect(chat.created()).toBe(0);
    expect(chat.modelCalls()).toBe(0);
  });
  it.each(['אל תמחק את המייל', 'לא להתחיל מחדש', 'מה יקרה אם תמחק הכל?', "don't reset the chat"])('does not execute negation or hypothetical: %s', text => {
    expect(parseConversationControl(text)).toBeNull();
  });
  it('removes email from state, history and summary without losing dates', async () => {
    const chat = setup();
    await chat.send('תמחק את המייל שלי');
    expect(chat.state()?.customerEmail).toBeUndefined();
    expect(JSON.stringify(chat.state())).not.toContain('old@example.com');
    expect(chat.state()?.pickupDate).toBe('2027-01-10');
    expect(chat.state()?.step).toBe('rental_email');
  });
  it('asks what to delete and understands the short answer', async () => {
    const chat = setup();
    expect((await chat.send('תמחק')).reply).toContain('איזה פרט');
    expect(chat.state()?.customerEmail).toBe('old@example.com');
    await chat.send('המייל');
    expect(chat.state()?.customerEmail).toBeUndefined();
    expect(chat.state()?.customerName).toBe('דני לוי');
  });
  it('changes a field in two turns, before final confirmation, without submitting', async () => {
    const chat = setup();
    expect((await chat.send('תשנה את המייל')).reply).toContain('המייל החדשה');
    expect(chat.state()?.customerEmail).toBe('old@example.com');
    await chat.send('new@example.com');
    expect(chat.state()?.customerEmail).toBe('new@example.com');
    expect(chat.state()?.pickupDate).toBe('2027-01-10');
    expect(chat.created()).toBe(0);
  });
  it('accepts a replacement in the same message', async () => {
    const chat = setup();
    await chat.send('תעדכן את המייל ל new@example.com');
    expect(chat.state()?.customerEmail).toBe('new@example.com');
  });
  it('lets the customer request a person during a correction', async () => {
    const chat = setup();
    await chat.send('תשנה את המייל');
    const reply = await chat.send('נציג');
    expect(reply.escalate).toBe(true);
    expect(chat.state()?.customerEmail).toBe('old@example.com');
  });
  it('keeps known facts when opening the menu', async () => {
    const chat = setup();
    await chat.send('תפריט');
    expect(chat.state()?.step).toBe('menu');
    expect(chat.state()?.customerEmail).toBe('old@example.com');
    expect(chat.state()?.pickupDate).toBe('2027-01-10');
  });
  it('does not confuse cancellation of a business booking with forgetting chat memory', async () => {
    const chat = setup();
    expect((await chat.send('תמחק את ההזמנה')).reply).toContain('לא למחוק הזמנה');
    expect(chat.state()?.customerEmail).toBe('old@example.com');
    expect(chat.created()).toBe(0);
  });
});
