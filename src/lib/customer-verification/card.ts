/**
 * Card details for customer verification.
 *
 * Shared by the customer form (validation, formatting) and the server
 * (validation again, before encrypting). CVV is deliberately absent: it is
 * never collected or stored. Later charges (Route 6, fines) are made
 * without the card present and do not need it.
 */

export const digitsOnly = (s: string) => s.replace(/\D/g, '');

/** Luhn checksum, the check digit every Visa/Mastercard/Isracard/Amex number carries. */
export function luhnValid(raw: string): boolean {
  const d = digitsOnly(raw);
  if (d.length < 8 || d.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'diners' | 'isracard' | 'other';

export function cardBrand(raw: string): CardBrand {
  const d = digitsOnly(raw);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^3(0[0-5]|[68])/.test(d)) return 'diners';
  // Local Isracard numbers are 8–9 digits and do not follow the global prefixes.
  if (d.length === 8 || d.length === 9) return 'isracard';
  return 'other';
}

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  diners: 'Diners',
  isracard: 'ישראכרט',
  other: 'כרטיס',
};

/** "4580 1234 5678 9012" – groups of four as the customer types. */
export function formatCardNumber(raw: string): string {
  return digitsOnly(raw).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Card is still valid at the end of the stated month. */
export function expiryValid(month: string, year: string, now = new Date()): boolean {
  const m = Number(month);
  let y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y)) return false;
  if (y < 100) y += 2000;
  if (y > now.getFullYear() + 20) return false;
  const endOfMonth = new Date(y, m, 1); // first day of the following month
  return endOfMonth > now;
}

export function maskCard(last4: string | null | undefined): string {
  return last4 ? `•••• ${last4}` : '—';
}

export const CONSENT_VERSION = '2026-11-v1';
