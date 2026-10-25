import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), evaluation: vi.fn() }));
vi.mock('@/lib/whatsapp-gemini-client', () => ({ generateSmartCarContent: mocks.generate, readJson: JSON.parse }));
vi.mock('@/lib/whatsapp-model-evaluation', () => ({ activeModelEvaluation: mocks.evaluation }));
import { readBotTurn } from '@/lib/whatsapp-rebuild-gemini';

const context = { locale: 'he' as const, phase: 'explore' as const, recent: [], known: {}, today: '2026-10-25' };
beforeEach(() => { vi.clearAllMocks(); mocks.evaluation.mockReturnValue(undefined); });

describe('replacement Gemini boundary', () => {
  it('uses only the approved customer model and keeps contact details out of its request', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'compact', reply: 'רכב קומפקטי הוא כיוון לבדיקה. לאילו ימים?', fields: {} }) });
    const result = await readBotTurn('קוראים לי דניאל כהן. אני צריך רכב. המייל שלי daniel@example.com והטלפון 0501234567, איסוף ברחוב הרצל 5', context);
    expect(result?.model).toBe('gemini-3.5-flash-lite');
    const call = mocks.generate.mock.calls[0][0];
    expect(call.model).toBe('gemini-3.5-flash-lite');
    expect(JSON.stringify(call.body)).not.toMatch(/דניאל כהן|daniel@example.com|0501234567|הרצל 5/);
  });

  it('accepts extracted facts only when their evidence occurs in the current customer message', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'family', reply: 'נבדוק משפחתית. לאילו ימים?', fields: { pickupLocation: { value: 'הרצליה', evidence: 'מהרצליה' }, luggage: { value: '2', evidence: 'שתי מזוודות' } } }) });
    const result = await readBotTurn('אנחנו עם שתי מזוודות לטיול בצפון', context);
    expect(result?.fields.pickupLocation).toBeUndefined();
    expect(result?.fields.luggage).toEqual({ value: '2', evidence: 'שתי מזוודות' });
  });

  it('keeps the private comparison model in the authenticated evaluation scope', async () => {
    mocks.evaluation.mockReturnValue({ model: 'gemini-3.8-flash' });
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'social', direction: 'none', reply: 'שלום!', fields: {} }) });
    await readBotTurn('שלום', context);
    expect(mocks.generate.mock.calls[0][0].model).toBe('gemini-3.8-flash');
  });
});
