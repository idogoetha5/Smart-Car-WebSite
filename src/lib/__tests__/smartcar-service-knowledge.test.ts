import { describe, expect, it } from 'vitest';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';

describe('SmartCar service knowledge — bilingual, published facts only', () => {
  it.each([
    ['ביטוח והשתתפות עצמית', 'he', 'insurance', '/insurance'], ['What insurance cover is included?', 'en', 'insurance', '/insurance'],
    ['למה צריך פיקדון בכרטיס אשראי?', 'he', 'deposit', '/terms'], ['What deposit is needed?', 'en', 'deposit', '/terms'],
    ['מה מדיניות הדלק מלא מלא?', 'he', 'fuel', '/terms'], ['What is the full to full fuel policy?', 'en', 'fuel', '/terms'],
    ['כמה קילומטרים כלולים?', 'he', 'mileage', '/terms'], ['What is the mileage allowance?', 'en', 'mileage', '/terms'],
    ['נהג נוסף ואילו מסמכים צריך?', 'he', 'driver_documents', '/insurance'], ['Can I add an additional driver and what documents are needed?', 'en', 'driver_documents', '/insurance'],
    ['יש לי רישיון זר, אפשר לשכור?', 'he', 'driver_documents', '/insurance'], ['Can I rent with a foreign licence?', 'en', 'driver_documents', '/insurance'],
    ['מה גיל המינימום וותק הרישיון?', 'he', 'age_licence', '/terms'], ['What is the minimum age and licence experience?', 'en', 'age_licence', '/terms'],
    ['אפשר לאסוף בנתבג ולהחזיר בירושלים?', 'he', 'different_location', '/terms'], ['Can I collect at the airport and return elsewhere?', 'en', 'different_location', '/terms'],
    ['איסוף בנתב״ג והחזרה בתל אביב אפשרי?', 'he', 'different_location', '/terms'],
    ['מה מדיניות הביטול והשינוי?', 'he', 'cancellation', '/terms'], ['What is the cancellation policy?', 'en', 'cancellation', '/terms'],
    ['מה קורה אם הרכב לא זמין?', 'he', 'availability', '/terms'], ['What if my car is unavailable?', 'en', 'availability', '/terms'],
    ['מה עושים במקרה של נזק או תאונה?', 'he', 'damage_accident', '/terms'], ['What happens after an accident or damage?', 'en', 'damage_accident', '/terms'],
  ] as const)('%s', (input, locale, topic, href) => {
    const answer = getSmartCarServiceAnswer(input, locale);
    expect(answer).toMatchObject({ topic, href });
    expect(answer?.reply.length).toBeGreaterThan(40);
  });

  it('uses the binding terms as the one canonical cancellation source', () => {
    expect(getSmartCarServiceAnswer('ביטול', 'he')?.reply).toContain('72');
    expect(getSmartCarServiceAnswer('cancel', 'en')?.reply).toContain('72');
  });

  it('answers an additional-driver question directly', () => {
    expect(getSmartCarServiceAnswer('יש אפשרות להוסיף נהג?', 'he')?.reply).toMatch(/אפשר לבקש לצרף נהג נוסף/);
    expect(getSmartCarServiceAnswer('Can I add an extra driver?', 'en')?.reply).toMatch(/add another driver/);
  });

});
