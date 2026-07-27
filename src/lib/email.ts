/**
 * The single email normalization strategy for the whole app.
 *
 * Used both when storing a customer's email and when looking their
 * bookings up, so the two always agree and lookups can use an exact
 * `.eq()` match instead of a pattern match (`ilike` gives `%` and `_`
 * wildcard meaning, which let a crafted address widen the match to other
 * customers' bookings).
 *
 * Deliberately conservative: trims surrounding whitespace and lowercases.
 * It does NOT strip plus-tags or dots — `a+b@x.com` and `a@x.com` are
 * different mailboxes at many providers, and treating them as one would
 * let someone reach another person's bookings.
 */
export function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

/** True when the value is a syntactically usable email address. */
export function isValidEmail(email: string): boolean {
  const v = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
