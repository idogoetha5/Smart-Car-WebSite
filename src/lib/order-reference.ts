/**
 * Stable, customer-facing order reference.
 *
 * Database identifiers are UUIDs and can contain letters. Email templates
 * should show a classic numeric reference, while the same booking must always
 * receive the same number in request, confirmation and cancellation emails.
 */
export function numericOrderReference(value: string): string {
  // Normalized first: the same booking id reaches this function lower-cased
  // from the database and upper-cased from older call sites, and the customer
  // must never be quoted two different numbers for one booking.
  const subject = String(value).trim().toLowerCase();

  let hash = 2_166_136_261;
  for (const character of subject) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return String(hash >>> 0).padStart(10, '0').slice(-8);
}
