import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const notifications = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock('@/lib/whatsapp-incidents', () => ({ reportBotIncident: notifications.report }));

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-only');
  vi.stubGlobal('fetch', vi.fn());
  notifications.report.mockReset().mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('replacement Gemini connection', () => {
  it('bounds a content repair by the remaining budget and never switches models', async () => {
    vi.useFakeTimers(); const start=Date.now(); vi.setSystemTime(start);
    const { generateWithFreeModels, resetModelCooldowns } = await import('@/lib/whatsapp-gemini-client'); resetModelCooldowns();
    const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>new AbortController().signal);
    vi.mocked(fetch).mockImplementationOnce(async()=>{
      vi.setSystemTime(start+600);
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'invalid'}]}}]}));
    }).mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{content:{parts:[{text:'valid'}]}}]})));
    expect(await generateWithFreeModels({contents:[]},1000,text=>text==='valid','Use the required output format.')).toMatchObject({ok:true,text:'valid',model:'gemini-3.5-flash-lite'});
    expect(timeout.mock.calls.map(call=>call[0])).toEqual([1000,400]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not use content regeneration to retry a provider failure', async () => {
    const { generateWithFreeModels, resetModelCooldowns } = await import('@/lib/whatsapp-gemini-client'); resetModelCooldowns();
    vi.mocked(fetch).mockResolvedValue(new Response('{}',{status:503}));
    expect(await generateWithFreeModels({},14000,()=>false,'Use the required output format.')).toMatchObject({ok:false,status:503});
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('alerts on outage, avoids hammering during cooldown and confirms recovery only after a valid response', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const { generateSmartCarContent, resetModelCooldowns } = await import('@/lib/whatsapp-gemini-client');
    resetModelCooldowns();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'valid reply' }] } }] })));
    const request = { model: 'recovery-check', body: {} };
    expect(await generateSmartCarContent(request)).toMatchObject({ ok: false, status: 503 });
    expect(notifications.report).toHaveBeenLastCalledWith('ai_unavailable');
    expect(await generateSmartCarContent(request)).toMatchObject({ reason: 'cooldown' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(notifications.report).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2030-01-01T00:00:31Z'));
    expect(await generateSmartCarContent(request)).toEqual({ ok: true, text: 'valid reply' });
    expect(notifications.report).toHaveBeenLastCalledWith('ai_recovered');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('still returns an actionable fallback result if the alert service also fails', async () => {
    const { generateSmartCarContent } = await import('@/lib/whatsapp-gemini-client');
    notifications.report.mockRejectedValue(new Error('mail unavailable'));
    vi.mocked(fetch).mockRejectedValue(new DOMException('deadline', 'TimeoutError'));
    expect(await generateSmartCarContent({ model: 'alert-outage', body: {} })).toEqual({ ok: false, reason: 'timeout' });
  });
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
