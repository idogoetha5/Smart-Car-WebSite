import { describe, expect, it } from 'vitest';
import { carAdvice, isExploringRental } from '@/lib/whatsapp-advisor';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

describe('local backup coaching', () => {
  it('helps a hesitant family compare costs and child-seat arrangements without a booking prompt', () => {
    const text = 'אנחנו זוג עם תינוק ועגלה, שתי נסיעות בעיר. מתלבט אם בכלל לשכור, מה חשוב לבדוק?';
    expect(isExploringRental(text)).toBe(true);
    const reply = carAdvice(text, { passengers: 3 }, 'he');
    expect(reply).toContain('מושב בטיחות');
    expect(reply).toContain('העלות הכוללת');
    expect(reply).not.toMatch(/משתלם כש|תאריך|\?/);
  });
  it('answers visitor preparation without promising licence eligibility', () => {
    const text = 'I am visiting for a week and have a Canadian licence. What should I check before deciding to rent? No booking yet.';
    const reply = carAdvice(text, {}, 'en');
    expect(isExploringRental(text)).toBe(true);
    expect(reply).toContain('does not establish eligibility');
    expect(reply).toContain('deposit');
    expect(reply).not.toMatch(/pick.*up|https?:|[א-ת]/);
  });

  it('answers a family/SUV comparison without asking for the known passenger count', () => {
    const reply = carAdvice('אנחנו זוג עם תינוק ועגלה, מתלבטים בין משפחתית לגיפון. מה עדיף?', {}, 'he');
    expect(reply).toContain('תלויים בדגם');
    expect(reply).not.toContain('כמה תהיו');
    expect(reply).not.toContain('תאריכ');
  });
  it('does not rank fuel consumption categorically', () => {
    const reply = carAdvice('ומה יותר חסכוני בדלק?', {}, 'he');
    expect(reply).toContain('תלויה בדגם');
    expect(reply?.match(/\?/g)).toHaveLength(1);
    expect(reply).not.toContain('הכי חסכוני בדלק זה');
  });
  it('gives the same qualified comparison in English', () => {
    const reply = carAdvice('family car versus SUV, which is better with a baby and stroller?', {}, 'en');
    expect(reply).toContain('actual model');
    expect(reply).not.toMatch(/[א-ת]/);
  });
});

describe('backup exploration through the actual conversation controller', () => {
  it.each([
    ['אנחנו זוג עם תינוק ועגלה, שתי נסיעות בעיר. מתלבט אם בכלל לשכור, מה חשוב לבדוק?', 'מושב בטיחות'],
    ['I am visiting for a week and have a Canadian licence. What should I check before deciding to rent? No booking yet.', 'does not establish eligibility'],
  ])('answers the decision before asking for booking details: %s', async (message, expected) => {
    let state: FlowState | null = null;
    const store: WhatsAppFlowStore = {
      engine: 'local', activeBooking: async () => null, loadState: async () => state,
      saveState: async (_, next) => { state = next; },
      createRentalRequest: async () => { throw new Error('No booking consent'); },
      interpretMessage: async () => { throw new Error('Local backup must not call AI'); },
    };
    const result = await getWhatsAppFlowReply('exploration-test', message, store);
    expect(result.reply).toContain(expected);
    expect(result.reply).not.toMatch(/מאיזה תאריך|When would you|https?:|העברתי/);
    expect(result.escalate).not.toBe(true);
  });
});
