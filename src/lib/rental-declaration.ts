import { z } from 'zod';
import { digitsOnly, expiryValid, luhnValid } from '@/lib/customer-verification/card';

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default('');
export const declarationSubmission = z.object({
  id: z.uuid(),
  locale: z.enum(['he', 'en']),
  confirmed: z.literal(true),
  token: z.string().max(2048),
  fields: z.object({
    name: text(100),
    idNumber: z.string().regex(/^\d{9}$/),
    street: text(150),
    city: text(80),
    start: z.iso.date(),
    end: z.iso.date().or(z.literal('')),
    cardHolder: text(100),
    cardNumber: z.string().max(24).regex(/^[0-9 ]+$/).transform(digitsOnly).refine(luhnValid),
    cardExpiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/(?:\d{2}|20\d{2})$/).refine((value) => {
      const [month, year] = value.split('/');
      return expiryValid(month, year);
    }),
    signedDate: z.iso.date(),
    renter: text(100),
    companyName: optional(100),
    companyNumber: optional(9).refine((value) => !value || /^\d{9}$/.test(value)),
    companyAddress: optional(150),
    companyPhone: optional(25),
  }),
  signature: z.discriminatedUnion('type', [
    z.object({ type: z.literal('typed'), name: text(100) }),
    z.object({ type: z.literal('drawn'), png: z.string().max(175_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/) }),
  ]),
}).superRefine((data, ctx) => {
  const { fields, signature } = data;
  if (fields.end && fields.start > fields.end) ctx.addIssue({ code: 'custom', path: ['fields', 'end'], message: 'Invalid rental period' });
  if (signature.type === 'typed' && signature.name !== fields.name) {
    ctx.addIssue({ code: 'custom', path: ['signature', 'name'], message: 'Signature must match the signer name' });
  }
});
export type DeclarationSubmission = z.infer<typeof declarationSubmission>;
