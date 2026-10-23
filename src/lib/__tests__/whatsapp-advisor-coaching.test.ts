import { describe, expect, it } from 'vitest';
import { carAdvice } from '@/lib/whatsapp-advisor';

describe('local backup coaching', () => {
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
