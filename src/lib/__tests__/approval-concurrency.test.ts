import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'database/migrations/20261118091500_admin_booking_approval_owner_decision.sql'), 'utf8');

describe('office booking approval', () => {
  it('does not reject approval because of overlapping bookings or online unit counts', () => {
    expect(migration).toContain("UPDATE bookings SET status = 'CONFIRMED'");
    expect(migration).not.toMatch(/total_units|v_conflicts\s*>=|NO_UNITS/);
  });

  it('serializes retries on the booking and reports an existing confirmation', () => {
    expect(migration).toMatch(/WHERE b\.id = p_booking_id\s+FOR UPDATE/);
    expect(migration).toContain("IF v_status = 'CONFIRMED' THEN");
    expect(migration).toContain("'ALREADY_CONFIRMED'::TEXT");
  });

  it('keeps approval available only to the server service role', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION approve_booking(TEXT) FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION approve_booking(TEXT) TO service_role');
  });
});
