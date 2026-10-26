import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), query: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fictional-cookie' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: mocks.authorized }));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: () => {
    const chain = { select: () => chain, in: () => chain, order: () => chain, limit: mocks.query };
    return chain;
  } }),
}));

import { GET } from './route';

beforeEach(() => { vi.clearAllMocks(); mocks.authorized.mockResolvedValue(true); mocks.query.mockResolvedValue({ data: [], error: null }); });

describe('operator delivery attention', () => {
  it('never exposes customer phones without full admin authentication', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await GET()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('shows ambiguous sends and excludes processing that is still active', async () => {
    mocks.query.mockResolvedValue({ data: [
      { phone: '972500000001', status: 'uncertain', updated_at: new Date().toISOString() },
      { phone: '972500000002', status: 'sending', updated_at: new Date().toISOString() },
    ], error: null });
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([expect.objectContaining({ phone: '972500000001' })]);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
