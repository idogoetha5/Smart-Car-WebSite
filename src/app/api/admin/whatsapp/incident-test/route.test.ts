import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authorised: false, incident: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fictional' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => mocks.authorised }));
vi.mock('@/lib/whatsapp-incidents', () => ({ reportBotIncident: mocks.incident }));
import { POST } from './route';

beforeEach(() => { mocks.authorised = false; mocks.incident.mockReset().mockResolvedValue(true); });
describe('owner incident email probe', () => {
  it('cannot send from an unauthenticated or inbox-only session', async () => {
    expect((await POST()).status).toBe(401);
    expect(mocks.incident).not.toHaveBeenCalled();
  });
  it('uses only the fixed test category and reports provider acceptance without claiming receipt', async () => {
    mocks.authorised = true;
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { accepted: true } });
    expect(mocks.incident).toHaveBeenCalledExactlyOnceWith('test');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it.each(['rejected', 'exception'])('reports %s without exposing internal errors', async mode => {
    mocks.authorised = true;
    if (mode === 'exception') mocks.incident.mockRejectedValue(new Error('fictional secret'));
    else mocks.incident.mockResolvedValue(false);
    const response = await POST();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ data: { accepted: false } });
  });
});
