import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ flow: vi.fn(), limit: vi.fn(), interpret: vi.fn(), admin: false }));
vi.mock('@/lib/whatsapp-rebuild', () => ({ getRebuiltBotReply: mocks.flow }));
vi.mock('@/lib/whatsapp-rebuild-gemini', () => ({ readBotTurn: mocks.interpret }));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.limit }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fictional-admin-cookie' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => mocks.admin }));

import { POST } from './route';

function request(message = 'שלום') {
  return new NextRequest('http://localhost/api/whatsapp/simulator', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '192.0.2.10' },
    body: JSON.stringify({ sessionId: 'testsession123', message }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = false;
  mocks.limit.mockResolvedValue({ success: true });
  mocks.flow.mockImplementation(async (_phone, _message, store) => ({ reply: 'שלום', source: 'local', state: await store.loadState('simulation-testsession123') ?? { version: 2, phase: 'explore', step: 'menu', locale: 'he', booking: {}, history: [] } }));
});

describe('public WhatsApp simulator limits', () => {
  it('limits both a visitor and a session before invoking the bot', async () => {
    mocks.limit.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith('whatsapp-simulator:visitor:192.0.2.10', 200, 60 * 60_000);
    expect(mocks.limit).toHaveBeenCalledWith('whatsapp-simulator:session:testsession123', 20, 10 * 60_000);
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it('passes the interpreter into an AI-only isolated simulation', async () => {
    mocks.admin = true;
    const aiRequest = request();
    aiRequest.headers.set('x-smartcar-debug', '1');
    aiRequest.headers.set('x-smartcar-engine', 'ai');
    const response = await POST(aiRequest);
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledWith('simulation-testsession123', 'שלום', expect.objectContaining({
      isSimulation: true, readTurn: expect.any(Function),
    }));
    const store = mocks.flow.mock.calls[0][2] as { readTurn: (message: string, context: { phase: string }) => Promise<unknown> };
    await store.readTurn('שלום', { phase: 'explore' });
    expect(mocks.interpret).toHaveBeenCalledWith('שלום', { phase: 'explore' });
  });

  it('rejects public debug headers before they can force a paid model call', async () => {
    const aiRequest = request();
    aiRequest.headers.set('x-smartcar-debug', '1');
    aiRequest.headers.set('x-smartcar-engine', 'ai');
    const response = await POST(aiRequest);
    expect(response.status).toBe(403);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.interpret).not.toHaveBeenCalled();
  });
});
