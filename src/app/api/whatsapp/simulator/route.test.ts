import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ flow: vi.fn(), limit: vi.fn(), interpret: vi.fn() }));
vi.mock('@/lib/whatsapp-flow', () => ({ getWhatsAppFlowReply: mocks.flow }));
vi.mock('@/lib/whatsapp-gemini', () => ({ interpretWhatsAppMessage: mocks.interpret }));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.limit }));

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
  mocks.limit.mockResolvedValue({ success: true });
  mocks.flow.mockResolvedValue({ handled: true, reply: 'שלום' });
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

  it('passes the interpreter into a valid isolated simulation', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledWith('simulation-testsession123', 'שלום', expect.objectContaining({
      isSimulation: true, interpretMessage: expect.any(Function),
    }));
    const store = mocks.flow.mock.calls[0][2] as { interpretMessage: (message: string, step: null) => Promise<unknown> };
    await store.interpretMessage('שלום', null);
    expect(mocks.interpret).toHaveBeenCalledWith('שלום', null);
  });
});
