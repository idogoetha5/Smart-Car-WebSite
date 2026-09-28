import { describe, expect, it } from 'vitest';
import { composeInternationalPhone, dialOptions, flagEmoji, isSupportedPhoneCountry } from '@/lib/phone-prefix';
import { isValidInternationalPhone } from '@/lib/validations';

describe('composeInternationalPhone', () => {
  it('drops the local leading zero after the country prefix', () => {
    expect(composeInternationalPhone('IL', '050-123-4567')).toBe('+972501234567');
    expect(composeInternationalPhone('GB', '07911 123456')).toBe('+447911123456');
  });

  it('keeps a number already typed with its own +', () => {
    expect(composeInternationalPhone('IL', '+44 7911 123456')).toBe('+447911123456');
  });

  it('returns an empty string for an empty number', () => {
    expect(composeInternationalPhone('IL', '  ')).toBe('');
  });

  it('produces numbers the server-side validation accepts', () => {
    expect(isValidInternationalPhone(composeInternationalPhone('US', '(212) 555-0123'))).toBe(true);
    expect(isValidInternationalPhone(composeInternationalPhone('IL', '0501234567'))).toBe(true);
  });
});

describe('dialOptions', () => {
  it('lists Israel first with its calling code', () => {
    const options = dialOptions('he');
    expect(options[0]).toMatchObject({ code: 'IL', dial: '+972' });
    expect(options.length).toBeGreaterThan(200);
  });
});

describe('helpers', () => {
  it('builds a flag from a country code', () => {
    expect(flagEmoji('IL')).toBe('🇮🇱');
    expect(flagEmoji('x')).toBe('');
  });

  it('recognises supported countries', () => {
    expect(isSupportedPhoneCountry('GB')).toBe(true);
    expect(isSupportedPhoneCountry('ZZ')).toBe(false);
  });
});
