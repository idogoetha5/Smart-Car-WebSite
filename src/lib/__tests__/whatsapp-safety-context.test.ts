import { describe, expect, it } from 'vitest';
import { isRebuiltSafetyMessage } from '@/lib/whatsapp-rebuild';

describe('British tyre safety report context', () => {
  it.each([
    'In case of a flat tyre, what should I do?',
    'If we get a puncture, who should we call?',
    'I do not have a flat tyre. I just want to rent a car.',
    'It isn’t a puncture. I only need rental advice.',
    'My own car has a puncture. I need a rental replacement.',
    'Our own vehicle has a flat tyre, so we need a rental car.',
  ])('keeps a non-incident mention out of immediate handoff: %s', message => {
    expect(isRebuiltSafetyMessage(message)).toBe(false);
  });

  it.each([
    'My rental car has a flat tyre and I am in a safe car park.',
    'We have a puncture in the car we rented.',
    'I do not have a flat tyre, but the rental car has a puncture.',
    'My rental car has a flat tyre. Nobody was injured.',
    'My rental car has a flat tire.',
    'No one was hurt and my rental car has a flat tyre.',
    'Would you send help for my rental car with a puncture?',
  ])('still escalates an actual report: %s', message => {
    expect(isRebuiltSafetyMessage(message)).toBe(true);
  });
});
