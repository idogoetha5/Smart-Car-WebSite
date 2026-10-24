import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authenticated: true, failed: false, rows: [] as { id: number; body: string; source: string; created_at: string; escalated_at: null }[], queried: vi.fn(), send: vi.fn(), log: vi.fn(), incident: vi.fn() }));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsAppMessage: mocks.send }));
vi.mock('@/lib/whatsapp-conversations', () => ({ logWhatsAppMessage: mocks.log }));
vi.mock('@/lib/whatsapp-incidents', () => ({ reportBotIncident: mocks.incident }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fictional' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => mocks.authenticated, verifyInboxToken: async () => false }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: () => {
  mocks.queried(); let before = Infinity; let after = 0; let ascending = false;
  const chain = {
    select: () => chain, eq: () => chain,
    lt: (_field: string, value: string) => { before = Number(value); return chain; },
    gt: (_field: string, value: string) => { after = Number(value); return chain; },
    order: (_field: string, options: { ascending: boolean }) => { ascending = options.ascending; return chain; },
    limit: async (limit: number) => ({ data: mocks.rows.filter(row => row.id > after && row.id < before).sort((a, b) => ascending ? a.id - b.id : b.id - a.id).slice(0, limit), error: mocks.failed ? { message: 'unavailable' } : null }),
  }; return chain;
} }) }));
import { GET, POST } from './route';
const call = (query = '') => GET(new Request(`http://localhost/api/admin/whatsapp/conversations/972501234567${query}`), { params: Promise.resolve({ phone: '972501234567' }) });
beforeEach(() => {
  mocks.authenticated = true; mocks.failed = false; mocks.queried.mockClear();
  mocks.send.mockReset().mockResolvedValue({ ok: true, waMessageId: 'fictional-provider-id', status: 200, outcome: 'accepted' });
  mocks.log.mockReset().mockResolvedValue(true);
  mocks.incident.mockReset().mockResolvedValue(true);
  mocks.rows = Array.from({ length: 1020 }, (_, i) => ({ id: i + 1, body: `fictional ${i + 1}`, source: 'customer_inbound', created_at: '2030-01-01T00:00:00Z', escalated_at: null }));
});

describe('human reply delivery acknowledgement', () => {
  const send = (message: unknown = 'fictional reply') => POST(new Request('http://localhost/api/admin/whatsapp/conversations/972501234567', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) }), { params: Promise.resolve({ phone: '972501234567' }) });
  it('does not send without the scoped authenticated session', async () => {
    mocks.authenticated = false;
    expect((await send()).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([123, null, '', 'x'.repeat(4097)])('validates text before calling the provider', async message => {
    expect((await send(message)).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('distinguishes uncertain delivery and never retries automatically', async () => {
    mocks.send.mockResolvedValue({ ok: false, waMessageId: null, status: null, outcome: 'uncertain' });
    const response = await send();
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('delivery_uncertain');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.log).not.toHaveBeenCalled();
    expect(mocks.incident).toHaveBeenCalledWith('delivery_failed');
  });
  it('keeps a positively accepted send acknowledged even if history persistence fails', async () => {
    mocks.log.mockRejectedValue(new Error('simulated database outage'));
    mocks.incident.mockRejectedValue(new Error('simulated notification outage'));
    const response = await send();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ ok: true, historySynced: false });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
describe('authenticated thread cursor API', () => {
  it('returns newest 100, ascending for display, with no-store headers', async () => {
    const response = await call(); const json = await response.json();
    expect(json.data[0].id).toBe(921); expect(json.data.at(-1).id).toBe(1020);
    expect(json.pagination).toEqual({ hasMore: true, before: 921, after: 1020 });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('traverses all 1020 messages despite identical timestamps', async () => {
    const seen: number[] = []; let query = '';
    for (;;) {
      const json = await (await call(query)).json(); seen.push(...json.data.map((row: { id: number }) => row.id));
      if (!json.pagination.hasMore) break;
      query = `?before=${json.pagination.before}`;
    }
    expect(new Set(seen).size).toBe(1020); expect(seen).toHaveLength(1020);
  });
  it('returns forward deltas from the oldest unseen ID, not just the newest window', async () => {
    const json = await (await call('?after=400')).json();
    expect(json.data[0].id).toBe(401); expect(json.data.at(-1).id).toBe(500); expect(json.pagination.hasMore).toBe(true);
  });
  it.each(['?before=abc', '?before=0', '?after=-1', '?before=10&after=2', '?after=9999999999999999'])('rejects invalid cursor %s', async query => {
    expect((await call(query)).status).toBe(400); expect(mocks.queried).not.toHaveBeenCalled();
  });
  it('does not query messages without an authenticated session', async () => {
    mocks.authenticated = false; expect((await call()).status).toBe(401); expect(mocks.queried).not.toHaveBeenCalled();
  });
  it('does not disguise database failures as an empty conversation', async () => {
    mocks.failed = true; expect((await call()).status).toBe(500);
  });
});
