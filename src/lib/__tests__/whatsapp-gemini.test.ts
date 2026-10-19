import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interpretWhatsAppMessage } from '@/lib/whatsapp-gemini';

const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.WHATSAPP_GEMINI_MODEL;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.WHATSAPP_GEMINI_MODEL;
  else process.env.WHATSAPP_GEMINI_MODEL = originalModel;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const interpretation = {
  intent: 'rental', vehiclePreference: 'SUV', vehicleEvidence: 'SUV',
  pickupLocation: 'הרצליה', pickupEvidence: 'הרצליה',
  dropoffLocation: 'נתבג', dropoffEvidence: 'נתבג', pickupDate: '', dropoffDate: '', pickupTime: '', returnTime: '',
  passengers: 0, acknowledgement: '',
};

describe('Gemini WhatsApp interpreter', () => {
  it('sends a bounded structured classification request and validates its response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(interpretation) }] } }],
    }), { status: 200 }));

    await expect(interpretWhatsAppMessage('צריך SUV מהרצליה ולהחזיר בנתבג', 'menu')).resolves.toEqual({ ...interpretation, source: 'gemini', rawAcknowledgement: '' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect(options?.headers).toEqual(expect.objectContaining({ 'x-goog-api-key': 'test-key' }));
    const body = JSON.parse(String(options?.body));
    expect(body.generationConfig.responseFormat.text.mimeType).toBe('APPLICATION_JSON');
    expect(body.generationConfig.responseFormat.text.schema.required).toContain('intent');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not send personal contact data or name and email collection steps', async () => {
    await interpretWhatsAppMessage('דניאל כהן', 'rental_name');
    await interpretWhatsAppMessage('daniel@example.com', 'menu');
    await interpretWhatsAppMessage('הטלפון שלי 0501234567', 'menu');
    delete process.env.GEMINI_API_KEY;
    await interpretWhatsAppMessage('רוצה רכב', 'menu');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers a published business question locally when no key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await interpretWhatsAppMessage('אפשר לעשן ברכב?', 'menu');
    expect(result?.acknowledgement).toContain('₪500');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a precise address out of the provider context', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(interpretation) }] } }] })));
    await interpretWhatsAppMessage('מה מדיניות הדלק?', 'rental_vehicle', { pickupLocation: 'רחוב הבדיקה 73 הרצליה', locale: 'he' });
    const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
    expect(body).not.toContain('רחוב הבדיקה');
    expect(body).toContain('Herzliya');
  });

  it('does not send an address supplied inline to the provider', async () => {
    await interpretWhatsAppMessage('איסוף ברחוב הבדיקה 73', 'rental_locations');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back on an invalid or failed model response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"intent":"book_without_consent"}' }] } }] }), { status: 200 }));
    await expect(interpretWhatsAppMessage('רוצה רכב', null)).resolves.toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 403 }));
    await expect(interpretWhatsAppMessage('רוצה רכב', null)).resolves.toBeNull();
  });
});
