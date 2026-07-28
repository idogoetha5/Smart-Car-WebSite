import { createHash } from 'crypto';

/**
 * Canonical consent wording, held server-side.
 *
 * Two problems this fixes.
 *
 * The booking route hashed the Hebrew sentence unconditionally, so a customer
 * who used the English form got a ledger entry proving wording they never saw.
 * The record has to match the screen or it evidences the wrong thing.
 *
 * The newsletter route stored `consentText` and `consentVersion` exactly as
 * the browser sent them. Anyone could POST arbitrary text and it would be
 * filed as the customer's agreement — which makes the whole ledger worthless
 * as evidence, since a forged entry is indistinguishable from a real one.
 *
 * So the text is never accepted from the client. The server picks it by
 * verified locale and hashes its own copy.
 *
 * These strings MUST match what the forms render verbatim. The hash is
 * evidence of the exact sentence displayed, so drift between the two makes
 * the ledger prove a sentence nobody agreed to.
 */

export const TERMS_VERSION = '2.0';
export const MARKETING_VERSION = '1.0';

type Locale = 'he' | 'en';

const TERMS_TEXT: Record<Locale, string> = {
  he: 'קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות של SmartCar.',
  en: "I have read and agree to SmartCar's Terms of Use and Privacy Policy.",
};

const MARKETING_TEXT: Record<Locale, string> = {
  he: 'אני מאשר/ת לקבל מ־SmartCar עדכונים והצעות בדוא״ל. אפשר לבטל את ההרשמה בכל עת.',
  en: 'I agree to receive updates and offers from SmartCar by email. You can unsubscribe at any time.',
};

const sha256 = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex');

/** Anything that is not a locale we actually serve falls back to Hebrew. */
export function normalizeLocale(raw: unknown): Locale {
  return String(raw ?? '').slice(0, 5).toLowerCase().startsWith('en') ? 'en' : 'he';
}

export interface ConsentRecord {
  locale: Locale;
  version: string;
  text: string;
  hash: string;
}

export function termsConsent(rawLocale: unknown): ConsentRecord {
  const locale = normalizeLocale(rawLocale);
  const text = TERMS_TEXT[locale];
  return { locale, version: TERMS_VERSION, text, hash: sha256(`${TERMS_VERSION}|${text}`) };
}

export function marketingConsent(rawLocale: unknown): ConsentRecord {
  const locale = normalizeLocale(rawLocale);
  const text = MARKETING_TEXT[locale];
  return { locale, version: MARKETING_VERSION, text, hash: sha256(text) };
}
