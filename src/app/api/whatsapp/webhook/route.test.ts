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
  incident: vi.fn(),
  settings: vi.fn(),
  claim: vi.fn(),
  prepare: vi.fn(),
  record: vi.fn(),
  suppressOff: vi.fn(),
  suppressSend: vi.fn(),
  handoffEmail: vi.fn(),
  enqueueHandoff: vi.fn(),
  dispatchHandoff: vi.fn(),
  loadState: vi.fn(),
  saveState: vi.fn(),
  createRentalRequest: vi.fn(),
  manualEventId: null as string | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== 'whatsapp_bot_settings') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: mocks.settings,
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
vi.mock('@/lib/whatsapp-rebuild', () => ({
  getRebuiltBotReply: mocks.flow,
  isRebuiltSafetyMessage: mocks.classify,
}));
vi.mock('@/lib/whatsapp-rebuild-store', () => ({ createPersistentRebuildStore: () => ({ loadState: mocks.loadState, saveState: mocks.saveState, createRentalRequest: mocks.createRentalRequest }) }));
vi.mock('@/lib/whatsapp-phone-turn', () => ({
  withSerializedPhoneTurn: async (phone: string, messageId: string, _emergency: boolean, run: (turn: unknown) => Promise<unknown>) => run({ phone, messageId, ownerToken: 'test-turn', manualEventId: mocks.manualEventId }),
  mutatePhoneTurn: async () => ({}),
}));
vi.mock('@/lib/sms-alert', () => ({ sendEscalationSms: mocks.sms }));
vi.mock('@/lib/whatsapp-incidents', () => ({ reportBotIncident: mocks.incident, sendHandoffEmail: mocks.handoffEmail }));
vi.mock('@/lib/whatsapp-handoff-outbox', () => ({ enqueueHandoffEmail: mocks.enqueueHandoff, dispatchHandoffEmail: mocks.dispatchHandoff }));
vi.mock('@/lib/whatsapp-inbound-journal', () => ({
  claimInboundMessage: mocks.claim,
  prepareInboundReply: mocks.prepare,
  recordInboundSend: mocks.record,
  suppressInboundWhileOff: mocks.suppressOff,
  suppressClaimedSend: mocks.suppressSend,
}));

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
  mocks.manualEventId = null;
  vi.resetAllMocks();
  process.env.WHATSAPP_TRANSPORT = 'meta_direct';
  process.env.WHATSAPP_APP_SECRET = 'local-test-app-secret';
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  delete process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET;
  mocks.log.mockResolvedValue(true);
  mocks.silenced.mockResolvedValue(false);
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.flow.mockResolvedValue({ handled: true, reply: 'ברוכים הבאים ל־SmartCar' });
  mocks.classify.mockReturnValue(false);
  mocks.send.mockResolvedValue({ ok: true, waMessageId: 'outbound-1', status: 200 });
  mocks.sms.mockResolvedValue(true);
  mocks.incident.mockResolvedValue(true);
  mocks.settings.mockResolvedValue({ data: { enabled: true }, error: null });
  mocks.prepare.mockResolvedValue(undefined);
  mocks.record.mockResolvedValue(undefined);
  mocks.suppressOff.mockResolvedValue(undefined);
  mocks.suppressSend.mockResolvedValue(undefined);
  mocks.handoffEmail.mockResolvedValue(true);
  mocks.enqueueHandoff.mockResolvedValue(undefined);
  mocks.dispatchHandoff.mockResolvedValue('absent');
  mocks.loadState.mockResolvedValue(null);
  mocks.saveState.mockResolvedValue(undefined);
  mocks.createRentalRequest.mockResolvedValue('unexpected');
  mocks.claim.mockImplementation(async () => {
    const prepared = mocks.prepare.mock.calls.at(-1);
    return prepared
      ? { action: 'send', reply: prepared[1], escalate: prepared[2], providerReplyId: null }
      : { action: 'prepare', reply: null, escalate: false, providerReplyId: null };
  });
});

afterEach(() => {
  delete process.env.WHATSAPP_TRANSPORT;
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  delete process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET;
});

describe('local WhatsApp webhook boundary', () => {
  it('logs inbound messages but sends no reply when the verified kill switch is off', async () => {
    mocks.settings.mockResolvedValue({ data: { enabled: false }, error: null });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ source: 'customer_inbound', body: 'שלום' }));
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.suppressOff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });

  it.each([{ data: null, error: null }, { data: null, error: { message: 'unavailable' } }])('fails closed when the kill switch cannot be verified', async settings => {
    process.env.WHATSAPP_TRANSPORT = '360dialog';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'local-dialog-secret';
    mocks.settings.mockResolvedValue(settings);
    const response = await POST(dialogRequest('local-dialog-secret'));
    expect(response.status).toBe(503);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.incident).toHaveBeenCalledWith('settings_unavailable');
  });
  it('refuses requests while no transport is configured', async () => {
    delete process.env.WHATSAPP_TRANSPORT;
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(401);
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it('rejects malformed signed JSON without touching the database', async () => {
    process.env.WHATSAPP_TRANSPORT = '360dialog';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'local-dialog-secret';
    const response = await POST(dialogRequest('local-dialog-secret', '{bad'));
    expect(response.status).toBe(400);
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it('does not mistake a logging failure for a duplicate message', async () => {
    mocks.log.mockRejectedValueOnce(new Error('database unavailable'));
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(503);
    expect(mocks.incident).toHaveBeenCalledWith('processing_failed');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('accepts a valid Meta signature and runs the deterministic flow', async () => {
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledWith('972501234567', 'שלום', expect.any(Object));
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
    mocks.claim.mockResolvedValue({ action: 'done', reply: null, escalate: false, providerReplyId: null });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('never resends an uncertain provider outcome on a webhook retry', async () => {
    mocks.send.mockResolvedValue({ ok: false, waMessageId: null, status: null, outcome: 'uncertain' });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith('wamid-1', expect.objectContaining({ outcome: 'uncertain' }), expect.any(Object));
    mocks.claim.mockResolvedValue({ action: 'done', reply: 'ברוכים הבאים ל־SmartCar', escalate: false, providerReplyId: null });
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('repairs a missing outbound log after an accepted send without resending', async () => {
    mocks.claim.mockResolvedValue({ action: 'accepted', reply: 'תשובה שמורה', escalate: false, providerReplyId: 'outbound-1' });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ source: 'bot_outbound', body: 'תשובה שמורה', waMessageId: 'outbound-1' }));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not send when the prepared reply could not be saved', async () => {
    mocks.prepare.mockRejectedValueOnce(new Error('database unavailable'));
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(503);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not send again after a provider acceptance whose journal update failed', async () => {
    mocks.record.mockRejectedValueOnce(new Error('database unavailable'));
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(503);
    mocks.claim.mockResolvedValue({ action: 'uncertain', reply: 'ברוכים הבאים ל־SmartCar', escalate: false, providerReplyId: null });
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
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
    expect(mocks.flow).toHaveBeenCalledWith('972501234567', 'שלום', expect.any(Object));
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({
      phone: '972501234567',
      source: 'customer_inbound',
      waMessageId: 'wamid.ycloud-inbound-1',
    }));
  });

  it('ignores a signed YCloud group message', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_WEBHOOK_SECRET = 'local-ycloud-secret';
    const groupPayload = JSON.stringify({
      type: 'whatsapp.inbound_message.received',
      whatsappInboundMessage: {
        wamid: 'wamid.group-1', from: '+972501234567', to: '+97299509757',
        groupId: 'group-1', type: 'text', text: { body: 'שלום לקבוצה' },
      },
    });
    const response = await POST(ycloudRequest(groupPayload));
    expect(response.status).toBe(200);
    expect(mocks.log).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
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
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
    expect(mocks.log).toHaveBeenLastCalledWith(expect.objectContaining({ escalatedAt: expect.any(String) }));
  });

  it('binds durable notification preparation before the core saves escalation', async () => {
    mocks.flow.mockResolvedValue({ reply: 'נדרש נציג', escalate: true });
    mocks.sms.mockResolvedValue(false);
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(200);
    const store = mocks.flow.mock.calls[0][2];
    await store.beforeEscalationSave('972501234567');
    expect(mocks.enqueueHandoff).toHaveBeenCalledWith('wamid-1', '972501234567', expect.any(Object));
    expect(mocks.incident).not.toHaveBeenCalledWith('handoff_alert_failed');
  });

  it('checks the kill switch again immediately before provider send', async () => {
    mocks.settings.mockResolvedValueOnce({ data: { enabled: true }, error: null })
      .mockResolvedValueOnce({ data: { enabled: false }, error: null });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.suppressSend).toHaveBeenCalledWith('wamid-1', expect.any(Object));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('lets a new accident bypass the recent-human-reply silence window', async () => {
    mocks.silenced.mockResolvedValue(true);
    mocks.classify.mockReturnValue(true);
    mocks.flow.mockResolvedValue({ handled: true, reply: 'הודעת בטיחות', escalate: true, escalateReason: 'תאונה' });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    const response = await POST(metaRequest(signature));
    expect(response.status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledOnce();
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });

  it.each(['accepted', 'uncertain', 'done'])('recovers an alert on %s retry without another WhatsApp send', async action => {
    mocks.claim.mockResolvedValue({ action, reply: 'saved', escalate: true, providerReplyId: 'outbound-1' });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.enqueueHandoff).toHaveBeenCalledWith('wamid-1', '972501234567', expect.any(Object));
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it('preserves a queued alert after core state saved but reply preparation failed', async () => {
    mocks.flow.mockImplementationOnce(async (_phone, _body, store) => {
      await store.beforeEscalationSave('972501234567');
      return { reply: 'saved handoff', escalate: true };
    });
    mocks.prepare.mockRejectedValueOnce(new Error('crash after state save'));
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(503);
    expect(mocks.enqueueHandoff).toHaveBeenCalledOnce();
    mocks.flow.mockResolvedValueOnce({ reply: 'handoff already saved', escalate: false });
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });
});


describe('takeover at send time and honest text-only media handling', () => {
  function inbound(message: Record<string, unknown> = {}) {
    process.env.WHATSAPP_TRANSPORT = '360dialog';
    process.env.WHATSAPP_WEBHOOK_SECRET = 'local-dialog-secret';
    return dialogRequest('local-dialog-secret', JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [{
      from: '+972501234567', id: 'wamid-1', type: 'text', text: { body: 'Please explain the rental terms.' }, ...message,
    }] } }] }] }));
  }

  it('suppresses a prepared response when a human replied during generation, retaining alert recovery', async () => {
    mocks.flow.mockImplementationOnce(async (_phone, _body, store) => {
      await store.beforeEscalationSave('972501234567');
      mocks.silenced.mockResolvedValue(true);
      return { reply: 'Prepared commercial handoff', escalate: true };
    });
    expect((await POST(inbound())).status).toBe(200);
    expect(mocks.flow).toHaveBeenCalledOnce();
    expect(mocks.silenced).toHaveBeenCalledTimes(2);
    expect(mocks.suppressSend).toHaveBeenCalledWith('wamid-1', expect.any(Object));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.enqueueHandoff).toHaveBeenCalledWith('wamid-1', '972501234567', expect.any(Object));
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });

  it('does not use a saved escalation flag to bypass takeover on a prepared retry', async () => {
    mocks.claim.mockResolvedValue({ action: 'send', reply: 'Prepared non-safety handoff', escalate: true, providerReplyId: null });
    mocks.silenced.mockResolvedValue(true);
    expect((await POST(inbound())).status).toBe(200);
    expect(mocks.classify).toHaveBeenCalledWith('Please explain the rental terms.');
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.suppressSend).toHaveBeenCalledWith('wamid-1', expect.any(Object));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.enqueueHandoff).toHaveBeenCalledWith('wamid-1', '972501234567', expect.any(Object));
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });

  it('fails closed if human ownership cannot be rechecked before send', async () => {
    mocks.silenced.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('ownership unavailable'));
    expect((await POST(inbound())).status).toBe(503);
    expect(mocks.flow).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.incident).toHaveBeenCalledWith('processing_failed');
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });

  it.each([false, true])('preserves a new incident safety reply despite human takeover (saved retry=%s)', async retry => {
    const body = 'I crashed my rental car just now.';
    mocks.classify.mockImplementation(input => input === body);
    mocks.silenced.mockResolvedValue(true);
    if (retry) mocks.claim.mockResolvedValue({ action: 'send', reply: 'Fixed safety reply', escalate: true, providerReplyId: null });
    else mocks.flow.mockResolvedValueOnce({ reply: 'Fixed safety reply', escalate: true });
    expect((await POST(inbound({ text: { body } }))).status).toBe(200);
    expect(mocks.classify).toHaveBeenCalledWith(body);
    expect(mocks.suppressSend).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith('972501234567', 'Fixed safety reply');
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('wamid-1', '972501234567');
  });

  it.each([
    ['he', 'image', 'לא אוכל לקרוא תמונות'],
    ['en', 'audio', 'I cannot read images'],
    [undefined, 'document', 'I cannot read images'],
  ])('answers unsupported %s %s honestly without changing saved intake', async (locale, type, marker) => {
    const state = { version: 2, locale, phase: 'booking', step: 'rental_confirm', booking: { childSeats: 0, passengers: 3, customerName: 'Fictional Test', returnDate: '2026-12-13' }, history: [] };
    const original = structuredClone(state);
    mocks.loadState.mockResolvedValue(state);
    expect((await POST(inbound({ type, text: undefined }))).status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.classify).not.toHaveBeenCalled();
    expect(mocks.loadState).toHaveBeenCalledWith('972501234567');
    expect(mocks.saveState).not.toHaveBeenCalled();
    expect(mocks.createRentalRequest).not.toHaveBeenCalled();
    expect(mocks.enqueueHandoff).not.toHaveBeenCalled();
    expect(state).toEqual(original);
    expect(mocks.prepare).toHaveBeenCalledWith('wamid-1', expect.stringContaining(marker), false, expect.any(Object));
    expect(mocks.send).toHaveBeenCalledWith('972501234567', expect.stringContaining('09-9509757'));
    if (!locale) expect(mocks.send.mock.calls[0][1]).toContain('לא אוכל לקרוא תמונות');
    expect(mocks.send.mock.calls[0][1]).toMatch(/הודעת טקסט|text message/u);
    // A provider retry repairs the log, without re-reading state or sending twice.
    const reply = mocks.send.mock.calls[0][1];
    mocks.claim.mockResolvedValue({ action: 'accepted', reply, escalate: false, providerReplyId: 'outbound-1' });
    expect((await POST(inbound({ type, text: undefined }))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.loadState).toHaveBeenCalledTimes(1);
  });

  it('keeps an unsupported attachment silent while a human owns the conversation', async () => {
    mocks.silenced.mockResolvedValue(true);
    expect((await POST(inbound({ type: 'image', text: undefined }))).status).toBe(200);
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.loadState).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.prepare).toHaveBeenCalledWith('wamid-1', '', false, expect.any(Object));
  });
});


describe('manual conversation recovery', () => {
  it('dispatches the original durable manual event without running AI, mutating intake or sending a looped fallback', async () => {
    mocks.manualEventId = 'abandoned-original';
    mocks.claim.mockResolvedValue({ action: 'manual', reply: null, escalate: false, providerReplyId: null });
    const signature = `sha256=${createHmac('sha256', 'local-test-app-secret').update(payload).digest('hex')}`;
    expect((await POST(metaRequest(signature))).status).toBe(200);
    expect(mocks.dispatchHandoff).toHaveBeenCalledWith('abandoned-original', '972501234567');
    expect(mocks.incident).toHaveBeenCalledWith('processing_failed');
    expect(mocks.flow).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
