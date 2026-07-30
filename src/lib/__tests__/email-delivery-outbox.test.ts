import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendTemplateEmail } from '@/lib/email-delivery';

let outboxUpserts: Array<{ row: Record<string, unknown>; opts: Record<string, unknown> }>;
let outboxDeletes: string[];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'email_deliveries') {
        return { upsert: async () => ({ data: null, error: null }) };
      }
      if (table === 'email_outbox') {
        return {
          upsert: async (row: Record<string, unknown>, opts: Record<string, unknown>) => {
            outboxUpserts.push({ row, opts });
            return { data: null, error: null };
          },
          delete: () => ({
            eq: async (_col: string, value: string) => {
              outboxDeletes.push(value);
              return { data: null, error: null };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  outboxUpserts = [];
  outboxDeletes = [];
  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID = 'service_1';
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY = 'public_1';
  process.env.EMAILJS_PRIVATE_KEY = 'private_1';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendTemplateEmail outbox wiring', () => {
  it('enqueues a retry when every in-request attempt fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 }))
    );

    const result = await sendTemplateEmail({
      event: 'booking_confirmed',
      idempotencyKey: 'booking_confirmed:abc',
      templateId: 'tmpl_1',
      params: { to_email: 'customer@example.com', to_name: 'Someone' },
    });

    expect(result.ok).toBe(false);
    expect(outboxUpserts).toHaveLength(1);
    expect(outboxUpserts[0].row).toMatchObject({
      idempotency_key: 'booking_confirmed:abc',
      event: 'booking_confirmed',
      template_id: 'tmpl_1',
      payload: { to_email: 'customer@example.com', to_name: 'Someone' },
      status: 'pending',
    });
    expect(outboxUpserts[0].opts).toMatchObject({ onConflict: 'idempotency_key', ignoreDuplicates: true });
    expect(outboxDeletes).toHaveLength(0);
  });

  it('resolves (deletes) any pending outbox row once the send succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 }))
    );

    const result = await sendTemplateEmail({
      event: 'booking_confirmed',
      idempotencyKey: 'booking_confirmed:xyz',
      templateId: 'tmpl_1',
      params: { to_email: 'customer@example.com' },
    });

    expect(result.ok).toBe(true);
    expect(outboxDeletes).toEqual(['booking_confirmed:xyz']);
    expect(outboxUpserts).toHaveLength(0);
  });

  it('does not enqueue a retry for a 4xx (non-transient) rejection beyond the single failure record', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 422 }))
    );

    const result = await sendTemplateEmail({
      event: 'contact_lead',
      idempotencyKey: 'contact_lead:1',
      templateId: 'tmpl_1',
      params: {},
    });

    expect(result.ok).toBe(false);
    // Still enqueued once — the sweep will hit the same 4xx and age out via
    // the dead-letter threshold rather than retry forever unattended.
    expect(outboxUpserts).toHaveLength(1);
  });
});
