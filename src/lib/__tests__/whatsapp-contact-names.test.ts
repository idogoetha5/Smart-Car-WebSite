import { afterEach, describe, expect, it, vi } from 'vitest';
import { getYCloudContactName } from '@/lib/whatsapp-contact-names';

const originalTransport = process.env.WHATSAPP_TRANSPORT;
const originalKey = process.env.WHATSAPP_YCLOUD_API_KEY;

afterEach(() => {
  process.env.WHATSAPP_TRANSPORT = originalTransport;
  process.env.WHATSAPP_YCLOUD_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe('YCloud names for existing WhatsApp conversations', () => {
  it('reads the WhatsApp nickname and caches it without exposing the key to the browser', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_API_KEY = 'test-only-key';
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ nickname: '  נועה \n כהן ', remarkName: 'Office name' }) }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await getYCloudContactName('972501234581')).toBe('נועה  כהן');
    expect(await getYCloudContactName('972501234581')).toBe('נועה  כהן');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.ycloud.com/v2/contact/contacts/%2B972501234581');
  });

  it('uses a saved contact remark when the WhatsApp nickname is absent', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_API_KEY = 'test-only-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ remarkName: '  לקוח ותיק  ' }) })));
    expect(await getYCloudContactName('972501234582')).toBe('לקוח ותיק');
  });

  it('does not query YCloud for an invalid number', async () => {
    process.env.WHATSAPP_TRANSPORT = 'ycloud';
    process.env.WHATSAPP_YCLOUD_API_KEY = 'test-only-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getYCloudContactName('not-a-phone')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
