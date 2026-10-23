import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardedReply, interpretWhatsAppMessage, singleQuestionReply, withoutUnsupportedOutreach, safeAcknowledgement } from '@/lib/whatsapp-gemini';

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
  it.each(['אני נוסע 25 אלף בשנה', 'I drive 25k per year', '25 thousand km per year'])('retains equivalent explicit quantities without admitting invented numbers: %s', evidence => {
    expect(safeAcknowledgement('25,000 ק״מ בשנה.', evidence)).toBe('25,000 ק״מ בשנה.');
    expect(safeAcknowledgement('26,000 ק״מ בשנה.', evidence)).toBe('');
    expect(safeAcknowledgement('250,000 ק״מ בשנה.', evidence)).toBe('');
  });
  it('does not discard the live leasing correction and replace it with a scripted fallback', async () => {
    const reply = 'ב־25,000 ק״מ בשנה כדאי לבדוק את מכסת הק״מ, מחיר החריגה ותנאי היציאה המוקדמת בחוזה של 24 חודשים.';
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...interpretation, purpose: 'comparison', intent: 'leasing', notificationRequest: false, acknowledgement: 'מעדכן: 25,000 ק״מ בשנה.', reply, asks: 'nothing', conversationMemory: 'הלקוח תיקן ל־25,000 קמ; 3000 הוא אומדן מחשבון, לא תקציב.' }) }] } }] })));
    const result = await interpretWhatsAppMessage('אני נוסע 25 אלף בשנה, לא 15, והגמישות חשובה. מה לבדוק בחוזה?', 'menu', { locale: 'he', knowledgeTopic: 'leasing_terms', conversationMemory: 'מתלבט בין 12 ל־24 חודשים; 15000 קמ; אומדן מחשבון3000' });
    expect(result?.reply).toBe(reply);
    expect(result?.acknowledgement).toBe('מעדכן: 25,000 ק״מ בשנה.');
    expect(result?.reply).not.toMatch(/על החברה|לאיזה סוג|כמה נוסעים/);
  });
  it('retains only the first requested field in a compound question', () => {
    expect(singleQuestionReply('איזה קילומטראז׳ מתאים לך, ובאיזה רכב מדובר?')).toBe('איזה קילומטראז׳ מתאים לך?');
    expect(singleQuestionReply('What is your budget? Which car?')).toBe('What is your budget?');
  });
  it('removes outreach promises without deleting the customer acknowledgement', () => {
    expect(withoutUnsupportedOutreach('רשמתי תקציב 3000. נציג יחזור אליך עם הצעה.')).toBe('רשמתי תקציב 3000.');
    expect(withoutUnsupportedOutreach('הפיקדון עדיין תפוס. אני מעביר את הפנייה לנציג.')).toBe('הפיקדון עדיין תפוס.');
    expect(withoutUnsupportedOutreach("This needs review. I'm transferring your case now.")).toBe('This needs review.');
  });
  it('sends a bounded structured classification request and validates its response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(interpretation) }] } }],
    }), { status: 200 }));

    await expect(interpretWhatsAppMessage('צריך SUV מהרצליה ולהחזיר בנתבג', 'menu')).resolves.toEqual({ ...interpretation, source: 'gemini', model: 'gemini-3.5-flash-lite', rawAcknowledgement: '', reply: '', rawReply: '', asks: 'nothing', conversationMemory: '' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect(options?.headers).toEqual(expect.objectContaining({ 'x-goog-api-key': 'test-key' }));
    const body = JSON.parse(String(options?.body));
    // Wiring evidence only, not a score of Gemini's conversational compliance.
    const instructions = body.systemInstruction.parts.map((part: { text: string }) => part.text).join('\n');
    expect(instructions).toContain('FINAL RESPONSE CONTRACT');
    expect(instructions).toContain('SMARTCAR SERVICE CHARTER');
    expect(instructions.indexOf('SMARTCAR SERVICE CHARTER')).toBeLessThan(instructions.indexOf('COACHING CURRICULUM'));
    expect(instructions.length).toBeLessThan(65000);
    expect(body.generationConfig.responseFormat.text.schema.required).toContain('notificationRequest');
    expect(instructions).toContain('CONVERSATION ACADEMY');
    expect(instructions).toContain('A refundable hold');
    expect(instructions).toContain("nor evidence of the customer's budget");
    expect(instructions).toContain('not a completed subscription');
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

describe('guardedReply', () => {
  it('drops a reply that asks for times, keeps small talk with two questions', () => {
    expect(guardedReply('סגור, מחר 👌 באיזו שעה נוח לך לאסוף?', '')).toBe('');
    expect(guardedReply('היי! מה נשמע? אפשר לעזור במשהו?', '')).toBe('היי! מה נשמע? אפשר לעזור במשהו?');
    expect(guardedReply('סגור, מ־26/10 👌 עד מתי צריך את הרכב?', '26/10')).toBe('סגור, מ־26/10 👌 עד מתי צריך את הרכב?');
  });
});

describe('free model chain', () => {
  it('does not switch models when the selected Gemini is out of quota', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const { generateWithFreeModels, readJson, resetModelCooldowns } = await import('@/lib/whatsapp-gemini-client');
    resetModelCooldowns();
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('gemini-3.5-flash-lite') || url.includes('gemini-3.1-flash-lite')) return new Response('quota', { status: 429 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"reply":"שלום"}\n```' }] } }] }), { status: 200 });
    }));
    const result = await generateWithFreeModels({ systemInstruction: { parts: [{ text: 'x' }] }, generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: { type: 'object' } } } } });
    expect(result.ok).toBe(false);
    expect(calls.map((url) => url.match(/models\/([^:]+)/)?.[1])).toEqual(['gemini-3.5-flash-lite']);
    expect(readJson('```json\n{"reply":"שלום"}\n```')).toEqual({ reply: 'שלום' });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
