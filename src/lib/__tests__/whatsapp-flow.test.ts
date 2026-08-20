import { describe, expect, it } from 'vitest';
import { classifyWhatsAppInitialRoute, detectWhatsAppLocale, requiresHumanHandoff } from '@/lib/whatsapp-flow';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('WhatsApp initial routing', () => {
  it('routes an accident before every ordinary service path', () => {
    expect(classifyWhatsAppInitialRoute('הייתה תאונה עם הרכב', true)).toBe('accident');
  });

  it('routes a flat tyre or roadside fault separately from an accident', () => {
    expect(classifyWhatsAppInitialRoute('יש לי פנצ׳ר בדרך', true)).toBe('breakdown');
    expect(classifyWhatsAppInitialRoute('יש בעיה בצמיג', true)).toBe('breakdown');
  });

  it('routes a new rental request to the rental flow', () => {
    expect(classifyWhatsAppInitialRoute('אני רוצה להזמין רכב', false)).toBe('rental');
    expect(classifyWhatsAppInitialRoute('I want to rent a car', false)).toBe('rental');
  });

  it.each([
    ['צריך אוטו ליומיים', 'rental'],
    ['מחפש רכב לסופש', 'rental'],
    ['I need a car for the weekend', 'rental'],
    ['Can I hire a car?', 'rental'],
    ['ההזמנה שלי', 'existing_booking_lookup'],
    ['מספר ההזמנה שלי', 'existing_booking_lookup'],
    ['my reservation', 'existing_booking_lookup'],
    ['booking confirmation number', 'existing_booking_lookup'],
    ['נכנסו בי עם הרכב', 'accident'],
    ['I had a collision', 'accident'],
    ['נגמר המצבר ואני תקוע', 'breakdown'],
    ['The car has a dead battery', 'breakdown'],
    ['I have a tire blowout', 'breakdown'],
  ] as const)('recognises common route wording: %s', (message, expected) => {
    expect(classifyWhatsAppInitialRoute(message, false)).toBe(expected);
  });

  it('recognises an existing customer only when an active booking was matched', () => {
    expect(classifyWhatsAppInitialRoute('שלום', true)).toBe('existing_customer');
    expect(classifyWhatsAppInitialRoute('שלום', false)).toBe('new_customer');
  });

  it('does not mistake an existing booking question for a new rental', () => {
    expect(classifyWhatsAppInitialRoute('יש לי הזמנה קיימת', false)).toBe('existing_booking_lookup');
    expect(classifyWhatsAppInitialRoute('I have an existing booking', false)).toBe('existing_booking_lookup');
  });

  it('detects only Hebrew or English and preserves the selected language', () => {
    expect(detectWhatsAppLocale('Hello')).toBe('en');
    expect(detectWhatsAppLocale('שלום')).toBe('he');
    expect(detectWhatsAppLocale('נתב״ג', 'en')).toBe('en');
    expect(detectWhatsAppLocale('English', 'he')).toBe('en');
    expect(detectWhatsAppLocale('עברית', 'en')).toBe('he');
    expect(detectWhatsAppLocale('English please', 'he')).toBe('en');
    expect(detectWhatsAppLocale('speak English', 'he')).toBe('en');
    expect(detectWhatsAppLocale('עברית בבקשה', 'en')).toBe('he');
  });

  it('does not mistake the Hebrew word for more as a lawyer request', () => {
    expect(requiresHumanHandoff('אני רוצה עוד יום')).toBe(false);
    expect(requiresHumanHandoff('אני רוצה לדבר עם עו״ד')).toBe(true);
  });

  it('does not classify a normal vehicle return as an escalation keyword', () => {
    expect(classifyWhatsAppInitialRoute('אני רוצה להחזיר את הרכב בנתב״ג', true)).toBe('existing_customer');
    expect(requiresHumanHandoff('אני רוצה להחזיר את הרכב בנתב״ג')).toBe(false);
  });

  it('keeps the normal webhook route independent of Claude', () => {
    const webhook = readFileSync(resolve(process.cwd(), 'src/app/api/whatsapp/webhook/route.ts'), 'utf8');
    expect(webhook).not.toContain('getWhatsAppAiReply');
    expect(webhook).toContain('getWhatsAppFlowReply');
    expect(webhook).toContain('refusing 360dialog webhook');
    expect(webhook).not.toContain('accepting 360dialog webhook unverified');
  });
});
