import { describe, expect, it } from 'vitest';
import { customerDetailsSchema } from '@/lib/validations';

const validForm = {
  branchId: 'telaviv',
  fullName: 'Jane Example',
  dateOfBirth: '1990-04-12',
  passportNumber: 'P1234567',
  driverLicenseNumber: 'DL-998877',
  country: 'United Kingdom',
  city: 'London',
  address: '10 Example Street',
  phone: '+442071234567',
  israelAddress: '112 HaYarkon, Tel Aviv',
  email: 'jane@example.com',
  locale: 'en',
  invoiceNoticeAccepted: true,
  turnstileToken: 'test-token',
};

describe('customerDetailsSchema', () => {
  it('accepts a complete branch form', () => {
    expect(customerDetailsSchema.safeParse(validForm).success).toBe(true);
  });

  it('no longer needs a postal code', () => {
    expect('postalCode' in validForm).toBe(false);
  });

  it('still accepts a postal code sent by an older open copy of the form', () => {
    expect(customerDetailsSchema.safeParse({ ...validForm, postalCode: 'SW1A 1AA' }).success).toBe(true);
  });

  it('accepts an empty optional Israel address', () => {
    expect(customerDetailsSchema.safeParse({ ...validForm, israelAddress: '' }).success).toBe(true);
  });

  it('rejects an unknown branch', () => {
    expect(customerDetailsSchema.safeParse({ ...validForm, branchId: 'north' }).success).toBe(false);
  });

  it('requires explicit acceptance of the future-charge notice', () => {
    expect(customerDetailsSchema.safeParse({ ...validForm, invoiceNoticeAccepted: false }).success).toBe(false);
  });

  it('rejects undeclared fields', () => {
    expect(customerDetailsSchema.safeParse({ ...validForm, admin: true }).success).toBe(false);
  });
});
