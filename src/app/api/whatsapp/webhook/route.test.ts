import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flow: vi.fn(),
  log: vi.fn(),
  silenced: vi.fn(),
  send: vi.fn(),
  sms: vi.fn(),
  rateLimit: vi.fn(),
  classify: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== 'whatsapp_bot_settings') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { enabled: true }, error: null }),
      };
      return query;
    },
  }),
}));

vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock('@/lib/whatsapp', () => ({
  normalizeWhatsAppSender: (phone: string) => phone.replace(/\D/g, ''),
  sendWhatsAppMessage: mocks.send,
}));
vi.mock('@/lib/whatsapp-conversations', () => ({
  logWhatsAppMessage: mocks.log,
  isConversationSilenced: mocks.silenced,
}));
vi.mock('@/lib/whatsapp-flow', () => ({
  getWhatsAppFlowReply: mocks.flow,
  classifyWhatsAppInitialRoute: mocks.classify,
}));
vi.mock('@/lib/sms-alert', () => ({ sendEscalationSms: mocks.sms }));

import { POST } from './route';

const payload = JSON.stringify({
  entry: [{
    changes: [{
      field: 'messages',
      value: { messages: [{ from: '+972501234567', id: 'wamid-1', type: 'text', text: { body: 'שלום' } }] },
    }],
  }],
});

function metaRequest(signature: string) {
  return new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    body: payload,
  });
}

function dialogRequest(secret?: string, body = payload) {
  return new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-webhook-secret': secret } : {}) },
    body,
  });
}

function ycloudRequest(body: string, timestamp = Math.floor(Date.now() / 1000), signature?: string) {
  const signedPayload = `${timestamp}.${body}`;
  const computedSignature = createHmac('sha256', 'local-ycloud-secret').update(signedPayload).digest('hex');
  return new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'ycloud-signature': `t=${timestamp},s=${signature ?? computedSignature}`,
    },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WHATSAPP_TRANSPORT = 'meta_direct';
  process.env.WHATSAPP_APP_SECRET = 'local-test-app-secret';
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  delete process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET;
  mocks.log.mockResolvedValue(true);
  mocks.silenced.mockResolvedValue(false);
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.flow.mockResolvedValue({ handled: true, reply: 'ברוכים הבאים ל־SmartCar' });
  mocks.classify.mockReturnValue('new_customer');
  mocks.send.mockResolvedValue({ ok: true, waMessageId: 'outbound-1', status: 200 });
  mocks.sms.mockResolvedValue(true);
});

afterEach(() => {
  delete process.env.WHATSAPP_TRANSPORT;
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  delete process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET;
});

describe('local WhatsApp webhook boundary', () => {
  it('accepts a valid Meta signature and runs the deterministic flow', async () => {
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledWith('972501234567', 'שלום');
    expect(mocks.send).toHaveBeenCalledWith('972501234567', 'ברוכים הבאים ל־SmartCar');
    expect(mocks.log).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid Meta signature before processing a message', async () => {
    const response = await POST(metaRequest('sha256=0000000000000000000000000000000000000000000000000000000000000000'));
    expect(response.status).toBe(401);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not answer a provider retry of the same message', async () => {
    mocks.log.mockResolvedValueOnce(false);
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('keeps an ordinary conversation silent after a human takes over', async () => {
    mocks.silenced.mockResolvedValue(true);
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('fails closed for 360dialog without the private header', async () => {
    process.env.WHATSAPP_TRANSPORT = '360dialog';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'local-dialog-secret';
    const response = await POST(dialogRequest());
    expect(response.status).toBe(401);
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it('accepts 360dialog only with the configured private header', async () => {
    process.env.WHATSAPP_TRANSPORT = '360dialog';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'local-dialog-secret';
    const response = await POST(dialogRequest('local-dialog-secret'));
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledOnce();
  });

  it('detects a reply sent from the WhatsApp Business app and starts human takeover', async () => {
    process.env.WHATSAPP_TRANSPORT = '360dialog';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'local-dialog-secret';
    const echoPayload = JSON.stringify({
      entry: [{
        changes: [{
          field: 'smb_message_echoes',
          value: {
            message_echoes: [{
              from: '97299509757',
              to: '972501234567',
              id: 'echo-1',
              type: 'text',
              text: { body: 'שלום, אני מטפל בבקשה' },
            }],
          },
        }],
      }],
    });

    const response = await POST(dialogRequest('local-dialog-secret', echoPayload));

    expect(response.status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith({
      phone: '972501234567',
      source: 'human_reply',
      body: 'שלום, אני מטפל בבקשה',
      waMessageId: 'echo-1',
    });
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('accepts a signed YCloud inbound event and runs the bot', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET = 'local-ycloud-secret';
    const ycloudPayload = JSON.stringify({
      id: 'evt-inbound-1',
      type: 'whatsapp.inbound_message.received',
      whatsappInboundMessage: {
        id: 'ycloud-message-1',
        wamid: 'wamid.ycloud-inbound-1',
        from: '+972501234567',
        to: '+97299509757',
        type: 'text',
        text: { body: 'שלום' },
      },
    });

    const response = await POST(ycloudRequest(ycloudPayload));

    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledWith('972501234567', 'שלום');
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({
      phone: '972501234567',
      source: 'customer_inbound',
      waMessageId: 'wamid.ycloud-inbound-1',
    }));
  });

  it('rejects an invalid YCloud signature before processing a message', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET = 'local-ycloud-secret';
    const response = await POST(ycloudRequest('{"id":"evt-bad"}', undefined, '0'.repeat(64)));

    expect(response.status).toBe(401);
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it('silences the bot when YCloud reports a reply from the Business app', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET = 'local-ycloud-secret';
    const echoPayload = JSON.stringify({
      id: 'evt-echo-1',
      type: 'whatsapp.smb.message.echoes',
      whatsappMessage: {
        id: 'ycloud-echo-1',
        wamid: 'wamid.ycloud-echo-1',
        from: '+97299509757',
        to: '+972501234567',
        type: 'text',
        text: { body: 'נציג SmartCar מטפל בזה עכשיו' },
      },
    });

    const response = await POST(ycloudRequest(echoPayload));

    expect(response.status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith({
      phone: '972501234567',
      source: 'human_reply',
      body: 'נציג SmartCar מטפל בזה עכשיו',
      waMessageId: 'wamid.ycloud-echo-1',
    });
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it('marks an escalation and alerts the manager', async () => {
    mocks.flow.mockResolvedValue({ handled: true, reply: 'הפנייה הועברה לנציג', escalate: true, escalateReason: 'תאונה' });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.sms).toHaveBeenCalledWith(expect.objectContaining({ customerPhone: '972501234567', reason: 'תאונה' }));
    expect(mocks.log).toHaveBeenLastCalledWith(expect.objectContaining({ escalatedAt: expect.any(String) }));
  });

  it('lets a new accident bypass the recent-human-reply silence window', async () => {
    mocks.silenced.mockResolvedValue(true);
    mocks.classify.mockReturnValue('accident');
    mocks.flow.mockResolvedValue({ handled: true, reply: 'הודעת בטיחות', escalate: true, escalateReason: 'תאונה' });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledOnce();
    expect(mocks.sms).toHaveBeenCalledOnce();
  });
});
