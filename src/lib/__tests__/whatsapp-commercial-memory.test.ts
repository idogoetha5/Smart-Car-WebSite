import { describe, expect, it } from 'vitest';
import { updateCommercialMemory, renderCommercialMemory } from '@/lib/whatsapp-commercial-memory';

describe('durable explicit commercial facts', () => {
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
