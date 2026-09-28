import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export type DialOption = { code: CountryCode; dial: string; name: string };

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'IL';

export function isSupportedPhoneCountry(code: string): code is CountryCode {
  return (getCountries() as string[]).includes(code);
}

/** Every country with its calling code, named in the form's language; Israel first. */
export function dialOptions(locale: 'he' | 'en'): DialOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }
  const options = getCountries().map((code) => ({
    code,
    dial: `+${getCountryCallingCode(code)}`,
    name: names?.of(code) ?? code,
  }));
  options.sort((a, b) => a.name.localeCompare(b.name, locale));
  const israel = options.findIndex((option) => option.code === DEFAULT_PHONE_COUNTRY);
  if (israel > 0) options.unshift(...options.splice(israel, 1));
  return options;
}

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

/**
 * Joins the chosen country prefix and the rest of the number into E.164
 * ("+447911123456"). A leading 0 (trunk prefix) is dropped; a number the
 * customer typed with its own "+" is taken as already international.
 */
export function composeInternationalPhone(country: CountryCode, national: string): string {
  const trimmed = national.trim();
  if (trimmed.startsWith('+')) {
    const international = parsePhoneNumberFromString(trimmed);
    return international ? international.number : trimmed.replace(/[^\d+]/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  const parsed = parsePhoneNumberFromString(digits, country);
  if (parsed) return parsed.number;
  return `+${getCountryCallingCode(country)}${digits.replace(/^0+/, '')}`;
}
