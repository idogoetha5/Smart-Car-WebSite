import { describe, expect, it, vi } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

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
  it.each([
    ['he', 'לא נרצה כיסא בטיחות לילד בן שלוש.', 'נרצה שני כיסאות בטיחות. בעצם נרצה כיסא בטיחות אחד לילד בן שלוש.'],
    ['en', 'We do not need a child seat for our three-year-old.', 'We would like two child seats. Actually we would like one child seat for our three-year-old.'],
  ] as const)('honours an explicit removal and the latest revised seat count without using child age (%s)', async (locale, removal, revision) => {
    let state = { ...structuredClone(ready), locale, booking: { ...ready.booking, childSeats: 2 } } as RebuildState;
    const create = vi.fn(async () => 'unexpected');
    const store: RebuildStore = { isSimulation: true, loadState: async () => state, saveState: async (_phone, next) => { state = next; }, activeBooking: async () => null, createRentalRequest: create, readTurn: async input => ({ route: 'policy', direction: 'none', reply: '', source: 'gemini', model: 'test', fields: { childSeats: { value: '3', evidence: input } } }) };
    const removed = await getRebuiltBotReply('fictional-seat-correction', removal, store);
    expect(removed.state.booking.childSeats).toBe(0);
    expect(removed.reply).not.toMatch(/Requested child seats: 2|בקשת כיסאות בטיחות: 2/);
    const revised = await getRebuiltBotReply('fictional-seat-correction', revision, store);
    expect(revised.state.booking.childSeats).toBe(1);
    expect(revised.reply).toMatch(/Requested child seats: 1|בקשת כיסאות בטיחות: 1/);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    {
      locale: 'he' as const,
      start: 'אני רוצה לשכור רכב משפחתי מ-10/12 עד 14/12, איסוף מהרצליה והחזרה בתל אביב. אני בן 35.',
      name: 'השם הוא דניאל בדיקה', correction: 'בעצם החזרה בהרצליה במקום תל אביב.',
      seats: 'לפני שליחה, נרצה כיסא בטיחות אחד לילד בן שלוש. זה מובטח? והמחיר כבר סופי? עוד אל תשלח.',
      confirm: 'אני מאשר', expected: 'בקשת כיסאות בטיחות: 1',
    },
    {
      locale: 'en' as const,
      start: 'I want to rent a family car 10/12-14/12, pickup in Herzliya and return in Tel Aviv. I am 35.',
      name: 'My name is Alex Test', correction: 'Actually return in Herzliya instead of Tel Aviv.',
      seats: 'Before sending, we would like one child seat for our three-year-old. Is it guaranteed, and is the price final? Do not send yet.',
      confirm: 'I confirm', expected: 'Requested child seats: 1',
    },
  ])('retains a future-want child-seat request in the summary and persists it only after consent ($locale)', async scenario => {
    db.rows.clear(); db.writes.length = 0;
    let state: RebuildState | null = null;
    const create = vi.fn(persistentRebuildStore.createRentalRequest);
    const store: RebuildStore = {
      isSimulation: true, loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null, createRentalRequest: create, readTurn: async () => null,
    };
    const send = (message: string) => getRebuiltBotReply('972501234567', message, store);
    await send(scenario.start);
    await send(scenario.name);
    await send(scenario.correction);
    const reviewed = await send(scenario.seats);
    expect(reviewed.state.step).toBe('rental_confirm');
    expect(reviewed.state.booking.childSeats).toBe(1);
    expect(reviewed.reply).toContain(scenario.expected);
    expect(create).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
    const confirmed = await send(scenario.confirm);
    expect(confirmed.state.completedRequestId).toBe('42');
    expect(create).toHaveBeenCalledTimes(1);
    expect(db.writes[0].trip_needs).toContain('1 child seats');
    expect(db.writes[0].trip_needs).not.toContain('3 child seats');
    expect(db.writes[0].status).toBe('PENDING');
    await send(scenario.confirm);
    expect(create).toHaveBeenCalledTimes(1);
  });

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
