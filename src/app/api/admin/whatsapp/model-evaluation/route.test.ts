import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { freeModelChain } from '@/lib/whatsapp-gemini-client';
const mocks = vi.hoisted(() => ({ auth: false, limit: vi.fn(), simulate: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fictional' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => mocks.auth }));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.limit }));
vi.mock('@/app/api/whatsapp/simulator/route', () => ({ POST: mocks.simulate }));
import { POST } from './route';

const request = (body = '{}', origin = 'https://www.smartcar.co.il') => new NextRequest('https://www.smartcar.co.il/api/admin/whatsapp/model-evaluation', {
  method:'POST',headers:{origin,'content-type':'application/json','x-smartcar-engine':'local','x-smartcar-models':'arbitrary-model'},body,
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth=false;
  mocks.limit.mockResolvedValue({ success:true });
  mocks.simulate.mockImplementation(async () => NextResponse.json({ reply:'fictional', models:freeModelChain() }));
});
describe('owner-only fixed model comparison', () => {
  it('refuses unauthenticated and inbox-only callers before spending or simulating', async () => {
    expect((await POST(request())).status).toBe(401);
    expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.simulate).not.toHaveBeenCalled();
  });
  it('refuses a cross-origin call', async () => {
    mocks.auth=true;
    expect((await POST(request('{}','https://example.com'))).status).toBe(403);
    expect(mocks.simulate).not.toHaveBeenCalled();
  });
  it('applies the extra limit before calling a model', async () => {
    mocks.auth=true; mocks.limit.mockResolvedValue({ success:false });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith('whatsapp-owner-model-evaluation',12,3600000);
    expect(mocks.simulate).not.toHaveBeenCalled();
  });
  it('rejects oversized rehearsal state', async () => {
    mocks.auth=true;
    expect((await POST(request('x'.repeat(256001)))).status).toBe(413);
    expect(mocks.simulate).not.toHaveBeenCalled();
  });
  it('uses only the fixed private model and leaves the public model untouched', async () => {
    mocks.auth=true;
    const response=await POST(request()); const body=await response.json();
    expect(body.models).toEqual(['gemini-3.8-flash']);
    expect(body.evaluation).toEqual({ model:'gemini-3.8-flash',usage:null });
    expect(freeModelChain()).toEqual(['gemini-3.5-flash-lite']);
    const forwarded=mocks.simulate.mock.calls[0][0] as NextRequest;
    expect(forwarded.headers.get('x-smartcar-engine')).toBe('ai');
    expect(forwarded.headers.get('x-smartcar-models')).toBeNull();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('preserves simulator validation errors and releases the private context', async () => {
    mocks.auth=true; mocks.simulate.mockResolvedValue(NextResponse.json({ error:'Invalid simulation message' },{status:400}));
    expect((await POST(request())).status).toBe(400);
    expect(freeModelChain()).toEqual(['gemini-3.5-flash-lite']);
  });
});
