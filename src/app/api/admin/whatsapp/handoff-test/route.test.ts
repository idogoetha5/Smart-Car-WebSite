import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), send: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fictional-cookie' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: mocks.authorized }));
vi.mock('@/lib/whatsapp-incidents', () => ({ sendHandoffEmail: mocks.send }));

import { POST } from './route';

beforeEach(() => { vi.clearAllMocks(); mocks.authorized.mockResolvedValue(true); mocks.send.mockResolvedValue(true); });

describe('operator handoff alert probe', () => {
  it('refuses an unauthenticated caller', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await POST()).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sends only a fictional test and reports provider acceptance', async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.stringMatching(/^test-/), 'fictional', true);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
