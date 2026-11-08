import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), evaluation: vi.fn() }));
vi.mock('@/lib/whatsapp-gemini-client', () => ({ generateSmartCarContent: mocks.generate, readJson: JSON.parse }));
vi.mock('@/lib/whatsapp-model-evaluation', () => ({ activeModelEvaluation: mocks.evaluation }));
import { readBotTurn } from '@/lib/whatsapp-rebuild-gemini';
import { getSmartCarApprovedFacts } from '@/lib/smartcar-service-knowledge';

const context = { locale: 'he' as const, phase: 'explore' as const, recent: [], known: {}, today: '2026-10-25' };
beforeEach(() => { vi.clearAllMocks(); mocks.evaluation.mockReturnValue(undefined); });

describe('replacement Gemini boundary', () => {
  it('requires structured current facts and validates each before canonical memory can consume it', async () => {
    const input = "I'd take the SUV. Pickup from Herzliya and return in Tel Aviv. Actually five travellers in total.";
    const patch = (field: string, evidence: string, value: object) => ({ field, operation: 'set', stance: 'selected', evidence, value });
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'suv', reply: 'We can check room in the actual model before confirmation.', fields: {}, factPatches: [
      patch('rentalVehicleCategory', "I'd take the SUV", { category: 'suv' }),
      patch('rentalPickupBranch', 'Pickup from Herzliya', { branch: 'herzliya' }),
      patch('rentalReturnBranch', 'return in Tel Aviv', { branch: 'telaviv' }),
      patch('rentalPassengers', 'five travellers in total', { number: 5 }),
      patch('customerName', 'five travellers in total', { number: 5 }),
      patch('rentalPassengers', 'five travellers in total', { number: 9 }),
    ] }) });
    const result = await readBotTurn(input, { ...context, locale: 'en' });
    expect(result?.factPatches).toHaveLength(4);
    expect(result?.factPatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'rentalPickupBranch', value: 'herzliya' }),
      expect.objectContaining({ field: 'rentalReturnBranch', value: 'telaviv' }),
      expect.objectContaining({ field: 'rentalPassengers', value: 5 }),
    ]));
    expect(mocks.generate.mock.calls[0][0].body.generationConfig.responseFormat.text.schema.required).toContain('factPatches');
  });
  it.each([
    'השם הוא רוני סודי. טלפון +44 7700 900123. כרטיס 4111 1111 1111 1111, קוד אבטחה 123, תוקף הכרטיס 12/29.',
    'My name is Casey Secret. +1 (202) 555-0147; card 3782 822463 10005, CVV: 456, expiry 11/2029.',
    'שם: רוני סודי; card 4111111111111111; CVC=987.',
  ])('redacts recognisable private payment/contact details from message, history and string facts: %s', async details => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'service', direction: 'none', reply: 'Please use the official payment channel.', fields: {} }) });
    await readBotTurn(`${details} Pickup 10/12/2026, return 11/02/2027. 15000 km per year.`, {
      ...context, known: { note: details }, recent: [{ from: 'customer', text: details }],
    });
    const payload = JSON.parse(mocks.generate.mock.calls[0][0].body.contents[0].parts[0].text);
    expect(JSON.stringify(payload)).not.toMatch(/רוני סודי|Casey Secret|7700|900123|555-0147|4111|3782|822463|10005|CVV: 456|CVC=987|קוד אבטחה 123|12\/29|11\/2029/);
    expect(payload.message).toContain('10/12/2026');
    expect(payload.message).toContain('11/02/2027');
    expect(payload.message).toContain('15000 km');
  });
  it('passes a correction category and asks for a fresh whole-question answer without rejected draft content', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'policy', direction: 'none', reply: 'A child seat can be requested subject to availability and fit; the exact price depends on the dates and extras.', fields: {} }) });
    await readBotTurn('Can I request a child seat, and what determines the price?', { ...context, locale: 'en', approvedFacts: getSmartCarApprovedFacts('en'), replyCorrection: 'assurance' });
    const body = mocks.generate.mock.calls[0][0].body;
    const payload = JSON.parse(body.contents[0].parts[0].text);
    expect(payload.replyCorrection).toBe('assurance');
    expect(payload).not.toHaveProperty('rejectedDraft');
    expect(body.systemInstruction.parts[0].text).toContain('Regenerate a fresh answer to ALL parts');
  });

  it('supplies approved business grounding and conversation state while redacting customer contacts', async () => {
    const reply = 'For 24 versus 36 months, compare the same car and annual mileage, total payments and exit terms. A family car usually gives more room, while a compact is easier to park. Which matters more to you?';
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'leasing', direction: 'none', reply, fields: {} }) });
    const conversation = { interest: 'leasing' as const, handoffDeferred: true, step: 'menu' as const, completedRequest: false };
    const facts = getSmartCarApprovedFacts('en');
    const result = await readBotTurn('My name is Daniel Cohen. daniel@example.com 0501234567. What changes between 24 and 36 months, and compact versus family?', {
      ...context, locale: 'en', approvedFacts: facts, conversation,
      known: { termMonths: 24, annualMileage: 15000, contact: 'daniel@example.com 0501234567' },
      recent: [{ from: 'customer', text: 'My name is Daniel Cohen. daniel@example.com 0501234567' }],
    });
    const body = mocks.generate.mock.calls[0][0].body;
    const payload = JSON.parse(body.contents[0].parts[0].text);
    expect(payload.conversation).toEqual(conversation);
    expect(payload.known.termMonths).toBe(24);
    expect(payload.known.annualMileage).toBe(15000);
    expect(payload.approvedFacts).toEqual(facts);
    expect(payload.approvedFacts.map((fact: { id: string }) => fact.id)).toEqual(expect.arrayContaining(['insurance', 'vehicle_comparison', 'commercial_enquiry']));
    expect(JSON.stringify(body)).not.toMatch(/Daniel Cohen|daniel@example.com|0501234567/);
    expect(result?.reply).toBe(reply);
    expect(result?.groundedContext).toBe(true);
  });

  it('retains a grounded child-seat discussion while dates are undecided without inventing fields', async () => {
    const reply = 'אפשר להמשיך עם תאריכים פתוחים. למשפחתית בדרך כלל יותר מקום, אבל התאמה לעגלה ולכיסא בטיחות תלויה בדגם ובמידות. מה גודל העגלה?';
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'family', reply, fields: {} }) });
    const result = await readBotTurn('התאריכים עוד לא ידועים. קטן או משפחתי עם עגלה וכיסא בטיחות?', { ...context, approvedFacts: getSmartCarApprovedFacts('he'), known: { passengers: 4 }, conversation: { handoffDeferred: true, nextMissingField: 'pickupDate', step: 'rental_dates' } });
    expect(result?.reply).toBe(reply);
    expect(result?.fields).toEqual({});
    expect(result?.groundedContext).toBe(true);
  });

  it('derives the grounding marker from server context rather than model self-report', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'social', direction: 'none', reply: 'Hello!', fields: {}, groundedContext: true }) });
    expect((await readBotTurn('Hello', context))?.groundedContext).toBe(false);
    expect((await readBotTurn('Hello', { ...context, approvedFacts: [] }))?.groundedContext).toBe(false);
  });

  it('uses only the approved customer model and keeps contact details out of its request', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'explore', direction: 'compact', reply: 'רכב קומפקטי הוא כיוון לבדיקה. לאילו ימים?', fields: {} }) });
    const result = await readBotTurn('קוראים לי דניאל כהן. אני צריך רכב. המייל שלי daniel@example.com והטלפון 0501234567, איסוף ברחוב הרצל 5', { ...context, known: { pickupLocation: 'רחוב הרצל 5' } });
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

  it('preserves a customer date range while removing an exact street address', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'book', direction: 'compact', reply: 'נבדוק את הבקשה.', fields: { pickupDate: { value: '2026-11-10', evidence: '10' }, returnDate: { value: '2026-11-13', evidence: '13 בנובמבר' } } }) });
    const result = await readBotTurn('אני רוצה להזמין רכב קטן מ-10 עד 13 בנובמבר, איסוף ברחוב הרצל 5', context);
    const request = JSON.stringify(mocks.generate.mock.calls[0][0].body);
    expect(request).toContain('10 עד 13 בנובמבר');
    expect(request).not.toContain('הרצל 5');
    expect(result?.fields.pickupDate?.value).toBe('2026-11-10');
  });

  it('does not turn luggage into a vehicle choice', async () => {
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'book', direction: 'family', reply: 'נבדוק רכב מתאים.', fields: { vehicleNeed: { value: 'מזוודה אחת', evidence: 'מזוודה אחת' }, luggage: { value: '1', evidence: 'מזוודה אחת' } } }) });
    const result = await readBotTurn('אנחנו עם מזוודה אחת', context);
    expect(result?.fields.vehicleNeed).toBeUndefined();
    expect(result?.fields.luggage?.value).toBe('1');
  });

  it('keeps the private comparison model in the authenticated evaluation scope', async () => {
    mocks.evaluation.mockReturnValue({ model: 'gemini-3.8-flash' });
    mocks.generate.mockResolvedValue({ ok: true, text: JSON.stringify({ route: 'social', direction: 'none', reply: 'שלום!', fields: {} }) });
    await readBotTurn('שלום', context);
    expect(mocks.generate.mock.calls[0][0].model).toBe('gemini-3.8-flash');
  });
});
