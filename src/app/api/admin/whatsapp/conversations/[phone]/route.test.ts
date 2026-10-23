import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authenticated: true, failed: false, rows: [] as { id: number; body: string; source: string; created_at: string; escalated_at: null }[], queried: vi.fn() }));
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
import { GET } from './route';
const call = (query = '') => GET(new Request(`http://localhost/api/admin/whatsapp/conversations/972501234567${query}`), { params: Promise.resolve({ phone: '972501234567' }) });
beforeEach(() => {
  mocks.authenticated = true; mocks.failed = false; mocks.queried.mockClear();
  mocks.rows = Array.from({ length: 1020 }, (_, i) => ({ id: i + 1, body: `fictional ${i + 1}`, source: 'customer_inbound', created_at: '2030-01-01T00:00:00Z', escalated_at: null }));
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
