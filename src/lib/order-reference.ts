/**
 * Stable, customer-facing order reference: six digits.
 *
 * Database identifiers are UUIDs and can contain letters. Customers read this
 * number back over the phone, so it is short and numeric, and the same booking
 * must always receive the same number in the request, confirmation and
 * cancellation emails and in the payment link. Six digits means two bookings
 * can eventually share a reference; nothing is ever looked up by it, so the
 * cost is a rare ambiguity at the desk rather than a wrong record.
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

  return String(hash >>> 0).padStart(8, '0').slice(-6);
}
