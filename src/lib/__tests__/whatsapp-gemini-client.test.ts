import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-only');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('replacement Gemini connection', () => {
  it('returns text and ignores internal thinking parts', async () => {
    const { generateSmartCarContent } = await import('@/lib/whatsapp-gemini-client');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: 'private reasoning' }, { text: '{"intent":"policy"}' }] } }] })));
    expect(await generateSmartCarContent({ model: 'test-success', body: { contents: [] } })).toEqual({ ok: true, text: '{"intent":"policy"}' });
  });
  it.each([429, 503, 403, 404])('uses immediate local fallback and cooldown after HTTP %s', async (status) => {
    const { generateSmartCarContent } = await import('@/lib/whatsapp-gemini-client');
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status }));
    const params = { model: `test-${status}`, body: {} };
    expect(await generateSmartCarContent(params)).toMatchObject({ ok: false, reason: 'http', status });
    expect(await generateSmartCarContent(params)).toMatchObject({ ok: false, reason: 'cooldown' });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('contains network/timeout failures without throwing', async () => {
    const { generateSmartCarContent } = await import('@/lib/whatsapp-gemini-client');
    vi.mocked(fetch).mockRejectedValue(new DOMException('deadline', 'TimeoutError'));
    expect(await generateSmartCarContent({ model: 'test-timeout', body: {} })).toEqual({ ok: false, reason: 'timeout' });
  });
  it('does not call the provider without a key', async () => {
    const { generateSmartCarContent } = await import('@/lib/whatsapp-gemini-client');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await generateSmartCarContent({ model: 'test-no-key', body: {} })).toEqual({ ok: false, reason: 'missing_key' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
