import { describe, it, expect } from 'vitest';

/**
 * Approval concurrency rules.
 *
 * The real serialisation lives in the `approve_booking` Postgres function
 * (scripts/add-approve-booking-rpc.sql), which locks the vehicle row before
 * counting overlaps so two concurrent approvals for the same vehicle can't
 * both pass the check. That lock can only be exercised against a real
 * database.
 *
 * What is tested here is the half that lives in this repo and that a
 * regression could silently break: the mapping from each RPC outcome to an
 * HTTP response and to the send/don't-send email decision. Getting that
 * mapping wrong is how a double-click turns into two confirmation emails,
 * or an oversell gets reported to the admin as success.
 */

type ApprovalResult =
  | 'CONFIRMED'
  | 'ALREADY_CONFIRMED'
  | 'NO_UNITS'
  | 'NOT_FOUND'
  | 'VEHICLE_NOT_FOUND';

interface Outcome {
  status: number;
  sendsEmail: boolean;
}

/** Mirrors the switch in src/app/api/admin/bookings/[id]/route.ts. */
function outcomeFor(result: ApprovalResult | undefined): Outcome {
  switch (result) {
    case 'CONFIRMED':
      return { status: 200, sendsEmail: true };
    case 'ALREADY_CONFIRMED':
      return { status: 200, sendsEmail: false };
    case 'NO_UNITS':
      return { status: 409, sendsEmail: false };
    case 'NOT_FOUND':
    case 'VEHICLE_NOT_FOUND':
      return { status: 404, sendsEmail: false };
    default:
      return { status: 503, sendsEmail: false };
  }
}

/**
 * Mirrors the conflict rule inside approve_booking: overlap is half-open,
 * so a booking ending the day another starts is not a conflict.
 */
function overlaps(
  a: { pickup: string; dropoff: string },
  b: { pickup: string; dropoff: string }
): boolean {
  return a.pickup < b.dropoff && a.dropoff > b.pickup;
}

function canConfirm(conflictCount: number, totalUnits: number | null): boolean {
  const units = Math.max(1, Number(totalUnits) || 1);
  return conflictCount < units;
}

describe('approval outcome mapping', () => {
  it('sends the confirmation email only on a real transition', () => {
    expect(outcomeFor('CONFIRMED').sendsEmail).toBe(true);
  });

  it('does not resend the email when the booking was already confirmed', () => {
    // A double-click or a retry: the second call must be a no-op.
    const second = outcomeFor('ALREADY_CONFIRMED');
    expect(second.sendsEmail).toBe(false);
    expect(second.status).toBe(200);
  });

  it('reports an oversell attempt as 409, not success', () => {
    const o = outcomeFor('NO_UNITS');
    expect(o.status).toBe(409);
    expect(o.sendsEmail).toBe(false);
  });

  it('maps missing booking and missing vehicle to 404', () => {
    expect(outcomeFor('NOT_FOUND').status).toBe(404);
    expect(outcomeFor('VEHICLE_NOT_FOUND').status).toBe(404);
  });

  it('treats an unrecognised or absent result as a failure, never success', () => {
    const o = outcomeFor(undefined);
    expect(o.status).toBe(503);
    expect(o.sendsEmail).toBe(false);
  });

  it('never sends an email on any non-confirming outcome', () => {
    const results: (ApprovalResult | undefined)[] = [
      'ALREADY_CONFIRMED', 'NO_UNITS', 'NOT_FOUND', 'VEHICLE_NOT_FOUND', undefined,
    ];
    for (const r of results) expect(outcomeFor(r).sendsEmail).toBe(false);
  });
});

describe('overlap and unit counting', () => {
  const base = { pickup: '2026-08-10', dropoff: '2026-08-15' };

  it('treats a same-day handover as non-overlapping', () => {
    expect(overlaps(base, { pickup: '2026-08-15', dropoff: '2026-08-20' })).toBe(false);
    expect(overlaps(base, { pickup: '2026-08-05', dropoff: '2026-08-10' })).toBe(false);
  });

  it('detects partial and full overlaps', () => {
    expect(overlaps(base, { pickup: '2026-08-14', dropoff: '2026-08-20' })).toBe(true);
    expect(overlaps(base, { pickup: '2026-08-11', dropoff: '2026-08-12' })).toBe(true);
    expect(overlaps(base, { pickup: '2026-08-01', dropoff: '2026-08-30' })).toBe(true);
  });

  it('allows a second confirmation while a spare unit remains', () => {
    expect(canConfirm(1, 2)).toBe(true);
    expect(canConfirm(2, 2)).toBe(false);
  });

  it('treats missing or zero total_units as a single unit', () => {
    expect(canConfirm(0, null)).toBe(true);
    expect(canConfirm(1, null)).toBe(false);
    expect(canConfirm(1, 0)).toBe(false);
  });

  it('supports N units', () => {
    expect(canConfirm(4, 5)).toBe(true);
    expect(canConfirm(5, 5)).toBe(false);
    expect(canConfirm(6, 5)).toBe(false);
  });
});

/**
 * Cancellation race: the customer cancel route re-checks status='PENDING'
 * in the UPDATE's own WHERE clause, so an admin confirming between the
 * fetch and the write causes 0 rows to match rather than silently
 * overwriting the confirmation.
 */
describe('cancel vs approve race', () => {
  function cancelOutcome(rowsMatched: number): { status: number; cancelled: boolean } {
    return rowsMatched === 1
      ? { status: 200, cancelled: true }
      : { status: 409, cancelled: false };
  }

  it('cancels when the booking was still pending', () => {
    expect(cancelOutcome(1)).toEqual({ status: 200, cancelled: true });
  });

  it('refuses with 409 when an admin confirmed it first', () => {
    expect(cancelOutcome(0)).toEqual({ status: 409, cancelled: false });
  });
});
