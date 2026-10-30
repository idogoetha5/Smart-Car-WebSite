import { describe, expect, it, vi } from 'vitest';
import type { RebuildState } from '@/lib/whatsapp-rebuild';

const db = vi.hoisted(() => ({ rows: new Map<string, { id: number; phone: string }>(), writes: [] as Record<string, unknown>[] }));
vi.mock('@/lib/rental-quote', () => ({ normalizeWhatsAppPhone: (phone: string) => phone }));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => {
        db.writes.push(row);
        const key = String(row.request_key);
        if (db.rows.has(key)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        const record = { id: 42, phone: String(row.phone) };
        db.rows.set(key, record);
        return { data: { id: record.id }, error: null };
      } }) }),
      select: () => ({ eq: (_column: string, key: string) => ({ maybeSingle: async () => ({ data: db.rows.get(key) ?? null, error: null }) }) }),
    }),
  }),
}));

import { persistentRebuildStore } from '@/lib/whatsapp-rebuild-store';

const ready: RebuildState = {
  version: 2, phase: 'booking', step: 'rental_confirm', locale: 'he', history: [],
  requestKey: '6d211623-0338-48ea-ad93-482e477ff4b2',
  booking: {
    pickupDate: '2026-11-10', returnDate: '2026-11-13',
    pickupLocation: 'הרצליה', returnLocation: 'הרצליה',
    vehicleNeed: 'רכב קטן', driverAgeRange: '24-plus', customerName: 'לקוח בדיקה',
  },
};

describe('rebuilt rental request persistence', () => {
  it('returns the same request for a retry with the same persisted draft key', async () => {
    db.rows.clear(); db.writes.length = 0;
    expect(await persistentRebuildStore.createRentalRequest('972501234567', ready)).toBe('42');
    expect(await persistentRebuildStore.createRentalRequest('972501234567', ready)).toBe('42');
    expect(db.rows.size).toBe(1);
    expect(db.writes.map(row => row.request_key)).toEqual([ready.requestKey, ready.requestKey]);
    expect(db.writes.map(row => row.driver_age_range)).toEqual(['24-plus', '24-plus']);
    expect(db.writes.map(row => row.phone)).toEqual(['972501234567', '972501234567']);
    expect(db.writes.map(row => row.customer_email)).toEqual([null, null]);
    expect(db.writes.every(row => !('pickup_time' in row) && !('return_time' in row))).toBe(true);
  });

  it('will not save a request without the required driver age group', async () => {
    db.writes.length = 0;
    const missingAge = structuredClone(ready);
    delete missingAge.booking.driverAgeRange;
    expect(await persistentRebuildStore.createRentalRequest('972501234567', missingAge)).toBeNull();
    expect(db.writes).toHaveLength(0);
  });
});
