/**
 * Israel-local calendar-day boundaries, in UTC ISO strings suitable for a
 * `.gte()/.lt()` range query against a TIMESTAMPTZ column. bookings.pickup_date
 * is an instant, not a date — a naive string-prefix compare would put the
 * boundary at UTC midnight, which is 2-3 hours off from an actual Israel
 * calendar day depending on daylight saving.
 *
 * No date library dependency: resolves the real UTC offset for the given
 * day via Intl (correct across DST transitions) rather than hardcoding
 * +2/+3.
 */

const TIME_ZONE = 'Asia/Jerusalem';

function zonedMidnightToUtc(dateStr: string): Date {
  const naiveUtc = new Date(`${dateStr}T00:00:00Z`);
  const asZoned = new Date(naiveUtc.toLocaleString('en-US', { timeZone: TIME_ZONE }));
  const asUtc = new Date(naiveUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asUtc.getTime() - asZoned.getTime();
  return new Date(naiveUtc.getTime() + offsetMs);
}

/** Today's date in Israel, as YYYY-MM-DD. */
export function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** [startISO, endISO) covering one Israel calendar day. */
export function israelDayRange(dateStr: string): { startISO: string; endISO: string } {
  const start = zonedMidnightToUtc(dateStr);
  const end = zonedMidnightToUtc(addDays(dateStr, 1));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function israelTomorrow(): string {
  return addDays(israelToday(), 1);
}
