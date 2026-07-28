/**
 * Booking rules that the API route actually uses.
 *
 * These lived only inside the test file, where `canSubmitRequest()` was a
 * local stub returning `true` while the real route was still answering 409 for
 * an unavailable vehicle. The suite passed while proving the opposite of
 * production. Exporting them here means the route and the tests exercise one
 * implementation, so that cannot recur.
 */

/**
 * Whether a request needs a human to match it against the full fleet.
 *
 * `vehicleIsAvailable` reflects the online catalogue only, which holds part of
 * the fleet. A false value means "the website could not match this", never
 * "no such vehicle exists" — so it flags the request, it does not reject it.
 *
 * Derived server-side. The browser may also ask for a manual match, but it can
 * only ever add the flag, never suppress one the server decided on.
 */
export function requiresManualMatch(
  vehicleIsAvailable: boolean | null | undefined,
  clientRequestedManualMatch = false,
): boolean {
  return vehicleIsAvailable === false || clientRequestedManualMatch === true;
}

/** The stored value for the manual-match flag, or null when no match is needed. */
export function matchStatusFor(
  vehicleIsAvailable: boolean | null | undefined,
  clientRequestedManualMatch = false,
): 'MANUAL_MATCH_REQUIRED' | null {
  return requiresManualMatch(vehicleIsAvailable, clientRequestedManualMatch)
    ? 'MANUAL_MATCH_REQUIRED'
    : null;
}

/**
 * A booking submission is a REQUEST, never a reservation. No availability
 * outcome may block it — the real gate is admin approval, which re-checks
 * conflicts against total_units atomically via the approve_booking RPC.
 *
 * This exists so the guarantee is stated in one place the route depends on,
 * rather than as a comment that the code beneath it can quietly contradict.
 */
export function canSubmitRequest(): true {
  return true;
}
