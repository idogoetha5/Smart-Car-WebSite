import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enabled: false,
  log: vi.fn(), silence: vi.fn(), flow: vi.fn(), safety: vi.fn(), send: vi.fn(), sms: vi.fn(), incident: vi.fn(), limit: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: mocks.enabled }, error: null }) }) }) }) }) }));
vi.mock('@/lib/whatsapp-conversations', () => ({ logWhatsAppMessage: mocks.log, isConversationSilenced: mocks.silence }));
vi.mock('@/lib/whatsapp-rebuild', () => ({ getRebuiltBotReply: mocks.flow, isRebuiltSafetyMessage: mocks.safety }));
vi.mock('@/lib/whatsapp-rebuild-store', () => ({ persistentRebuildStore: {} }));
vi.mock('@/lib/whatsapp', () => ({ normalizeWhatsAppSender: (phone: string) => phone, sendWhatsAppMessage: mocks.send }));
vi.mock('@/lib/sms-alert', () => ({ sendEscalationSms: mocks.sms }));
vi.mock('@/lib/whatsapp-incidents', () => ({ reportBotIncident: mocks.incident }));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.limit }));
import { POST } from './route';

function request(body = 'שלום', id = 'message-1') {
  return new NextRequest('https://www.smartcar.co.il/api/whatsapp/webhook', {
    method: 'POST', headers: { 'x-webhook-secret': 'fictional-test-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: '972501234567', id, text: { body } }] } }] }] }),
  });
}

beforeEach(() => {
  vi.stubEnv('WHATSAPP_TRANSPORT', '360dialog');
  vi.stubEnv('WHATSAPP_WEBHOOK_SECRET', 'fictional-test-secret');
  vi.clearAllMocks(); mocks.enabled = false;
  mocks.log.mockResolvedValue(true); mocks.silence.mockResolvedValue(false); mocks.safety.mockReturnValue(false);
  mocks.limit.mockResolvedValue({ success: true }); mocks.send.mockResolvedValue({ ok: true, waMessageId: 'outbound-1' });
  mocks.sms.mockResolvedValue(true); mocks.incident.mockResolvedValue(undefined);
  mocks.flow.mockResolvedValue({ reply: 'בדיקה', state: {}, escalate: false, source: 'local' });
});

describe('rebuilt bot webhook controls', () => {
  it('rejects an unsigned webhook before reading settings or logging customers', async () => {
    const unsigned = new NextRequest('https://www.smartcar.co.il/api/whatsapp/webhook', { method: 'POST', body: '{}' });
    expect((await POST(unsigned)).status).toBe(401);
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it('keeps logging inbound messages while the bot kill switch is off', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ source: 'customer_inbound', body: 'שלום' }));
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not process a provider retry twice', async () => {
    mocks.enabled = true; mocks.log.mockResolvedValueOnce(false);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it('keeps a human takeover quiet for ordinary customer messages', async () => {
    mocks.enabled = true; mocks.silence.mockResolvedValue(true);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('lets an urgent safety message through silence and records the handoff', async () => {
    mocks.enabled = true; mocks.silence.mockResolvedValue(true); mocks.safety.mockReturnValue(true);
    mocks.flow.mockResolvedValue({ reply: 'עצרו במקום בטוח', state: {}, escalate: true, source: 'safety' });
    expect((await POST(request('יש תקלה בבלמים'))).status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ source: 'bot_outbound', escalatedAt: expect.any(String) }));
    expect(mocks.sms).toHaveBeenCalledOnce();
  });
});
