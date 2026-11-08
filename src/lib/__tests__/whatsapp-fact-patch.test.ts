import { describe, expect, it } from 'vitest';
import { validateFactPatches, isSelectedFactEvidence, isHypotheticalFactEvidence, factEvidenceNumbers, type FactField } from '../whatsapp-fact-patch';

const set = (field: FactField, evidence: string, value: object, stance = 'selected') => ({ field, operation: 'set', stance, evidence, value });
const money = (evidence: string, number: number, currency = 'ILS') => set('commercialBudget', evidence, { number, currency });

describe('evidenced non-contact fact patches', () => {
  it.each([
    ['My budget is sixty thousand shekels', 60000], ['Actually my budget is seventy thousand shekels', 70000],
    ['התקציב שלי שישים אלף שקל', 60000], ['התקציב עכשיו שבעים אלף שקל', 70000],
    ['budget 65,000 shekels', 65000], ['budget sixty-five thousand shekels', 65000],
    ['תקציב שישים וחמש אלף שקל', 65000],
  ])('normalizes supported amounts: %s', (message, amount) => {
    expect(validateFactPatches([money(message, amount)], message)).toEqual([{ field: 'commercialBudget', operation: 'set', stance: 'selected', evidence: message, value: { amount, currency: 'ILS' } }]);
  });
  it.each(['What if my budget is 90000 shekels?', 'Maybe my budget is 90000 shekels', 'אם התקציב שלי 90000 שקל', 'לא תקציב 90000 שקל'])('rejects non-selected budget: %s', message => {
    const evidence = message.match(/90000 (?:shekels|שקל)/u)![0];
    expect(validateFactPatches([money(evidence, 90000)], message)).toEqual([]);
  });
  it.each(['Maybe 36 months would work?', 'אני שוקל שלוש שנים, עוד לא החלטתי', 'I am not sure about 36 months'])('rejects hypothetical or undecided term: %s', message => {
    expect(validateFactPatches([set('commercialTermMonths', message, { number: 36 })], message)).toEqual([]);
  });
  it('accepts explicit term uncertainty without retaining a chosen number', () => {
    const message = 'I have not decided the term in months';
    expect(validateFactPatches([{ field: 'commercialTermMonths', operation: 'undecided', stance: 'selected', evidence: message }], message)).toHaveLength(1);
  });
  it('converts evidenced years and annual mileage without unrelated numeric inference', () => {
    expect(validateFactPatches([set('commercialTermMonths', 'שלוש שנים', { number: 36 })], 'בחרתי שלוש שנים')).toHaveLength(1);
    expect(validateFactPatches([set('commercialAnnualMileageKm', 'fifteen thousand km per year', { number: 15000 })], 'I drive fifteen thousand km per year')).toHaveLength(1);
    expect(validateFactPatches([set('commercialAnnualMileageKm', 'חמישה עשר אלף קמ בשנה', { number: 15000 })], 'חמישה עשר אלף קמ בשנה')).toHaveLength(1);
    expect(validateFactPatches([set('commercialAnnualMileageKm', '15000 km', { number: 15000 })], '15000 km on this car')).toEqual([]);
  });
  it('lets a later explicit correction follow a hypothetical clause', () => {
    const message = 'What if my budget is 90000 shekels? Actually my budget is seventy thousand shekels';
    const good = 'my budget is seventy thousand shekels';
    expect(validateFactPatches([money('90000 shekels', 90000), money(good, 70000)], message)).toEqual([expect.objectContaining({ value: { amount: 70000, currency: 'ILS' } })]);
  });
  it('keeps the latest supported occurrence independent of proposal order', () => {
    const message = 'budget 60000 shekels; actually budget 70000 shekels';
    expect(validateFactPatches([money('budget 70000 shekels', 70000), money('budget 60000 shekels', 60000)], message)[0]).toMatchObject({ value: { amount: 70000 } });
  });
  it('accepts a category correction in a separate clause and rejects the declined choice', () => {
    const message = 'I no longer need a family car, I want an SUV';
    expect(validateFactPatches([set('commercialVehiclePreference', 'family car', { category: 'family' }), set('commercialVehiclePreference', 'I want an SUV', { category: 'suv' })], message)).toEqual([expect.objectContaining({ value: 'suv' })]);
  });
  it.each(['What if I choose a family car?', 'Maybe a family car', 'I do not want a family car', 'compact or family car', 'What about a family car?', 'מה לגבי רכב משפחתי?'])('rejects tentative/declined/comparison category: %s', message => {
    expect(validateFactPatches([set('commercialVehiclePreference', message, { category: 'family' })], message)).toEqual([]);
  });
  it('accepts polite explicit selection rather than treating would-like as hypothetical', () => {
    const message = 'I would like a family car';
    expect(validateFactPatches([set('rentalVehicleCategory', message, { category: 'family' })], message)).toHaveLength(1);
    expect(isSelectedFactEvidence(message, message)).toBe(true);
  });
  it('validates rental selected category and spoken counts', () => {
    const message = "I'd take the SUV; five travellers; שתי מזוודות; zero child seats";
    const patches = [set('rentalVehicleCategory', "I'd take the SUV", { category: 'suv' }), set('rentalPassengers', 'five travellers', { number: 5 }), set('rentalLuggage', 'שתי מזוודות', { number: 2 }), set('rentalChildSeats', 'zero child seats', { number: 0 })];
    expect(validateFactPatches(patches, message).map(x => x.value)).toEqual(['suv', 5, 2, 0]);
  });
  it('supports explicit removal without interpreting a hypothetical removal as selected', () => {
    const message = 'Please remove my budget';
    const patch = { field: 'commercialBudget', operation: 'remove', stance: 'selected', evidence: message };
    expect(validateFactPatches([patch], message)).toHaveLength(1);
    expect(validateFactPatches([{ ...patch, evidence: 'remove my budget' }], 'What if we remove my budget?')).toEqual([]);
  });
  it('retains explicit Hebrew same-place pickup/return without free text addresses', () => {
    const message = 'מהרצליה ולהחזיר שם';
    const patches = [set('rentalPickupBranch', message, { branch: 'herzliya' }), set('rentalReturnBranch', message, { branch: 'herzliya' })];
    expect(validateFactPatches(patches, message).map(x => x.value)).toEqual(['herzliya', 'herzliya']);
    expect(validateFactPatches(patches, `אולי ${message}`)).toEqual([]);
    expect(validateFactPatches(patches.map(x => ({ ...x, stance: 'discussion' })), message)).toEqual([]);
  });
  it('rejects residence as pickup and invented same-place branches', () => {
    expect(validateFactPatches([set('rentalPickupBranch', 'I live in Herzliya', { branch: 'herzliya' })], 'I live in Herzliya')).toEqual([]);
    expect(validateFactPatches([set('rentalReturnBranch', 'להחזיר שם', { branch: 'airport' })], 'מהרצליה ולהחזיר שם')).toEqual([]);
    expect(validateFactPatches([set('rentalPickupBranch', 'pickup Haifa', { branch: 'haifa' })], 'pickup Haifa')).toEqual([]);
  });
  it.each([
    money('budget 60000 shekels', 70000), money('budget 60000 shekels', 60000, 'USD'),
    set('rentalPassengers', 'budget 60000 shekels', { number: 6 }),
    set('rentalPassengers', '500 passengers', { number: 500 }),
    set('commercialTermMonths', '36 months', { number: -36 }),
    money('budget 60000 shekels and 70000 shekels', 70000),
    { ...money('budget 60000 shekels', 60000), customerName: 'private' },
    { ...money('budget 60000 shekels', 60000), field: 'bookingConfirmed' },
  ])('rejects malformed, unsupported or unrelated proposals %#', patch => {
    expect(validateFactPatches([patch], 'budget 60000 shekels and 70000 shekels; 500 passengers; 36 months')).toEqual([]);
  });
  it.each(['budget 60000 shekels me@example.com', 'budget 60000 shekels 0501234567', 'my name is Jane, budget 60000 shekels', 'budget 60000 shekels street Main'])('rejects private evidence: %s', message => {
    expect(validateFactPatches([money(message, 60000)], message)).toEqual([]);
  });
  it('exposes safe pure guards for local extraction without state mutation', () => {
    const message = 'I no longer need a family car, I want an SUV';
    expect(isSelectedFactEvidence(message, 'family car')).toBe(false);
    expect(isSelectedFactEvidence(message, 'I want an SUV')).toBe(true);
    expect(isHypotheticalFactEvidence('Maybe 36 months would work', '36 months')).toBe(true);
    expect(isSelectedFactEvidence('budget 60000 shekels', 'budget 70000 shekels')).toBe(false);
    expect(factEvidenceNumbers('שבעים אלף שקל')).toEqual([70000]);
  });
  it('rejects prototype keys without throwing', () => {
    expect(validateFactPatches([set('rentalVehicleCategory', 'SUV', { category: 'toString' }), set('rentalPickupBranch', 'pickup Herzliya', { branch: '__proto__' })], 'SUV; pickup Herzliya')).toEqual([]);
  });
  it('requires current verbatim evidence and explicit selected stance', () => {
    expect(validateFactPatches([money('budget 60000 shekels', 60000)], 'budget 70000 shekels')).toEqual([]);
    expect(validateFactPatches([{ ...money('budget 60000 shekels', 60000), stance: 'hypothetical' }], 'budget 60000 shekels')).toEqual([]);
  });
  it('retains the explicit live S12 base budget before a tentative adjustment', () => {
    const message = "Something for the family, two kids and school runs. My budget is sixty thousand shekels, maybe a bit less if possible. I don't want a callback yet, just trying to work out what to look for.";
    const evidence = 'My budget is sixty thousand shekels';
    expect(validateFactPatches([money(evidence, 60000)], message)).toEqual([expect.objectContaining({ value: { amount: 60000, currency: 'ILS' } })]);
    expect(isSelectedFactEvidence(message, evidence)).toBe(true);
    const followup = 'And if I could stretch the budget to 90000 shekels, would an SUV be worth considering? That’s a what-if — keep my original budget for now.';
    expect(validateFactPatches([money('budget to 90000 shekels', 90000)], followup)).toEqual([]);
  });
  it.each(['budget 60,000 shekels, maybe less', 'budget 60,000 shekels، maybe less'])('preserves grouped digits across comma clause splitting: %s', message => {
    expect(validateFactPatches([money('budget 60,000 shekels', 60000)], message)).toHaveLength(1);
  });
  it.each([
    'If my budget is 60000 shekels, maybe that could work. My budget is 60000 shekels',
    'My budget is 60000 shekels. What if my budget is 60000 shekels?',
  ])('uses a supported occurrence when identical evidence is repeated: %s', message => {
    const evidence = 'budget is 60000 shekels';
    expect(validateFactPatches([money(evidence, 60000)], message)).toHaveLength(1);
    expect(isSelectedFactEvidence(message, evidence)).toBe(true);
    expect(isHypotheticalFactEvidence(message, evidence)).toBe(false);
  });
  it('orders repeated evidence by the latest selected occurrence rather than a later hypothetical occurrence', () => {
    const message = 'budget 60000 shekels. budget 70000 shekels. What if budget 60000 shekels?';
    expect(validateFactPatches([money('budget 60000 shekels', 60000), money('budget 70000 shekels', 70000)], message)[0]).toMatchObject({ value: { amount: 70000 } });
  });

  it('keeps uncertainty and conditional scope across commas without losing a later explicit correction', () => {
    expect(validateFactPatches([set('rentalVehicleCategory', 'I want an SUV', { category: 'suv' })], 'If the car is available, I want an SUV')).toEqual([]);
    expect(validateFactPatches([set('rentalVehicleCategory', 'family car', { category: 'family' })], 'family car, I am not sure')).toEqual([]);
    expect(validateFactPatches([set('rentalVehicleCategory', 'I want an SUV', { category: 'suv' })], 'If the car is available, maybe family; actually I want an SUV')).toHaveLength(1);
  });

  it('keeps the fixed EN leasing explicit budget after a completed tentative choice', () => {
    const message = 'I am considering business leasing for a family car, budget 2500 shekels a month. I am unsure whether 24 or 36 months makes sense.';
    expect(validateFactPatches([money('budget 2500 shekels a month', 2500)], message)).toEqual([expect.objectContaining({ value: { amount: 2500, currency: 'ILS' } })]);
    expect(isSelectedFactEvidence(message, 'budget 2500 shekels a month')).toBe(true);
  });
  it.each([
    ['אני שוקל ליסינג לרכב משפחתי, תקציב 2500 שקל לחודש', 'תקציב 2500 שקל לחודש'],
    ['Maybe a family car, budget 2500 shekels a month', 'budget 2500 shekels a month'],
  ])('separates tentative product choice from explicit budget: %s', (message, evidence) => {
    expect(validateFactPatches([money(evidence, 2500)], message)).toHaveLength(1);
  });
  it.each(['If available, I want an SUV', 'Suppose it is available, I want an SUV', 'Maybe, I want an SUV', 'אם יש רכב, I want an SUV', 'אולי, I want an SUV'])('preserves conditional antecedent scope: %s', message => {
    expect(validateFactPatches([set('rentalVehicleCategory', 'I want an SUV', { category: 'suv' })], message)).toEqual([]);
  });

  it.each([
    ['one small bag', 'small bag'], ['one small bag', 'small'], ['מזוודה קטנה אחת', 'קטנה'],
  ])('does not promote luggage size into a selected category: %s / %s', (message, evidence) => {
    expect(validateFactPatches([set('rentalVehicleCategory', evidence, { category: 'compact' })], message)).toEqual([]);
  });
  it('distinguishes a capacity question from an explicit travelling group', () => {
    expect(validateFactPatches([set('rentalPassengers', 'five passengers', { number: 5 })], 'Can that car fit five passengers?')).toEqual([]);
    expect(validateFactPatches([set('rentalPassengers', 'five passengers', { number: 5 })], 'We will be five passengers')).toHaveLength(1);
  });
  it.each([['something small', 'compact'], ["I'd take the SUV", 'suv']])('preserves actual category selection: %s', (message, category) => {
    expect(validateFactPatches([set('rentalVehicleCategory', message, { category })], message)).toHaveLength(1);
  });
  it('accepts two explicit branches using separate narrow evidence spans', () => {
    const message = 'pickup Herzliya, return Tel Aviv';
    expect(validateFactPatches([set('rentalPickupBranch', 'pickup Herzliya', { branch: 'herzliya' }), set('rentalReturnBranch', 'return Tel Aviv', { branch: 'telaviv' })], message).map(x => x.value)).toEqual(['herzliya', 'telaviv']);
  });

});
