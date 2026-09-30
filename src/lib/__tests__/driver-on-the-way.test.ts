import { describe, expect, it } from 'vitest';
import { onTheWayLink, onTheWayMessage, toWhatsAppNumber } from '../driver-on-the-way';

describe('toWhatsAppNumber', () => {
  it('converts Israeli numbers', () => {
    expect(toWhatsAppNumber('052-953-2231')).toBe('972529532231');
    expect(toWhatsAppNumber('+972 52 953 2231')).toBe('972529532231');
    expect(toWhatsAppNumber('00972529532231')).toBe('972529532231');
  });
  it('rejects empty/short', () => {
    expect(toWhatsAppNumber('')).toBe('');
    expect(toWhatsAppNumber('123')).toBe('');
  });
});

describe('onTheWayMessage', () => {
  it('handover: first name, driver, car, 60 minutes', () => {
    const m = onTheWayMessage({ customerName: 'ישראל ישראלי', driverName: 'עידו', vehicleName: 'טויוטה קורולה', type: 'pickup' });
    expect(m).toContain('שלום ישראל,');
    expect(m).toContain('כאן עידו');
    expect(m).toContain('עם הטויוטה קורולה');
    expect(m).toContain('עד 60 דקות');
    expect(m).toContain('רישיון נהיגה');
  });
  it('return wording', () => {
    const m = onTheWayMessage({ customerName: 'דנה', type: 'return' });
    expect(m).toContain('לאסוף את');
    expect(m).toContain('חפצים אישיים');
  });
  it('builds a wa.me link', () => {
    expect(onTheWayLink('0529532231', 'hi')).toBe('https://wa.me/972529532231?text=hi');
    expect(onTheWayLink('', 'hi')).toBeNull();
  });
});
