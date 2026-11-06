import { describe, expect, it } from 'vitest';
import { updateCommercialMemory, renderCommercialMemory } from '@/lib/whatsapp-commercial-memory';

describe('durable explicit commercial facts', () => {
  it.each([
    'התקציב שלי עד 2,500 שקל בחודש וחשוב לי רכב משפחתי. עדיין בלי שיחה או פגישה. תזכיר לי איזה תקופה, קילומטראז׳ ותקציב שמרת?',
    'My budget is up to 2500 shekels a month and a family car is important to me. No call or meeting yet. Remind me which term, mileage and budget you kept?',
  ])('preserves an important vehicle requirement beyond conversation history: %s', input => {
    let memory = updateCommercialMemory({ termMonths: 24, annualMileageKm: 15000, usage: ['business'] }, input);
    for (let turn = 0; turn < 14; turn++) memory = updateCommercialMemory(memory, 'What should I check before deciding?');
    expect(memory).toMatchObject({ vehiclePreference: 'family', termMonths: 24, annualMileageKm: 15000, budget: { amount: 2500 } });
    expect(renderCommercialMemory(memory, 'en')).toMatch(/Vehicle preference: family/);
  });
  it.each(['לא חשוב לי רכב משפחתי כרגע.', 'Maybe a family car is important to me, but I need to think.'])('does not turn a negated or hypothetical priority into a category choice: %s', input => {
    expect(updateCommercialMemory({ vehiclePreference: 'compact' }, input).vehiclePreference).toBe('compact');
  });
  it.each([
    'נבחר 24 חודשים במקום 36. לגבי 2,400 ש״ח שמופיעים במחשבון: זה כבר מחיר סופי גם לתקופה הזאת, או רק הערכה? והאם אפשר לצאת מוקדם בלי עלות?',
    'I choose 24 months instead of 36. Is the 2400 calculator price final or only an estimate?',
  ])('records a choice despite an unrelated or-question: %s', message => {
    expect(updateCommercialMemory({ termMonths: null, annualMileageKm: 15000 }, message).termMonths).toBe(24);
  });
  it('does not choose a hypothetical term and honours a later explicit retraction', () => {
    expect(updateCommercialMemory({ termMonths: null }, 'If I choose 24 months instead of 36, would the price change?').termMonths).toBeNull();
    expect(updateCommercialMemory({ termMonths: null }, 'אם נבחר שלושה חודשים, מה תהיה העלות?').termMonths).toBeNull();
    expect(updateCommercialMemory({ termMonths: 36 }, 'I choose 24 months, but actually I am unsure between 24 and 36 months.').termMonths).toBeNull();
  });
  it.each([
    ['מחפש משפחתית בסביבות 65 אלף שקלים, עם מקום לשני ילדים ועגלה. לפני שאני מתקדם, אפשר לקבל היסטוריית טיפולים ותאונות ולבדוק את הרכב עצמאית?', 'בעצם סביב 55 אלף שקלים. מה יהיה המחיר בהצעה?'],
    ['I am looking for a family car around 65k NIS. Can I check its service history?', 'Actually about 55 thousand NIS. What would an offer include?'],
  ])('remembers natural currency budgets and corrections alongside offer questions: %s', (first, correction) => {
    const memory = updateCommercialMemory(undefined, first);
    expect(memory.budget).toEqual({ amount: 65000, currency: 'ILS' });
    expect(memory.vehiclePreference).toBe('family');
    expect(updateCommercialMemory(memory, correction).budget).toEqual({ amount: 55000, currency: 'ILS' });
  });

  it.each(['The calculator price is about 2500 NIS monthly.', 'המחיר במחשבון בסביבות 2500 שקלים לחודש.', 'Around 65000 km a year.'])('does not store reported prices or mileage as a budget: %s', message => {
    expect(updateCommercialMemory(undefined, message).budget).toBeUndefined();
    expect(updateCommercialMemory({ budget: { amount: 65000, currency: 'ILS' } }, message).budget?.amount).toBe(65000);
  });
  it.each([
    ['Make it 24 months.', 'What changes between 24 and 36 months?', 'I am unsure between 24 and 36 months.'],
    ['החלטתי על 24 חודשים.', 'מה ההבדל בין 24 חודשים מול 36 חודשים?', 'אני מתלבט בין 24 חודשים מול 36 חודשים.'],
  ])('keeps a selected term during a comparison question, but clears explicit uncertainty: %s', (choice, question, uncertainty) => {
    const selected = updateCommercialMemory(undefined, choice);
    expect(selected.termMonths).toBe(24);
    const compared = updateCommercialMemory(selected, question);
    expect(compared.termMonths).toBe(24);
    expect(updateCommercialMemory(compared, uncertainty).termMonths).toBeNull();
    expect(updateCommercialMemory(undefined, question).termMonths).toBeNull();
  });
  it.each([
    ['I prefer a family car.', 'Could I view a car in person before deciding? I have not chosen a specific model.'],
    ['מעדיף משפחתי', 'אפשר לראות רכב לפני החלטה? עוד לא בוחר דגם.'],
  ])('retains a category preference when only the exact model is undecided: %s', (choice, question) => {
    const memory = updateCommercialMemory(updateCommercialMemory(undefined, choice), question);
    expect(memory.vehiclePreference).toBe('family');
    expect(updateCommercialMemory(memory, 'Not sure which car type yet.').vehiclePreference).toBeNull();
    expect(updateCommercialMemory(memory, 'No vehicle preference.').vehiclePreference).toBeNull();
  });
  it('captures a natural Hebrew budget-of phrase while the vehicle choice is undecided', () => {
    const memory = updateCommercialMemory(undefined, 'אני רוצה לקנות רכב בתקציב של 70000 שקל. רוב השבוע לבד בעיר ובסופשים זוג ושני ילדים. אני מתלבט בין קטן למשפחתי.');
    expect(memory.budget).toEqual({ amount: 70000, currency: 'ILS' });
  });
  it('retains latest English corrections beyond twelve advisory turns', () => {
    let memory = updateCommercialMemory(undefined, 'My budget is 70000 shekels. I want a compact car, leasing for two years and 12,000 km a year. Mostly city driving.');
    expect(memory).toMatchObject({ budget: { amount: 70000, currency: 'ILS' }, termMonths: 24, annualMileageKm: 12000, vehiclePreference: 'compact' });
    memory = updateCommercialMemory(memory, 'Actually budget now 60000, not 70000. I am unsure whether 24 or 36 months makes sense.');
    expect(memory.termMonths).toBeNull();
    memory = updateCommercialMemory(memory, 'Make it 24 months and 15,000 km annually. I prefer a family car.');
    for (let turn = 0; turn < 14; turn++) memory = updateCommercialMemory(memory, 'What should I check in the offer?');
    const recalled = renderCommercialMemory(memory, 'en');
    expect(recalled).toMatch(/60000 ILS/);
    expect(recalled).toMatch(/24 months/);
    expect(recalled).toMatch(/15000 km/);
    expect(recalled).toMatch(/family/);
    expect(recalled).not.toMatch(/70000|12000|36 months|compact/);
  });

  it('keeps Hebrew corrections without turning a comparison into a selected vehicle', () => {
    let memory = updateCommercialMemory(undefined, 'תקציב 70 אלף שקל, ליסינג לשנתיים, 12000 קמ בשנה. אני רוצה רכב קטן.');
    expect(memory).toMatchObject({ budget: { amount: 70000, currency: 'ILS' }, termMonths: 24, annualMileageKm: 12000, vehiclePreference: 'compact' });
    memory = updateCommercialMemory(memory, 'בעצם התקציב 60000 במקום 70000. מתלבט בין 24 חודשים מול 36 חודשים. קטן או משפחתי?');
    expect(memory.budget?.amount).toBe(60000);
    expect(memory.termMonths).toBeNull();
    expect(memory.vehiclePreference).toBeNull();
    memory = updateCommercialMemory(memory, 'החלטתי על 24 חודשים ו-15000 קמ לשנה. מעדיף משפחתי.');
    expect(memory).toMatchObject({ termMonths: 24, annualMileageKm: 15000, vehiclePreference: 'family' });
    expect(renderCommercialMemory(memory, 'he')).not.toMatch(/70000|12000|36 חודשים|קומפקטי/);
  });

  it('does not treat phone, email, age, booking reference or comparative prices as a budget', () => {
    const memory = updateCommercialMemory(undefined, 'My name is Alex Private. alex@example.invalid, phone 0501234567, age 35, booking 123456. Compare 24 or 36 months. Would a family car fit?');
    expect(memory.budget).toBeUndefined();
    expect(memory.annualMileageKm).toBeUndefined();
    expect(memory.vehiclePreference).toBeUndefined();
    expect(memory.termMonths).toBeNull();
    expect(JSON.stringify(memory)).not.toMatch(/Alex|Private|example|0501234567|123456/);
  });

  it('honours explicit undecided preferences and rejects hypothetical selection', () => {
    let memory = updateCommercialMemory(undefined, 'I want a compact car for three years and 15000 km a year.');
    memory = updateCommercialMemory(memory, 'No vehicle preference now. I do not know the annual mileage.');
    expect(memory.vehiclePreference).toBeNull();
    expect(memory.annualMileageKm).toBeNull();
    memory = updateCommercialMemory(memory, 'Maybe I prefer a family car, but I need to think.');
    expect(memory.vehiclePreference).toBeNull();
  });

  it('accepts labelled annual mileage and ignores superseded negated values', () => {
    let memory = updateCommercialMemory(undefined, 'My annual mileage is 12000. I want a family car for 36 months.');
    memory = updateCommercialMemory(memory, 'Annual mileage now 15000, not 12000. Make it 24 months, not 36 months. Not sure which car yet.');
    expect(memory.annualMileageKm).toBe(15000);
    expect(memory.termMonths).toBe(24);
    expect(memory.vehiclePreference).toBeNull();
  });

  it('stores bounded controlled usage and counts, and fresh state has no prior facts', () => {
    const memory = updateCommercialMemory(undefined, 'For business use, city driving and long trips with kids. 4 passengers and 2 bags. My name is Secret Name, call 0501234567.');
    expect(memory.passengers).toBe(4);
    expect(memory.luggage).toBe(2);
    expect(memory.usage).toEqual(['city', 'family', 'business', 'long_distance']);
    expect(JSON.stringify(memory)).not.toMatch(/Secret|Name|0501234567/);
    expect(updateCommercialMemory(undefined, 'Hello')).toEqual({});
    expect(renderCommercialMemory(undefined, 'en')).not.toMatch(/4|2|business/);
  });
});
