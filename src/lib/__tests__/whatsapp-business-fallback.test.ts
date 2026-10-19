import { describe, expect, it, vi } from 'vitest';
import { getBusinessKnowledgeResponse } from '@/lib/whatsapp-business-knowledge';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

describe('business knowledge without a model', () => {
  it.each([
    ['כמה עולה ביטול השתתפות עצמית?', 'he', 'Type A'],
    ['What does CDW cover?', 'en', 'Type A'],
    ['אפשר לעשן ברכב?', 'he', '₪500'], ['Can I smoke?', 'en', '₪500'],
    ['אפשר לנסוע לירדן?', 'he', 'בכתב'], ['Can I cross the border?', 'en', 'written'],
    ['מה לגבי דוחות חניה?', 'he', 'השוכר'], ['Who pays parking tickets?', 'en', 'renter'],
    ['האם אפשר להשתמש ברכב עבור Uber?', 'he', 'אסור'], ['Can I drive a taxi?', 'en', 'prohibit'],
    ['מה לא מכוסה בביטוח?', 'he', 'חריגים'], ['What are the insurance exclusions?', 'en', 'exclusions'],
    ['מה קורה בביטול ליסינג?', 'he', 'שלושה'], ['Early termination of leasing?', 'en', 'three'],
    ['מה קורה בביטול עקב מלחמה?', 'he', 'זיכוי'], ['What about force majeure?', 'en', 'credit'],
    ['מה המייל שלכם?', 'he', 'office@smartcar.co.il'], ['What is your email?', 'en', 'office@smartcar.co.il'],
    ['כמה זמן תקופת ליסינג?', 'he', '60'], ['What leasing terms are there?', 'en', '60'],
    ['מי הקים את החברה?', 'he', '2003'], ['Who founded SmartCar?', 'en', '2003'],
    ['מה מדיניות הפרטיות?', 'he', 'פרטיות'], ['What is your privacy policy?', 'en', 'Privacy'],
    ['יש לכם סניף בחיפה?', 'he', 'לא סניף'], ['Do you have a branch in Haifa?', 'en', 'not a physical branch'],
  ] as const)('answers %s from approved facts', (input, locale, expected) => {
    expect(getBusinessKnowledgeResponse(input, locale)?.reply).toContain(expected);
  });

  it('answers independent questions, not just the first matching keyword', () => {
    const reply = getBusinessKnowledgeResponse('מה מדיניות הדלק? מה הקילומטראז׳? אפשר לעשן?', 'he');
    expect(reply?.reply).toContain('מלא־מלא');
    expect(reply?.reply).toContain('200');
    expect(reply?.reply).toContain('₪500');
  });

  it('retains a published opening-hours topic for a short follow-up', () => {
    expect(getBusinessKnowledgeResponse('ובשישי?', 'he', 'opening_hours')?.reply).toContain('08:30');
    expect(getBusinessKnowledgeResponse('And on Friday?', 'en', 'opening_hours')?.reply).toContain('08:30');
  });

  it('does not answer arbitrary unknown questions or invent unsupported facts', () => {
    expect(getBusinessKnowledgeResponse('What is your helicopter registration?', 'en')).toBeNull();
  });
});

function memoryStore() {
  let state: FlowState | null = null;
  const createRentalRequest = vi.fn(async () => 'TEST-REQUEST');
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null, loadState: async () => state,
    saveState: async (_phone, next) => { state = next; },
    interpretMessage: async () => { throw new Error('provider offline'); },
    createRentalRequest,
  };
  return { store, current: () => state, createRentalRequest };
}

describe('provider failure does not stop a conversation', () => {
  it.each(['he', 'en'] as const)('answers a question in %s and preserves the next missing booking field', async (locale) => {
    const { store, current, createRentalRequest } = memoryStore();
    await store.saveState('test', { step: 'rental_locations', locale, pickupDate: '2099-12-10', dropoffDate: '2099-12-15' });
    const result = await getWhatsAppFlowReply('test', locale === 'he' ? 'אפשר לעשן ברכב?' : 'Can I smoke in the car?', store);
    expect(result.reply).toContain('₪500');
    expect(result.escalate).toBeFalsy();
    expect(current()).toMatchObject({ step: 'rental_locations', pickupDate: '2099-12-10', dropoffDate: '2099-12-15' });
    expect(createRentalRequest).not.toHaveBeenCalled();
    await getWhatsAppFlowReply('test', locale === 'he' ? 'הרצליה | ירושלים' : 'Herzliya | Jerusalem', store);
    expect(current()?.step).toBe('rental_vehicle');
  });

  it('still prioritises an explicit human request over policy information', async () => {
    const { store } = memoryStore();
    const result = await getWhatsAppFlowReply('test', 'אני רוצה לדבר עם נציג לגבי הביטוח', store);
    expect(result.escalate).toBe(true);
  });
});
