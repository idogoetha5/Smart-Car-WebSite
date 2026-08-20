import { describe, expect, it } from 'vitest';
import { getSmartCarServiceAnswer } from '@/lib/smartcar-service-knowledge';
import { composeServiceResponse, detectConversationMood } from '@/lib/service-response';

describe('SmartCar service knowledge — bilingual, published facts only', () => {
  it.each([
    ['ביטוח והשתתפות עצמית', 'he', 'insurance', '/insurance'], ['What insurance cover is included?', 'en', 'insurance', '/insurance'],
    ['למה צריך פיקדון בכרטיס אשראי?', 'he', 'deposit', '/terms'], ['What deposit is needed?', 'en', 'deposit', '/terms'],
    ['מה מדיניות הדלק מלא מלא?', 'he', 'fuel', '/terms'], ['What is the full to full fuel policy?', 'en', 'fuel', '/terms'],
    ['כמה קילומטרים כלולים?', 'he', 'mileage', '/terms'], ['What is the mileage allowance?', 'en', 'mileage', '/terms'],
    ['נהג נוסף ואילו מסמכים צריך?', 'he', 'driver_documents', '/insurance'], ['Can I add an additional driver and what documents are needed?', 'en', 'driver_documents', '/insurance'],
    ['מה גיל המינימום וותק הרישיון?', 'he', 'age_licence', '/terms'], ['What is the minimum age and licence experience?', 'en', 'age_licence', '/terms'],
    ['אפשר לאסוף בנתבג ולהחזיר בירושלים?', 'he', 'different_location', '/terms'], ['Can I collect at the airport and return elsewhere?', 'en', 'different_location', '/terms'],
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

  it('responds to an angry deposit complaint with acknowledgement, facts and no false promise', () => {
    const input = 'למה אתם רוצים ממני 3,000 פיקדון? זה הזוי';
    const answer = getSmartCarServiceAnswer(input, 'he')!;
    const reply = composeServiceResponse({ locale: 'he', input, kind: 'information', answer: answer.reply, nextStep: 'לתנאי הפיקדון: /he/terms', subject: 'גובה הפיקדון' });
    expect(reply).toContain('מבין למה גובה הפיקדון מתסכל');
    expect(reply).toContain('₪3,000');
    expect(reply).not.toMatch(/מצטערים על אי הנוחות|אשמתך|מובטח|סגור/);
  });

  it('keeps context and asks one next thing after a repeated-question complaint', () => {
    const reply = composeServiceResponse({
      locale: 'he', input: 'כבר כתבתי לכם את התאריכים, למה אתם שוב שואלים?', kind: 'complaint',
      state: { step: 'rental_times', pickupDate: '2026-09-10', dropoffDate: '2026-09-14', locale: 'he' },
      answer: 'נכון — אשתמש בפרטים שכבר נמצאים כאן.', nextStep: 'באילו שעות נוח לכם לאסוף ולהחזיר?',
    });
    expect(reply).toContain('איסוף 2026-09-10');
    expect(reply).toContain('באילו שעות');
  });

  it.each([
    ['הטיסה מתעכבת ואני אאחר', 'pressed'], ['I already told you the dates', 'angry'], ['לא בטוח איזה רכב מתאים', 'uncertain'], ['I had an accident', 'urgent'],
  ] as const)('detects a customer state: %s', (input, mood) => expect(detectConversationMood(input)).toBe(mood));
});
