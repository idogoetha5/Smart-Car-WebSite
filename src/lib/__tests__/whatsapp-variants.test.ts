import { describe, expect, it } from 'vitest';
import { classifyWhatsAppInitialRoute, detectWhatsAppLocale } from '@/lib/whatsapp-flow';

const variants = {
  accident: [
    'תאונה', 'הייתה תאונה', 'תאונע', 'תאונהה', 'התנגשות', 'נכנסו בי', 'פגיעה ברכב', 'נפגעתי בתאונה', 'accident', 'accidnet', 'accidentt', 'car accident', 'crash', 'collision', 'collsion', 'I hit a car', 'hit my car',
  ],
  breakdown: [
    'פנצ׳ר', 'פנצר', 'פנצשר', 'יש תקר', 'בעיה בצמיג', 'הגלגל לא תקין', 'תקלה', 'תקלהה', 'נתקעתי', 'צריך גרירה', 'הרכב לא מניע', 'נדלקה נורת אזהרה', 'המצבר מת', 'flat tire', 'flat tyre', 'puncture', 'puncturee', 'blowout', 'breakdown', 'breakdwon', 'dead battery', 'car stopped', 'warning light', 'I am stuck',
  ],
  rental: [
    'השכרה', 'השכארה', 'אני רוצה להשכיר רכב', 'אני רוצה רכב', 'צריך רכב', 'צריך אוטו', 'מחפש רכב', 'מחפש אוטו', 'רכב חדש', 'רכב לסופש', 'רכב ליומיים', 'rent', 'rental', 'rnetal', 'I want to rent a car', 'I need a car', 'need a car for two days', 'hire car', 'hire a car', 'car hire', 'book a car',
  ],
  existing: [
    'הזמנה קיימת', 'יש לי הזמנה', 'סטטוס הזמנה', 'מספר הזמנה', 'כבר הזמנתי', 'ההזמנה שלי', 'existing booking', 'my booking', 'booking status', 'booking number', 'booking confirmation', 'my reservation', 'reservation', 'already booked',
  ],
} as const;

describe('Large Hebrew and English intent-variation corpus', () => {
  it.each(variants.accident)('routes accident wording safely: %s', (message) => {
    expect(classifyWhatsAppInitialRoute(message, false)).toBe('accident');
  });

  it.each(variants.breakdown)('routes roadside wording safely: %s', (message) => {
    expect(classifyWhatsAppInitialRoute(message, false)).toBe('breakdown');
  });

  it.each(variants.rental)('recognises rental wording: %s', (message) => {
    expect(classifyWhatsAppInitialRoute(message, false)).toBe('rental');
  });

  it.each(variants.existing)('recognises existing-booking wording: %s', (message) => {
    expect(classifyWhatsAppInitialRoute(message, false)).toBe('existing_booking_lookup');
  });

  it.each([
    ['English', 'he', 'en'], ['English please', 'he', 'en'], ['speak English', 'he', 'en'], ['in English', 'he', 'en'],
    ['עברית', 'en', 'he'], ['עברית בבקשה', 'en', 'he'], ['hebrew', 'en', 'he'], ['speak Hebrew', 'en', 'he'],
  ] as const)('switches language naturally: %s', (message, previous, expected) => {
    expect(detectWhatsAppLocale(message, previous)).toBe(expected);
  });
});
