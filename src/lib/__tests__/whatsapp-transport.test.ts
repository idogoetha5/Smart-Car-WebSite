import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

afterEach(() => {
  delete process.env.WHATSAPP_TRANSPORT;
  delete process.env.WHATSAPP_YCLOUD_API_KEY;
  delete process.env.WHATSAPP_BUSINESS_PHONE;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('YCloud WhatsApp transport', () => {
  function configure() {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_API_KEY = 'local-test-key';
    process.env.WHATSAPP_BUSINESS_PHONE = '09-9509757';
  }
  it.each([[400, 'rejected'], [429, 'rejected'], [408, 'uncertain'], [503, 'uncertain']] as const)('distinguishes HTTP %s without automatically retrying', async (status, outcome) => {
    configure();
    const request = vi.fn().mockResolvedValue(new Response('{}', { status }));
    vi.stubGlobal('fetch', request);
    expect(await sendWhatsAppMessage('972501234567', 'fictional')).toMatchObject({ ok: false, status, outcome });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(['{}', '{invalid'])('does not report acceptance without a provider reference: %s', async body => {
    configure();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    expect(await sendWhatsAppMessage('972501234567', 'fictional')).toMatchObject({ ok: false, status: 200, outcome: 'uncertain' });
  });
  it('bounds the provider request and treats an interrupted response as uncertain', async () => {
    configure();
    const controller = new AbortController();
    const deadline = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const request = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new Error('simulated disconnect')), { once: true });
    }));
    vi.stubGlobal('fetch', request);
    const pending = sendWhatsAppMessage('972501234567', 'fictional');
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, outcome: 'uncertain' });
    expect(deadline).toHaveBeenCalledWith(8000);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(['', 'x'.repeat(4097)])('does not submit empty or oversized text', async body => {
    configure();
    const request = vi.fn(); vi.stubGlobal('fetch', request);
    expect(await sendWhatsAppMessage('972501234567', body)).toMatchObject({ ok: false, outcome: 'not_sent' });
    expect(request).not.toHaveBeenCalled();
  });
  it('uses YCloud direct send with E.164 sender and recipient numbers', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_API_KEY = 'local-test-key';
    process.env.WHATSAPP_BUSINESS_PHONE = '09-9509757';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'ycloud-message-id',
      wamid: 'wamid.ycloud-outbound-1',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWhatsAppMessage('+972 50 123 4567', 'שלום מ־SmartCar');

    expect(result).toEqual({ ok: true, waMessageId: 'wamid.ycloud-outbound-1', status: 200, outcome: 'accepted' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'local-test-key' }),
        body: JSON.stringify({
          from: '+97299509757',
          to: '+972501234567',
          type: 'text',
          text: { body: 'שלום מ־SmartCar' },
        }),
      })
    );
  });

  it('does not send when the YCloud business number is missing', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_API_KEY = 'local-test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWhatsAppMessage('972501234567', 'Hello');

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
