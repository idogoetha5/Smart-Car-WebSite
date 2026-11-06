import { describe, expect, it } from 'vitest';
import { updateCommercialMemory } from '@/lib/whatsapp-commercial-memory';

describe('English leasing category survives natural customer phrasing', () => {
  it.each([
    'I am considering business leasing for a family car, budget 2500 shekels a month.',
    'I would like a quote on leasing for a family car.',
    'Family car for business use.',
  ])('retains an explicit category: %s', input => {
    expect(updateCommercialMemory(undefined, input).vehiclePreference).toBe('family');
  });
  it.each([
    'I am not considering leasing for a family car.',
    'I do not want leasing for a family car.',
    'Maybe leasing for a family car.',
  ])('does not infer a declined or hypothetical preference: %s', input => {
    expect(updateCommercialMemory(undefined, input).vehiclePreference).toBeUndefined();
  });
  it('keeps category uncertainty while comparing alternatives', () => {
    expect(updateCommercialMemory(undefined, 'I am considering leasing for a family car or compact car.').vehiclePreference).toBeNull();
  });
});
