import { describe, expect, it } from 'vitest';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';
import { classifyCommercialIntent } from '@/lib/car-sales-flow';
import type { CarForSale } from '@/lib/cars-for-sale';

const PHONE = '972501234567';
const CARS: CarForSale[] = [
  { id: 'corolla', make: 'Toyota', model: 'Corolla', year: 2022, price: 98000, km: 42000, color: 'White', extras: 'Reverse camera', image_url: 'https://images.example/corolla.jpg' },
  { id: 'mazda3', make: 'Mazda', model: '3', year: 2021, price: 87000, km: 51000, color: 'Red', extras: 'Parking sensors', image_url: null },
  { id: 'i10', make: 'Hyundai', model: 'i10', year: 2020, price: 59000, km: null, color: null, extras: null, image_url: null },
];

function salesStore() {
  let state: FlowState | null = null;
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, nextState) => { state = nextState; },
    createRentalRequest: async () => null,
    getCarsForSale: async () => CARS,
  };
  return { store, state: () => state };
}

describe('cars-for-sale WhatsApp conversation', () => {
  it.each([
    ['אני רוצה לקנות רכב', 'purchase_start'],
    ['I want to buy a car', 'purchase_start'],
    ['רכב עד 90000 ש״ח', 'budget'],
    ['compare Toyota Corolla and Mazda 3', 'compare'],
    ['משפחה עם תינוק ומזוודות', 'family_luggage'],
    ['mostly city driving and highway', 'city_highway'],
    ['האם זה היברידי?', 'verified_drive'],
    ['איזו שנת ייצור?', 'year'],
    ['what mileage does it have?', 'mileage'],
    ['מה הצבע והתוספות?', 'color_extras'],
    ['אני לא סומך עליכם', 'trust'],
    ['too expensive', 'too_expensive'],
    ['אני אחשוב על זה', 'thinking'],
    ['a competitor offered less', 'competitor'],
    ['אפשר הנחה?', 'discount'],
    ['אני רוצה לראות את הרכב', 'viewing'],
    ['יש מימון?', 'finance'],
    ['יש לי טרייד אין', 'trade_in'],
    ['מה היסטוריית הטיפולים?', 'history'],
    ['יש אחריות?', 'warranty'],
    ['מה המצב המכני?', 'mechanical'],
    ['אפשר נסיעת מבחן?', 'test_drive'],
    ['מתי האספקה?', 'delivery'],
    ['Toyota Corolla', 'vehicle_selected'],
    ['רכב עד 10000', 'no_match'],
  ] as const)('persists the verified sales action %s', async (message, action) => {
    const memory = salesStore();
    await getWhatsAppFlowReply(PHONE, 'I want to buy a car', memory.store);
    const result = await getWhatsAppFlowReply(PHONE, action === 'purchase_start' ? 'hello' : message, memory.store);
    expect(memory.state()?.carSale?.lastAction).toBe(action);
    expect(result.reply).not.toMatch(/guaranteed|confirmed availability|last one|limited time|מובטח|נותר אחרון|רק היום/i);
  });

  it('shows only verified API fields for a selected vehicle', async () => {
    const memory = salesStore();
    await getWhatsAppFlowReply(PHONE, 'I want to buy a car', memory.store);
    const result = await getWhatsAppFlowReply(PHONE, 'Toyota Corolla', memory.store);
    expect(result.reply).toContain('Toyota Corolla');
    expect(result.reply).toContain('2022');
    expect(result.reply).toContain('98,000');
    expect(result.reply).toContain('42,000');
    expect(result.reply).toContain('White');
    expect(result.reply).toContain('Reverse camera');
    expect(result.reply).not.toMatch(/warranty|service history|inspection|test drive|delivery date/i);
  });

  it('hands off unverified vehicle questions with selected-car context', async () => {
    const memory = salesStore();
    await getWhatsAppFlowReply(PHONE, 'I want to buy a car', memory.store);
    await getWhatsAppFlowReply(PHONE, 'Toyota Corolla', memory.store);
    const result = await getWhatsAppFlowReply(PHONE, 'What is its warranty and service history?', memory.store);
    expect(result.escalate).toBe(true);
    expect(result.reply).toMatch(/not .*verified catalogue data|לא מופיע בנתוני הקטלוג/i);
    expect(result.escalateReason).toContain('corolla');
  });

  it('preserves selected vehicle and budget in a finance handoff', async () => {
    const memory = salesStore();
    await getWhatsAppFlowReply(PHONE, 'I want to buy a car', memory.store);
    await getWhatsAppFlowReply(PHONE, 'רכב עד 100000 ש״ח', memory.store);
    await getWhatsAppFlowReply(PHONE, 'Toyota Corolla', memory.store);
    const result = await getWhatsAppFlowReply(PHONE, 'יש מימון?', memory.store);
    expect(result.escalate).toBe(true);
    expect(result.escalateReason).toContain('corolla');
    expect(result.escalateReason).toContain('תקציב עד ₪100000');
  });

  it.each([
    ['אני צריך רכב', 'rental'],
    ['I want to rent a car', 'rental'],
    ['אני רוצה ליסינג פרטי', 'leasing'],
    ['I need business leasing', 'leasing'],
    ['אני רוצה לקנות רכב', 'car_sale'],
    ['cars for sale please', 'car_sale'],
    ['אני רוצה למכור את הרכב שלי', 'sell_own_car'],
    ['I want to sell my car', 'sell_own_car'],
    ['רכב', 'ambiguous'],
    ['car', 'ambiguous'],
    ['auto', 'ambiguous'],
    ['vehicle', 'ambiguous'],
  ] as const)('separates commercial intent: %s', (message, expected) => {
    expect(classifyCommercialIntent(message)).toBe(expected);
  });

  it.each([
    ['רכב', 'השכרה'],
    ['car', 'rent'],
    ['אני רוצה למכור את הרכב שלי', 'נציג'],
    ['I want to sell my car', 'representative'],
  ])('asks or hands off safely for ambiguous commercial requests: %s', async (message, expected) => {
    const memory = salesStore();
    const result = await getWhatsAppFlowReply(PHONE, message, memory.store);
    expect(result.reply).toContain(expected);
  });

  it('asks only for the missing leasing type, then hands it off with context', async () => {
    const memory = salesStore();
    const first = await getWhatsAppFlowReply(PHONE, 'אני רוצה ליסינג', memory.store);
    expect(first.escalate).not.toBe(true);
    expect(first.reply).toContain('ליסינג פרטי או בליסינג עסקי');
    const second = await getWhatsAppFlowReply(PHONE, 'ליסינג עסקי', memory.store);
    expect(second.escalate).toBe(true);
    expect(second.escalateReason).toContain('ליסינג עסקי');
    expect(second.reply).not.toMatch(/₪|מחיר.*מובטח|זמין|אספקה.*מובטח/i);
  });

  it('hands an explicit English leasing request off without creating commercial terms', async () => {
    const memory = salesStore();
    const result = await getWhatsAppFlowReply(PHONE, 'I need business leasing', memory.store);
    expect(result.escalate).toBe(true);
    expect(result.escalateReason).toContain('ליסינג עסקי');
    expect(result.reply).toContain('business leasing');
    expect(result.reply).not.toMatch(/approved|guaranteed|available now|monthly payment/i);
  });
});
