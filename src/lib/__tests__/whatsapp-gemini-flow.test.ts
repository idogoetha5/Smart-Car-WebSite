import { describe, expect, it, vi } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';
import type { WhatsAppInterpretation } from '@/lib/whatsapp-gemini';

function makeStore(interpretation: WhatsAppInterpretation | null) {
  let state: FlowState | null = null;
  const interpretMessage = vi.fn(async (..._args: Parameters<NonNullable<WhatsAppFlowStore['interpretMessage']>>) => interpretation);
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = next; },
    createRentalRequest: async () => null,
    interpretMessage,
  };
  return { store, interpretMessage, state: () => state };
}

const emptyFields = {
  vehiclePreference: '' as const, vehicleEvidence: '', pickupLocation: '', pickupEvidence: '',
  dropoffLocation: '', dropoffEvidence: '', pickupDate: '', dropoffDate: '', pickupTime: '', returnTime: '',
  passengers: 0, acknowledgement: '',
};

describe('Gemini interpretation inside the WhatsApp flow', () => {
  it.each(['policy', 'rental'] as const)('does not turn a hypothetical deposit correction into an account dispute during a draft (%s)', async intent => {
    const reply = 'פיקדון תופס מסגרת ואינו מחיר ההשכרה. ייתכנו חיובים אחרים לפי ההסכם, גם בלי נזק. נשארים בהשוואה.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'correction', intent, reply, asks: 'nothing' });
    store.engine = 'ai';
    await store.saveState('deposit-advice-correction', { step: 'rental_dates', locale: 'he', returningChecked: true, passengers: 3 });
    const result = await getWhatsAppFlowReply('deposit-advice-correction', 'לא ביקשתי להתחיל השכרה, ולכן שאלת האיסוף מוקדמת. אנחנו רק משווים. וגם רכב בלי נזק לא בהכרח אומר שאין חיובים אחרים. תתקן את ההסבר בלי שאלה בסוף.', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(state()?.handedOff).not.toBe(true);
    expect(state()?.passengers).toBe(3);
  });
  it('handles frustration with an explanation without a keyword-only handoff', async () => {
    const reply = 'אסביר אחרת: הפיקדון והחיובים האפשריים הם דברים נפרדים.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'complaint', intent: 'policy', reply, asks: 'nothing' });
    store.engine = 'ai';
    await store.saveState('explanation-frustration', { step: 'rental_dates', locale: 'he', returningChecked: true });
    const result = await getWhatsAppFlowReply('explanation-frustration', 'אני מתוסכל מהתשובה שלך. זו רק שאלה כללית על התנאים.', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(state()?.handedOff).not.toBe(true);
  });
  it('keeps an explicit actual double-charge dispute above a mistaken model policy label', async () => {
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'complaint', intent: 'policy', reply: 'General charges depend on the agreement.', asks: 'nothing' });
    store.engine = 'ai';
    const result = await getWhatsAppFlowReply('actual-charge-dispute', 'You charged me twice. I need this charge reviewed.', store);
    expect(result.escalate).toBe(true);
    expect(state()?.handedOff).toBe(true);
  });
  it('does not let a pending generic edit swallow correction of monthly-exit advice', async () => {
    const reply = 'Monthly billing alone does not establish penalty-free early return; the actual exit terms must be checked.';
    const { store, state, interpretMessage } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'explanation', intent: 'leasing', reply, asks: 'nothing' });
    store.engine = 'ai';
    await store.saveState('exit-advice-correction', { step: 'menu', locale: 'en', returningChecked: true, pendingControl: 'edit', knowledgeTopic: 'leasing_terms' });
    const result = await getWhatsAppFlowReply('exit-advice-correction', 'You said monthly rental lets us stop paying on return. Please correct that: without the actual exit terms, what can we honestly conclude? No new questions or quotation.', store);
    expect(result.reply).toBe(reply);
    expect(interpretMessage).toHaveBeenCalledOnce();
    expect(result.conversationControl).not.toBe(true);
    expect(result.escalate).not.toBe(true);
    expect(state()?.knowledgeTopic).toMatch(/^leasing_/);
  });
  it.each([undefined, 'vehiclePreference' as const])('answers correction of its own advice instead of a fact-edit prompt (pending: %s)', async pendingEdit => {
    const reply = 'I cannot establish fit without verified load-space dimensions and payload. My earlier height assumption was unsupported.';
    const { store, state, interpretMessage } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'explanation', intent: 'unknown', reply, asks: 'nothing' });
    store.engine = 'ai';
    await store.saveState('advice-correction', { step: 'menu', locale: 'en', returningChecked: true, pendingEdit, vehiclePreference: 'ALL' });
    const result = await getWhatsAppFlowReply('advice-correction', 'Please correct that assumption and explain what needs checking before choosing a vehicle.', store);
    expect(result.reply).toBe(reply);
    expect(interpretMessage).toHaveBeenCalledOnce();
    expect(result.conversationControl).not.toBe(true);
    expect(result.escalate).not.toBe(true);
    expect(state()?.vehiclePreference).toBe('ALL');
  });
  it('keeps a current-needs recap autonomous instead of matching rent inside current', async () => {
    const reply = 'You travel alone, carry two suitcases and have no charging access.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'details', intent: 'unknown', reply, asks: 'nothing' });
    store.engine = 'ai';
    await store.saveState('current-recap', { step: 'menu', locale: 'en', conversationMemory: reply, returningChecked: true });
    const result = await getWhatsAppFlowReply('current-recap', 'Briefly recap only my current travel needs. No booking, catalogue or contact request.', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(state()?.handedOff).not.toBe(true);
    expect(state()?.lastQuestion).toBeUndefined();
  });
  it('passes older customer evidence to the model after 1020 archived entries and retains the full history', async () => {
    const reply = 'You mentioned three musical instruments.';
    const { store, state, interpretMessage } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'explanation', intent: 'unknown', reply, asks: 'nothing' });
    store.engine = 'ai';
    const history = [{ from: 'customer' as const, text: 'We need luggage space for 3 musical instruments.' }, ...Array.from({ length: 1020 }, (_, i) => ({ from: 'customer' as const, text: `Small talk ${i}` }))];
    await store.saveState('archive-recall', { step: 'menu', locale: 'en', history });
    const result = await getWhatsAppFlowReply('archive-recall', 'What did I say earlier about musical instruments and luggage?', store);
    expect(result.reply).toBe(reply);
    expect(interpretMessage.mock.calls[0][2]?.recalledCustomerQuotes?.[0].text).toContain('3 musical instruments');
    expect(state()?.history).toHaveLength(1023);
  });
  it('answers general vehicle-history advice within sales without pretending to review a specific car', async () => {
    const reply = 'Verify maintenance records, ownership history and mileage consistency before choosing.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'advice', intent: 'buy_car', reply, asks: 'nothing' });
    store.engine = 'ai';
    await store.saveState('sale-advice', { step: 'menu', locale: 'en', carSale: { mode: 'car_sale', selectedCarIds: ['kept'], budget: 90000 } });
    const result = await getWhatsAppFlowReply('sale-advice', "What should I check about a used fleet car's history? No catalogue.", store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(state()?.carSale?.selectedCarIds).toEqual(['kept']);
  });
  it('answers a requested office number without replacing it with the active sales catalogue', async () => {
    const reply = 'You can reach the office at 09-9509757.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'details', intent: 'buy_car', contactInformationRequested: true, reply, asks: 'nothing' });
    store.engine = 'ai';
    const catalogue = vi.fn(async () => []);
    store.getCarsForSale = catalogue;
    await store.saveState('sale-contact', { step: 'menu', locale: 'en', carSale: { mode: 'car_sale', selectedCarIds: ['kept'], budget: 90000 } });
    const result = await getWhatsAppFlowReply('sale-contact', 'Now I do want your office phone number, please.', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(catalogue).not.toHaveBeenCalled();
    expect(state()?.carSale?.selectedCarIds).toEqual(['kept']);
  });
  it('does not hand off a declined rental when the customer says ובלי להעביר לנציג', async () => {
    const reply = 'בחרת במוניות בגלל שתי נסיעות קצרות ותפיסת מסגרת בפיקדון.';
    const { store } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'explanation', intent: 'policy', reply, asks: 'nothing' });
    store.engine = 'ai';
    const result = await getWhatsAppFlowReply('declined-recall', 'נשאר עם מוניות. רק תזכיר לי למה החלטנו ככה, בלי לשאול שאלות ובלי להעביר לנציג.', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
  });
  it('keeps a notification status complaint even when the broad sales label is wrong', async () => {
    const reply = 'No, this chat has not added you to a notification list.';
    const { store } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'complaint', intent: 'sell_car', notificationRequest: true, reply, asks: 'nothing' });
    store.engine = 'ai';
    const result = await getWhatsAppFlowReply('notification-status', 'Have you actually added me to the fleet-sale notification list? Do not send me a phone number or website.', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
  });
  it('does not turn an airport-arrangement question into a human request because it says someone', async () => {
    const reply = 'Airport collection needs an agreed arrangement in advance; simply arriving does not confirm a meeting.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', purpose: 'explanation', intent: 'policy', acknowledgement: reply, reply, asks: 'nothing' });
    store.engine = 'ai';
    const result = await getWhatsAppFlowReply('airport-policy', 'We have not booked. Can I just show up at Ben Gurion at 1 am and expect someone to be waiting?', store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(state()?.handedOff).not.toBe(true);
  });
  it('does not let the FAQ shortcut swallow a real account handoff', async () => {
    const reply = 'צריך לבדוק את מצב הפיקדון הספציפי עם צוות המשרד.';
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', intent: 'representative', purpose: 'complaint', acknowledgement: 'הפיקדון עדיין תופס מסגרת.', reply, asks: 'nothing' });
    store.engine = 'ai';
    const result = await getWhatsAppFlowReply('account-review', 'החזרתי את הרכב ואתם עדיין תופסים לי את הפיקדון. אני צריך את המסגרת לקניות לשבת, זה ממש לא מצחיק.', store);
    expect(result.escalate).toBe(true);
    expect(state()?.handedOff).toBe(true);
    expect(result.reply).toBe(reply);
  });
  it('keeps a genuine contact-information question autonomous', async () => {
    const { store, state } = makeStore({ ...emptyFields, source: 'gemini', intent: 'representative', purpose: 'explanation', acknowledgement: 'אפשר להתקשר למשרד.', reply: 'אפשר להתקשר למשרד.', asks: 'nothing' });
    store.engine = 'ai';
    const result = await getWhatsAppFlowReply('contact-info', 'איך אפשר להתקשר אליכם?', store);
    expect(result.escalate).not.toBe(true);
    expect(state()?.handedOff).not.toBe(true);
  });
  it.each(['Hello, please notify me when fleet cars become available.', 'Have you actually added me to the notification list?', 'רק ביקשתי עדכון כשיהיו רכבים, לא רשימת מלאי'])('keeps notification discussion out of catalogue actions: %s', async message => {
    const reply = /[א-ת]/.test(message) ? 'לא נוצרה כאן הרשמה לעדכונים אוטומטיים.' : 'This chat has not created an automatic notification signup.';
    const { store, state } = makeStore({ ...emptyFields, purpose: 'correction', intent: 'buy_car', source: 'gemini', reply, asks: 'nothing', notificationRequest: true });
    store.engine = 'ai';
    const catalogue = vi.fn(async () => []);
    store.getCarsForSale = catalogue;
    await store.saveState('notification', { step: 'menu', locale: 'en', carSale: { mode: 'car_sale', selectedCarIds: ['existing-car'], budget: 90000 } });
    const result = await getWhatsAppFlowReply('notification', message, store);
    expect(result.reply).toBe(reply);
    expect(result.escalate).not.toBe(true);
    expect(catalogue).not.toHaveBeenCalled();
    expect(state()?.carSale).toMatchObject({ selectedCarIds: ['existing-car'], budget: 90000 });
    expect(state()?.history?.at(-1)?.text).toBe(reply);
  });
  it('does not record a recall request as a name after the old flow already asked for one', async () => {
    const reply = 'האיסוף וההחזרה בתל אביב, מ־1.11 עד 15.11.';
    const { store, state, interpretMessage } = makeStore({ ...emptyFields, intent: 'unknown', source: 'gemini', reply, asks: 'nothing' });
    await store.saveState('recall-name', { step: 'rental_name', locale: 'he', pickupDate: '2026-11-01', dropoffDate: '2026-11-15', pickupLocation: 'תל אביב', dropoffLocation: 'תל אביב', vehiclePreference: 'SUV' });
    const result = await getWhatsAppFlowReply('recall-name', 'תזכיר לי את התאריכים והמיקום שכבר אמרתי', store);
    expect(interpretMessage).toHaveBeenCalledOnce();
    expect(result.reply).toBe(reply);
    expect(state()?.customerName).toBeUndefined();
    expect(state()?.step).toBe('rental_name');
  });
  it.each(['מה אתה ממליץ לזוג ותינוק?', 'משפחתית או SUV מה עדיף', 'what would you recommend for a couple and baby?', 'בלי עוד שאלות כרגע תסביר בקצרה מה ההבדל', 'תזכיר לי את התאריכים והמיקום שכבר אמרתי'])('answers advice without selecting or quoting: %s', async (message) => {
    const reply = 'משפחתית עם תא מטען מתאים לעגלה יכולה להתאים; ההתאמה תלויה בדגם.';
    const { store, state } = makeStore({ ...emptyFields, intent: 'rental', source: 'gemini', reply, asks: 'nothing', vehiclePreference: 'SUV', vehicleEvidence: message, passengers: 0 });
    const quotes = vi.fn(async () => []);
    store.getRentalQuotes = quotes;
    await store.saveState('advice-test', { step: 'rental_vehicle', locale: 'he', pickupDate: '2030-01-10', dropoffDate: '2030-01-24', pickupLocation: 'תל אביב', dropoffLocation: 'תל אביב' });
    const result = await getWhatsAppFlowReply('advice-test', message, store);
    expect(result.reply).toBe(reply);
    expect(state()?.step).toBe('rental_vehicle');
    expect(state()?.vehiclePreference).toBeUndefined();
    expect(state()?.pickupDate).toBe('2030-01-10');
    expect(quotes).not.toHaveBeenCalled();
    expect(result.reply).not.toMatch(/https?:|₪|כמעט סיימנו|שם מלא/);
  });
  it('retains an explicit vehicle choice without unsolicited catalogue quotes', async () => {
    const { store, state } = makeStore({ ...emptyFields, intent: 'rental', source: 'gemini', vehiclePreference: 'SUV', vehicleEvidence: 'SUV', reply: 'רשמתי ג׳יפון. על איזה שם לרשום את הבקשה?', asks: 'name' });
    const quotes = vi.fn(async () => []);
    store.getRentalQuotes = quotes;
    await store.saveState('choice-test', { step: 'rental_vehicle', locale: 'he', pickupDate: '2030-01-10', dropoffDate: '2030-01-24', pickupLocation: 'תל אביב', dropoffLocation: 'תל אביב' });
    const result = await getWhatsAppFlowReply('choice-test', 'נלך על SUV', store);
    expect(state()?.vehiclePreference).toBe('SUV');
    expect(quotes).not.toHaveBeenCalled();
    expect(result.reply).not.toMatch(/https?:|₪/);
  });
  it('retains over 1020 messages and passes durable memory beyond the recent window', async () => {
    const { store, state, interpretMessage } = makeStore({ ...emptyFields, intent: 'unknown', source: 'gemini', reply: 'הפרטים נשמרו.', asks: 'nothing', conversationMemory: 'שנה; 15000 קמ; גג פתוח; CarPlay; עור' });
    const history = Array.from({ length: 1020 }, (_, i) => ({ from: i % 2 ? 'bot' as const : 'customer' as const, text: `הודעה ${i}` }));
    await store.saveState('memory-test', { step: 'menu', locale: 'he', history, conversationMemory: 'שנה; 15000 קמ; גג פתוח; CarPlay; עור' });
    await getWhatsAppFlowReply('memory-test', 'מה ההעדפות שלי?', store);
    expect(interpretMessage.mock.calls[0]?.[2]).toMatchObject({ conversationMemory: 'שנה; 15000 קמ; גג פתוח; CarPlay; עור' });
    expect(state()?.history).toHaveLength(1022);
    expect(state()?.history?.[0].text).toBe('הודעה 0');
    expect(state()?.conversationMemory).toContain('15000');
  });
  it('does not fall back to keyword advice or begin intake when the provider is unavailable', async () => {
    vi.stubEnv('WHATSAPP_LOCAL_BACKUP_ENABLED', 'false');
    const { store, state } = makeStore(null);
    const result = await getWhatsAppFlowReply('972501234567', 'אנחנו זוג עם תינוק ועגלה, מה עדיף משפחתית או גיפון?', store);
    expect(result.aiUnavailable).toBe(true);
    expect(result.reply).toContain('בעיית חיבור');
    expect(result.reply).not.toContain('מאיזה תאריך');
    expect(result.escalate).not.toBe(true);
    expect(state()).toBeNull();
    vi.unstubAllEnvs();
  });

  it('does not substitute a local knowledge interpretation for a live model', async () => {
    vi.stubEnv('WHATSAPP_LOCAL_BACKUP_ENABLED', 'false');
    const { store } = makeStore({ ...emptyFields, intent: 'policy', source: 'local', acknowledgement: 'old local advice' });
    const result = await getWhatsAppFlowReply('972501234567', 'מה יותר חסכוני בדלק?', store);
    expect(result.aiUnavailable).toBe(true);
    expect(result.reply).not.toContain('old local advice');
    vi.unstubAllEnvs();
  });
  it('routes an unfamiliar rental phrase into the existing safe intake', async () => {
    const { store, interpretMessage, state } = makeStore({ intent: 'rental', ...emptyFields });
    const result = await getWhatsAppFlowReply('972501234567', 'אפשר אוטו לחופשה?', store);
    expect(interpretMessage).toHaveBeenCalledOnce();
    expect(result.reply).toContain('מתי נוח לך לאסוף');
    expect(state()).toMatchObject({ step: 'rental_dates' });
  });

  it('gives a person the conversation even when policy keywords are present', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields });
    const result = await getWhatsAppFlowReply('972501234567', 'ביטוח, בבקשה שמישהו יחזור אליי', store);
    expect(result.escalate).toBe(true);
    expect(state()).toMatchObject({ handedOff: true });
  });

  it('honours a person request before the car sales catalogue', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields });
    const result = await getWhatsAppFlowReply('972501234567', 'אני רוצה לקנות רכב אבל לדבר קודם עם מישהו', store);
    expect(result.escalate).toBe(true);
    expect(state()).toMatchObject({ handedOff: true });
  });

  it('never asks two questions at once: the Gemini question is dropped when the chat asks the next one', async () => {
    const { store } = makeStore({ intent: 'rental', ...emptyFields, acknowledgement: 'אין בעיה, בשמחה נסדר לך רכב. איפה תרצה לאסוף אותו?' });
    const result = await getWhatsAppFlowReply('972501234567', 'אפשר אוטו לחופשה?', store);
    expect(result.reply).toContain('אין בעיה, בשמחה נסדר לך רכב.');
    expect(result.reply).not.toContain('איפה תרצה לאסוף');
    expect(result.reply?.match(/\?/g)).toHaveLength(1);
  });

  it('sends Gemini\u2019s whole reply when it asks exactly what the booking needs next', async () => {
    const reply = 'בכיף, נסדר לך רכב 🚗 מאיזה תאריך צריך אותו?';
    const { store } = makeStore({ intent: 'rental', ...emptyFields, acknowledgement: 'בכיף, נסדר לך רכב 🚗', reply, asks: 'pickup_date' });
    const result = await getWhatsAppFlowReply('972501234567', 'השכרת רכב', store);
    expect(result.reply).toBe(reply);
  });

  it('falls back to one question of its own when Gemini asks for the wrong thing', async () => {
    const { store } = makeStore({ intent: 'rental', ...emptyFields, acknowledgement: 'מעולה.', reply: 'מעולה. באיזו שעה ומאיפה?', asks: 'places' });
    const result = await getWhatsAppFlowReply('972501234567', 'השכרת רכב', store);
    expect(result.reply).not.toContain('באיזו שעה');
    expect(result.reply?.match(/\?/g)).toHaveLength(1);
  });

  it('starts the booking from the menu when Gemini already asks a booking question, keeping the place', async () => {
    const { store, state } = makeStore({ intent: 'unknown', ...emptyFields, pickupLocation: 'נתב״ג', pickupEvidence: 'מנתב״ג', reply: 'סגור, מנתב״ג ✈️ מתי לאסוף?', asks: 'pickup_date', source: 'gemini' });
    await store.saveState('972501234567', { step: 'menu', locale: 'he' });
    const result = await getWhatsAppFlowReply('972501234567', 'צריך אוטו מנתב״ג', store);
    expect(state()).toMatchObject({ step: 'rental_dates', pickupLocation: 'נתב״ג' });
    expect(result.reply).toBe('סגור, מנתב״ג ✈️ מתי לאסוף?');
  });

  it('does not assume the return place from a single place name', async () => {
    const { store, state } = makeStore({ intent: 'rental', ...emptyFields, pickupLocation: 'הרצליה', pickupEvidence: 'הרצליה', dropoffLocation: 'הרצליה', dropoffEvidence: 'הרצליה', source: 'gemini' });
    await store.saveState('972501234567', { step: 'rental_locations', locale: 'he', pickupDate: '2030-01-10', dropoffDate: '2030-01-12' });
    await getWhatsAppFlowReply('972501234567', 'הרצליה', store);
    expect(state()).toMatchObject({ step: 'rental_locations', pickupLocation: 'הרצליה' });
    expect(state()?.dropoffLocation).toBeUndefined();
  });

  it('keeps a deterministic safety route when Gemini is unavailable', async () => {
    const { store, interpretMessage } = makeStore(null);
    const result = await getWhatsAppFlowReply('972501234567', 'יש תאונה', store);
    expect(result.escalate).toBe(true);
    expect(result.reply).toContain('גורמי החירום');
    expect(interpretMessage).not.toHaveBeenCalled();
  });
});

describe('Gemini understanding of free-form rental messages', () => {
  function inDays(days: number) {
    const date = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  it('takes resolved dates, group size and a natural acknowledgement from one message', async () => {
    const { store, state } = makeStore({
      intent: 'rental', ...emptyFields,
      pickupDate: inDays(4), dropoffDate: inDays(6), passengers: 6,
      vehiclePreference: 'VAN', vehicleEvidence: 'ל6 אנשים',
      acknowledgement: 'שישה אנשים זה בדיוק בשביל רכב 7 מקומות.',
    });
    const result = await getWhatsAppFlowReply('972501234567', 'היי אני צריך רכב לסופש הבא משהו גדול ל6 אנשים', store);
    expect(state()).toMatchObject({ pickupDate: inDays(4), dropoffDate: inDays(6), passengers: 6, vehiclePreference: 'VAN', step: 'rental_locations' });
    expect(result.reply).toContain('שישה אנשים זה בדיוק');
    expect(result.reply).not.toContain('בשמחה, נמצא את הרכב');
  });

  it('answers a side question and repeats the missing detail instead of saying it did not understand', async () => {
    const { store } = makeStore({ intent: 'rental', ...emptyFields, acknowledgement: 'המחיר תלוי בתאריכים ובסוג הרכב, ואציג הצעות מהקטלוג ברגע שיהיו לי.' });
    await store.saveState('972501234567', { step: 'rental_dates', locale: 'he' });
    const result = await getWhatsAppFlowReply('972501234567', 'מה המחיר בערך?', store);
    expect(result.reply).toContain('המחיר תלוי בתאריכים');
    expect(result.reply).not.toContain('לא הצלחתי לזהות');
  });

  it('ignores a model date in the past', async () => {
    const { store, state } = makeStore({ intent: 'rental', ...emptyFields, pickupDate: '2020-01-01', dropoffDate: '2020-01-03' });
    await getWhatsAppFlowReply('972501234567', 'רוצה רכב לפני שנים', store);
    expect(state()?.pickupDate).toBeUndefined();
  });
});

describe('model acknowledgement guard', () => {
  it('drops sentences that state prices or contain links', async () => {
    const { safeAcknowledgement } = await import('@/lib/whatsapp-gemini');
    expect(safeAcknowledgement('זה יעלה בערך 300 ₪ ליום')).toBe('');
    expect(safeAcknowledgement('ראו https://example.com')).toBe('');
    expect(safeAcknowledgement('נשמע כמו טיול משפחתי מעולה.')).toBe('נשמע כמו טיול משפחתי מעולה.');
  });
});

describe('small talk', () => {
  it('never hands "מה קורה" to a representative, even if the model says so', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields, acknowledgement: 'הכול טוב, תודה!' });
    const result = await getWhatsAppFlowReply('972501234567', 'מה קורה', store);
    expect(result.escalate).toBeFalsy();
    expect(state()?.handedOff).toBeFalsy();
    expect(result.reply).toContain('הכול טוב');
  });
});

describe('questions without a model answer', () => {
  it('answers a branches question during rental intake', async () => {
    const { store } = makeStore({ intent: 'unknown', ...emptyFields });
    await store.saveState('972501234567', { step: 'rental_locations', locale: 'he', pickupDate: '2099-01-01', dropoffDate: '2099-01-05' });
    const result = await getWhatsAppFlowReply('972501234567', 'איזה סניפים?', store);
    expect(result.reply).toContain('סניפים');
    expect(result.reply).not.toContain('לא זיהיתי');
  });
});

describe('questions answered from the website', () => {
  it('answers a general question with the model reply instead of a menu', async () => {
    const { store } = makeStore({ intent: 'policy', ...emptyFields, acknowledgement: 'הפיקדון תלוי בקטגוריה, החל מ־₪1,000 לרכב כלכלי.' });
    const result = await getWhatsAppFlowReply('972501234567', 'כמה הפיקדון?', store);
    expect(result.reply).toContain('₪1,000');
    expect(result.escalate).toBeFalsy();
  });
});

describe('Gemini answers win over keyword routing', () => {
  it('answers "how can I call you?" instead of handing off', async () => {
    const { store, state } = makeStore({ intent: 'representative', ...emptyFields, acknowledgement: 'אפשר להתקשר אלינו ל־09-9509757.' });
    const result = await getWhatsAppFlowReply('972501234567', 'איך אפשר להתקשר אליכם?', store);
    expect(result.escalate).toBeFalsy();
    expect(result.reply).toContain('09-9509757');
    expect(state()?.handedOff).toBeFalsy();
  });

  it('answers a leasing-length question and offers a representative', async () => {
    const { store } = makeStore({ intent: 'leasing', ...emptyFields, acknowledgement: 'תקופות הליסינג הן 12 עד 60 חודשים.' });
    const result = await getWhatsAppFlowReply('972501234567', 'לכמה זמן אפשר ליסינג?', store);
    expect(result.reply).toContain('12 עד 60');
    expect(result.reply).toContain('הצעת ליסינג');
  });

  it('still hands off when a person is asked for explicitly', async () => {
    const { store } = makeStore({ intent: 'representative', ...emptyFields, acknowledgement: 'בשמחה.' });
    const result = await getWhatsAppFlowReply('972501234567', 'אפשר לדבר עם נציג?', store);
    expect(result.escalate).toBe(true);
  });
});
