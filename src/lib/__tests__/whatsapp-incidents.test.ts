import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportBotIncident, sendHandoffEmail } from '@/lib/whatsapp-incidents';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
function setup() {
  vi.stubEnv('RESEND_API_KEY', 'fictional-key');
  vi.stubEnv('WHATSAPP_INCIDENT_EMAIL', 'owner@example.com');
  const send = vi.fn(); vi.stubGlobal('fetch', send); return send;
}
const accepted = () => new Response(JSON.stringify({ id: 'fictional-id' }), { status: 200 });
describe('bot incident notification', () => {
  it('sends a non-customer-data incident to the configured owner', async () => {
    const send = setup().mockResolvedValue(accepted());
    expect(await reportBotIncident('delivery_failed')).toBe(true);
    const options = send.mock.calls[0][1];
    expect(JSON.parse(options.body).to).toEqual(['owner@example.com']);
    expect(JSON.parse(options.body).text).toContain('delivery_failed');
    expect(options.headers['Idempotency-Key']).toContain('smartcar-bot/delivery_failed/');
    expect(options.body).not.toContain('fictional-key');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('recovers from a temporary email failure with exactly the same payload and key', async () => {
    const send = setup().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(accepted());
    expect(await reportBotIncident('processing_failed')).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1].body).toBe(send.mock.calls[1][1].body);
    expect(send.mock.calls[0][1].headers).toEqual(send.mock.calls[1][1].headers);
  });
  it('bounds retries on an outage and reports failure honestly', async () => {
    const send = setup().mockRejectedValue(new Error('network down'));
    expect(await reportBotIncident('processing_failed')).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('does not retry invalid credentials', async () => {
    const send = setup().mockResolvedValue(new Response('', { status: 401 }));
    expect(await reportBotIncident('delivery_failed')).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('does not report delivery merely because a malformed response had status 200', async () => {
    setup().mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await reportBotIncident('test')).toBe(false);
  });
  it('refuses to send if the owner destination is missing', async () => {
    const send = setup(); vi.stubEnv('WHATSAPP_INCIDENT_EMAIL', '');
    expect(await reportBotIncident('test')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it('alerts the configured operator about a handoff without email content from the conversation', async () => {
    const send = setup().mockResolvedValue(accepted());
    vi.stubEnv('WHATSAPP_ALERT_EMAIL', 'operator@example.com');
    expect(await sendHandoffEmail('fictional-wamid-1', '972500000001')).toBe(true);
    const options = send.mock.calls[0][1];
    const message = JSON.parse(options.body);
    expect(message.to).toEqual(['operator@example.com']);
    expect(message.text).toContain('972500000001');
    expect(message.text).not.toContain('fictional-wamid-1');
    expect(options.headers['Idempotency-Key']).toMatch(/^smartcar-handoff\/[0-9a-f]{32}$/);
  });
  it('clearly marks the handoff probe as fictional', async () => {
    const send = setup().mockResolvedValue(accepted());
    vi.stubEnv('WHATSAPP_ALERT_EMAIL', 'operator@example.com');
    expect(await sendHandoffEmail('fictional-test', 'fictional', true)).toBe(true);
    const message = JSON.parse(send.mock.calls[0][1].body);
    expect(message.subject).toContain('אין פנייה אמיתית');
    expect(message.text).not.toContain('fictional');
  });
});
