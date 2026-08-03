import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let outboxRows: Array<{
  idempotency_key: string;
  event: string;
  template_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  created_at: string;
}>;
let updates: Array<{ key: string; fields: Record<string, unknown> }>;
let sendResults: Record<string, boolean>;
/** When set, the next update()...eq() call resolves with this error instead of succeeding. */
let nextUpdateError: { message: string } | null;

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== 'email_outbox') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            lte: () => ({
              order: () => ({
                limit: async () => ({ data: outboxRows, error: null }),
              }),
            }),
          }),
        }),
        update: (fields: Record<string, unknown>) => ({
          eq: async (_col: string, key: string) => {
            updates.push({ key, fields });
            if (nextUpdateError) {
              const err = nextUpdateError;
              nextUpdateError = null;
              return { data: null, error: err };
            }
            return { data: null, error: null };
          },
        }),
      };
    },
  }),
}));

vi.mock('@/lib/email-delivery', () => ({
  OUTBOX_BACKOFF_MS: [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000],
  sendTemplateEmail: async ({ idempotencyKey }: { idempotencyKey: string }) => ({
    ok: sendResults[idempotencyKey] ?? false,
    attempts: 1,
    status: sendResults[idempotencyKey] ? 200 : 500,
  }),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  outboxRows = [];
  updates = [];
  sendResults = {};
  nextUpdateError = null;
  process.env.CRON_SECRET = 'test-secret';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

function authedRequest(secret = 'test-secret') {
  return new Request('https://smartcar.co.il/api/cron/email-retry', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe('GET /api/cron/email-retry', () => {
  it('rejects a request without the correct bearer token', async () => {
    const { GET } = await import('./route');
    const res = await GET(new Request('https://smartcar.co.il/api/cron/email-retry'));
    expect(res.status).toBe(401);
  });

  it('rejects when CRON_SECRET is not configured, even with a matching header', async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import('./route');
    const res = await GET(authedRequest('anything'));
    expect(res.status).toBe(401);
  });

  it('reschedules a still-failing row with the next backoff step', async () => {
    outboxRows = [
      {
        idempotency_key: 'booking_confirmed:1',
        event: 'booking_confirmed',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 0,
        created_at: new Date().toISOString(),
      },
    ];
    sendResults = { 'booking_confirmed:1': false };

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body).toMatchObject({ success: true, delivered: 0, dead: 0, stillPending: 1 });
    expect(updates).toHaveLength(1);
    expect(updates[0].fields).toMatchObject({ attempts: 1 });
    expect(updates[0].fields.status).toBeUndefined();
  });

  it('marks a row dead once it exceeds the sweep attempt ceiling', async () => {
    outboxRows = [
      {
        idempotency_key: 'contact_lead:2',
        event: 'contact_lead',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 4, // this attempt makes it the 5th sweep attempt
        created_at: new Date().toISOString(),
      },
    ];
    sendResults = { 'contact_lead:2': false };

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body).toMatchObject({ success: true, dead: 1, stillPending: 0 });
    expect(updates).toHaveLength(1);
    expect(updates[0].fields).toMatchObject({ status: 'dead', attempts: 5 });
  });

  it('does NOT mark a row dead after only 24h — Hobby cron is daily, one miss must not be fatal', async () => {
    outboxRows = [
      {
        idempotency_key: 'contact_lead:3',
        event: 'contact_lead',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 0,
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      },
    ];
    sendResults = { 'contact_lead:3': false };

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body).toMatchObject({ success: true, dead: 0, stillPending: 1 });
  });

  it('marks a row dead once it is older than 7 days, regardless of attempt count', async () => {
    outboxRows = [
      {
        idempotency_key: 'contact_lead:3',
        event: 'contact_lead',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 0,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    sendResults = { 'contact_lead:3': false };

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body).toMatchObject({ success: true, dead: 1 });
  });

  it('simulates a message failing across a full week of once-daily sweeps: stays pending for 5 days, then dies on attempt 5 (still within 7 days)', async () => {
    const createdAt = new Date().toISOString();
    let lastBody: { dead: number; stillPending: number } | null = null;

    for (let day = 1; day <= 5; day++) {
      outboxRows = [
        {
          idempotency_key: 'booking_confirmed:week-sim',
          event: 'booking_confirmed',
          template_id: 'tmpl_1',
          payload: {},
          attempts: day - 1,
          created_at: createdAt,
        },
      ];
      sendResults = { 'booking_confirmed:week-sim': false };
      updates = [];

      const { GET } = await import('./route');
      vi.resetModules();
      const res = await GET(authedRequest());
      lastBody = await res.json();

      if (day < 5) {
        expect(lastBody).toMatchObject({ dead: 0, stillPending: 1 });
        expect(updates[0].fields.attempts).toBe(day);
        expect(updates[0].fields.status).toBeUndefined();
      }
    }

    // 5th sweep attempt (attempts becomes 5) hits MAX_SWEEP_ATTEMPTS and gives up.
    expect(lastBody).toMatchObject({ dead: 1, stillPending: 0 });
    expect(updates[0].fields).toMatchObject({ status: 'dead', attempts: 5 });
  });

  it('logs an alert and does not throw when the DB update marking a row dead itself fails', async () => {
    outboxRows = [
      {
        idempotency_key: 'contact_lead:update-fail',
        event: 'contact_lead',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 4,
        created_at: new Date().toISOString(),
      },
    ];
    sendResults = { 'contact_lead:update-fail': false };
    nextUpdateError = { message: 'connection reset' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, dead: 1 });
    expect(errorSpy.mock.calls.some(call =>
      String(call[0]).includes('outbox update failed while marking')
    )).toBe(true);
    errorSpy.mockRestore();
  });

  it('logs an alert and does not throw when the DB reschedule update itself fails', async () => {
    outboxRows = [
      {
        idempotency_key: 'contact_lead:reschedule-fail',
        event: 'contact_lead',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 0,
        created_at: new Date().toISOString(),
      },
    ];
    sendResults = { 'contact_lead:reschedule-fail': false };
    nextUpdateError = { message: 'connection reset' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, stillPending: 1 });
    expect(errorSpy.mock.calls.some(call =>
      String(call[0]).includes('outbox reschedule failed')
    )).toBe(true);
    errorSpy.mockRestore();
  });

  it('does not touch the outbox row when the retry succeeds', async () => {
    outboxRows = [
      {
        idempotency_key: 'booking_confirmed:4',
        event: 'booking_confirmed',
        template_id: 'tmpl_1',
        payload: {},
        attempts: 1,
        created_at: new Date().toISOString(),
      },
    ];
    sendResults = { 'booking_confirmed:4': true };

    const { GET } = await import('./route');
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body).toMatchObject({ success: true, delivered: 1 });
    expect(updates).toHaveLength(0);
  });
});
