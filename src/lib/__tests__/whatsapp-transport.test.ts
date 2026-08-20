import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

afterEach(() => {
  delete process.env.WHATSAPP_TRANSPORT;
  delete process.env.WHATSAPP_YCLOUD_API_KEY;
  delete process.env.WHATSAPP_BUSINESS_PHONE;
  vi.unstubAllGlobals();
});

describe('YCloud WhatsApp transport', () => {
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

    expect(result).toEqual({ ok: true, waMessageId: 'wamid.ycloud-outbound-1', status: 200 });
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
