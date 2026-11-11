import { describe, it, expect } from 'vitest';
import { isValidPhone, normalizePhone, isValidPassport, isValidIdOf } from '@/lib/accident-report/schema';
describe('tourist ids and phones', () => {
  it('phones', () => {
    for (const p of ['050-1234567', '0501234567', '+972501234567', '971503343353', '+44 7700 900123', '0044 7700 900123', '+1 (212) 555-0100'])
      expect(isValidPhone(p), p).toBe(true);
    for (const p of ['050123', '12345', '501234567', '0123', '+1234567890123456'])
      expect(isValidPhone(p), p).toBe(false);
    expect(normalizePhone('971503343353')).toBe('+971503343353');
    expect(normalizePhone('0044 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('050-1234567')).toBe('050-1234567');
  });
  it('ids', () => {
    expect(isValidPassport('0018366')).toBe(true);
    expect(isValidPassport('ab 12-3456')).toBe(true);
    expect(isValidPassport('12')).toBe(false);
    expect(isValidPassport('אבג12345')).toBe(false);
    expect(isValidIdOf('il', '000000018')).toBe(true);
    expect(isValidIdOf('il', '123456789')).toBe(false);
    expect(isValidIdOf('passport', '0018366')).toBe(true);
  });
});
