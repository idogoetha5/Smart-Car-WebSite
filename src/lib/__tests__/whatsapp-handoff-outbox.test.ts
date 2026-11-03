import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchHandoffEmail, enqueueHandoffEmail, retryHandoffEmail } from '@/lib/whatsapp-handoff-outbox';
import { getRebuiltBotReply, type RebuildStore } from '@/lib/whatsapp-rebuild';

const fixture = vi.hoisted(() => ({
  tables: { email_outbox: new Map<string, Record<string, unknown>>(), email_deliveries: new Map<string, Record<string, unknown>>() },
  fail: '', send: vi.fn(), sms: vi.fn(), incident: vi.fn(),
}));

// A small in-memory database models conditional updates atomically, including
// zero rows when another worker already changed the lease. No network/DB writes.
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: (table: keyof typeof fixture.tables) => {
  const rows = fixture.tables[table];
  if (!rows) throw new Error(`Unexpected table ${table}`);
  let operation = 'select';
  let fields: Record<string, unknown> = {};
  let ignoreDuplicates = false;
  const filters: Array<[string, unknown]> = [];
  const execute = () => {
    if (fixture.fail === `${table}:${operation}`) {
      fixture.fail = '';
      return { data: null, error: { message: 'injected database interruption' } };
    }
    if (operation === 'upsert') {
      const key = String(fields.idempotency_key);
      if (!ignoreDuplicates || !rows.has(key)) {
        rows.set(key, { ...(table === 'email_outbox' ? { status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString() } : {}), ...rows.get(key), ...structuredClone(fields) });
      }
      return { data: null, error: null };
    }
    const matches = [...rows.values()].filter(row => filters.every(([column, value]) => row[column] === value));
    if (operation === 'update') matches.forEach(row => Object.assign(row, structuredClone(fields)));
    if (operation === 'delete') matches.forEach(row => rows.delete(String(row.idempotency_key)));
    return { data: matches.length ? structuredClone(matches[0]) : null, error: null };
  };
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return query; },
    upsert: (values: Record<string, unknown>, options?: { ignoreDuplicates?: boolean }) => { operation = 'upsert'; fields = values; ignoreDuplicates = Boolean(options?.ignoreDuplicates); return query; },
    update: (values: Record<string, unknown>) => { operation = 'update'; fields = values; return query; },
    delete: () => { operation = 'delete'; return query; },
    maybeSingle: async () => execute(),
    then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
  };
  return query;
} }) }));
vi.mock('@/lib/whatsapp-incidents', () => ({ sendHandoffEmail: fixture.send, reportBotIncident: fixture.incident }));
vi.mock('@/lib/sms-alert', () => ({ sendEscalationSms: fixture.sms }));

const PHONE = '972500000001';
const MESSAGE = 'fictional-wamid-handoff';
const firstRow = () => [...fixture.tables.email_outbox.values()][0];
function store(extra: Partial<RebuildStore> = {}): RebuildStore {
  return { loadState: async () => null, saveState: vi.fn(), activeBooking: async () => null,
    createRentalRequest: async () => null, readTurn: async () => null, ...extra };
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T08:00:00Z'));
  fixture.tables.email_outbox.clear(); fixture.tables.email_deliveries.clear(); fixture.fail = '';
  fixture.send.mockReset().mockResolvedValue(true); fixture.sms.mockReset().mockResolvedValue(false); fixture.incident.mockReset().mockResolvedValue(true);
  for (const name of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'DANIEL_ALERT_PHONE']) vi.stubEnv(name, '');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('durable WhatsApp handoff notifications', () => {
  it('queues before the core commits handoff state, then recovers without re-running the flow', async () => {
    const saved = vi.fn(async () => { expect(firstRow()?.status).toBe('pending'); });
    const result = await getRebuiltBotReply(PHONE, 'אני רוצה לדבר עם נציג', store({ saveState: saved, beforeEscalationSave: phone => enqueueHandoffEmail(MESSAGE, phone) }));
    expect(result.escalate).toBe(true); expect(saved).toHaveBeenCalledOnce();
    expect(fixture.send).not.toHaveBeenCalled();
    // Crash after state committed, before webhook prepared or sent its reply.
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('delivered');
    expect(fixture.send).toHaveBeenCalledWith(MESSAGE, PHONE);
  });

  it('does not commit handoff state or acknowledge success when the durable queue write fails', async () => {
    fixture.fail = 'email_outbox:upsert';
    const saved = vi.fn();
    await expect(getRebuiltBotReply(PHONE, 'אני רוצה לדבר עם נציג', store({ saveState: saved, beforeEscalationSave: phone => enqueueHandoffEmail(MESSAGE, phone) }))).rejects.toThrow('queue write failed');
    expect(saved).not.toHaveBeenCalled(); expect(fixture.send).not.toHaveBeenCalled();
  });

  it('never queues simulator handoffs even if a hook is accidentally supplied', async () => {
    const hook = vi.fn();
    expect((await getRebuiltBotReply(PHONE, 'אני רוצה לדבר עם נציג', store({ isSimulation: true, beforeEscalationSave: hook }))).escalate).toBe(true);
    expect(hook).not.toHaveBeenCalled(); expect(fixture.tables.email_outbox.size).toBe(0);
  });

  it('persists the notification before saving completed rental state after consent', async () => {
    const saveState = vi.fn(async () => { expect(firstRow()?.status).toBe('pending'); });
    const createRentalRequest = vi.fn(async () => 'request-123');
    const result = await getRebuiltBotReply(PHONE, 'I confirm', store({
      loadState: async () => ({ version: 2, locale: 'en', phase: 'booking', step: 'rental_confirm', history: [], requestKey: 'draft-key', booking: {
        pickupDate: '2026-12-10', returnDate: '2026-12-14', pickupLocation: 'Tel Aviv', returnLocation: 'Jerusalem', vehicleNeed: 'family', driverAgeRange: '24-plus', customerName: 'Test Customer',
      } }), saveState, createRentalRequest, beforeEscalationSave: phone => enqueueHandoffEmail(MESSAGE, phone),
    }));
    expect(createRentalRequest).toHaveBeenCalledOnce(); expect(saveState).toHaveBeenCalledOnce();
    expect(result.state.completedRequestId).toBe('request-123'); expect(result.escalate).toBe(true);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('repeated preparation preserves backoff and completed events cannot be queued again', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE);
    fixture.send.mockResolvedValueOnce(false);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('pending');
    const pending = structuredClone(firstRow());
    await enqueueHandoffEmail(MESSAGE, PHONE);
    expect(firstRow()).toEqual(pending);
    vi.advanceTimersByTime(60_001);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('delivered');
    await enqueueHandoffEmail(MESSAGE, PHONE);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('absent');
    expect(fixture.tables.email_deliveries.size).toBe(1); expect(fixture.send).toHaveBeenCalledTimes(2);
  });

  it('allows only one worker to claim a due notification', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE);
    const outcomes = await Promise.all([dispatchHandoffEmail(MESSAGE, PHONE), dispatchHandoffEmail(MESSAGE, PHONE)]);
    expect(outcomes).toContain('delivered'); expect(fixture.send).toHaveBeenCalledOnce();
  });

  it('does not expire the final attempt while another worker still holds its lease', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE); firstRow().attempts = 4;
    let finish!: (accepted: boolean) => void;
    const provider = new Promise<boolean>(resolve => { finish = resolve; });
    fixture.send.mockReturnValue(provider);
    const active = dispatchHandoffEmail(MESSAGE, PHONE);
    // Wait until the claimed worker reaches the fake provider.
    await vi.waitUntil(() => fixture.send.mock.calls.length === 1);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('pending');
    expect(firstRow().status).toBe('pending'); expect(fixture.incident).not.toHaveBeenCalled();
    finish(true); expect(await active).toBe('delivered');
  });

  it('recovers a provider acceptance whose audit write crashed using the same event', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE);
    fixture.fail = 'email_deliveries:upsert';
    await expect(dispatchHandoffEmail(MESSAGE, PHONE)).rejects.toThrow('record accepted');
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('pending');
    vi.advanceTimersByTime(45_001);
    expect(await retryHandoffEmail(String(firstRow().idempotency_key))).toBe('delivered');
    expect(fixture.send.mock.calls).toEqual([[MESSAGE, PHONE], [MESSAGE, PHONE]]);
  });

  it('repairs a failed cleanup after success without contacting the provider again', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE); fixture.fail = 'email_outbox:delete';
    await expect(dispatchHandoffEmail(MESSAGE, PHONE)).rejects.toThrow('resolve delivered');
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('delivered');
    expect(fixture.send).toHaveBeenCalledOnce(); expect(fixture.tables.email_outbox.size).toBe(0);
  });

  it('retains an exhausted failure for manual attention instead of retrying forever', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE); fixture.send.mockResolvedValue(false);
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe(attempt === 5 ? 'dead' : 'pending');
      vi.advanceTimersByTime(61 * 60_000);
    }
    await enqueueHandoffEmail(MESSAGE, PHONE);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('dead');
    expect(firstRow().status).toBe('dead'); expect(fixture.send).toHaveBeenCalledTimes(5);
  });

  it('does not send again outside the provider idempotency window after an interrupted attempt', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE); fixture.fail = 'email_deliveries:upsert';
    await expect(dispatchHandoffEmail(MESSAGE, PHONE)).rejects.toThrow();
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('dead'); expect(fixture.send).toHaveBeenCalledOnce();
  });

  it('does not dispatch another customer, another inbound event or an unrelated outbox row', async () => {
    await enqueueHandoffEmail(MESSAGE, PHONE);
    await expect(dispatchHandoffEmail(MESSAGE, '972500000002')).rejects.toThrow('invalid queued payload');
    expect(await dispatchHandoffEmail('different-wamid', PHONE)).toBe('absent');
    await expect(retryHandoffEmail('booking_confirmed:unrelated')).rejects.toThrow('invalid retry key');
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('retains configured SMS fast path without also sending an email on success', async () => {
    for (const name of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'DANIEL_ALERT_PHONE']) vi.stubEnv(name, 'fictional');
    fixture.sms.mockResolvedValue(true); await enqueueHandoffEmail(MESSAGE, PHONE);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('delivered');
    expect(fixture.sms).toHaveBeenCalledOnce(); expect(fixture.send).not.toHaveBeenCalled();
    expect([...fixture.tables.email_deliveries.values()][0].template_id).toBe('whatsapp_handoff_sms_v1');
  });

  it('does not repeat non-idempotent SMS when recovering a failed first attempt', async () => {
    for (const name of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'DANIEL_ALERT_PHONE']) vi.stubEnv(name, 'fictional');
    fixture.send.mockResolvedValueOnce(false); await enqueueHandoffEmail(MESSAGE, PHONE);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('pending');
    vi.advanceTimersByTime(60_001);
    expect(await dispatchHandoffEmail(MESSAGE, PHONE)).toBe('delivered');
    expect(fixture.sms).toHaveBeenCalledOnce(); expect(fixture.send).toHaveBeenCalledTimes(2);
  });
});
