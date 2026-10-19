import { z } from "zod";

export const QUOTE_DRAFT_PREFIX = "smartcar:office-draft:v1:";
export const QUOTE_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
const text = z.string().max(20_000);
const number = z.number().finite();
export const rentalDraftSchema = z.object({
  quoteNumber: text,
  date: text,
  validUntil: text,
  locale: z.enum(["he", "en"]),
  documentMode: z.enum(["quote", "confirmation"]),
  customerName: text,
  customerPhone: text,
  customerEmail: text,
  pickupDate: text,
  returnDate: text,
  pickupTime: text,
  returnTime: text,
  pickupLocation: text,
  returnLocation: text,
  vehicles: z
    .array(
      z.object({
        name: text,
        year: text,
        category: text,
        imageUrl: text,
        dailyPrice: number,
        quantity: number,
      }),
    )
    .min(1)
    .max(4),
  extras: z
    .array(
      z.object({
        id: text,
        labelHe: text,
        labelEn: text,
        price: number,
        billing: z.enum(["day", "flat"]),
        quantity: number,
        selected: z.boolean(),
      }),
    )
    .max(12),
  deliveryFee: number,
  discount: number,
  vatMode: z.enum(["included", "excluded", "not_applicable"]),
  mileageAllowance: text,
  insuranceCoverage: text,
  deposit: text,
  deductible: text,
  fuelPolicy: text,
  notes: text,
});
export const leasingDraftSchema = z.object({
  id: text,
  quoteNumber: text,
  date: text,
  customerName: text,
  customerPhone: text.optional(),
  customerEmail: text,
  companyName: text,
  companyId: text,
  language: z.enum(["he", "en"]).optional(),
  includedTerms: z.array(text).max(100).optional(),
  additionalTerms: z.array(text).max(100).optional(),
  footerNote: text.optional(),
  isBinding: z.boolean().optional(),
  validUntil: text.optional(),
  vehicles: z
    .array(
      z.object({
        name: text,
        subtitle: text,
        trim: text,
        year: text,
        listPrice: number,
        downPayment: number,
        monthlyPrice: number,
        months: number,
        annualKm: number,
        imageUrl: text,
      }),
    )
    .min(1)
    .max(12),
});

export function decodeQuoteDraft<T>(
  raw: string | null,
  schema: z.ZodType<T>,
  now = Date.now(),
): T | null {
  if (!raw || raw.length > 250_000) return null;
  try {
    const envelope = JSON.parse(raw);
    if (
      envelope.version !== 1 ||
      !Number.isFinite(envelope.savedAt) ||
      envelope.savedAt > now + 60_000 ||
      now - envelope.savedAt > QUOTE_DRAFT_TTL
    )
      return null;
    const parsed = schema.safeParse(envelope.value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeQuoteDraft<T>(
  value: T,
  schema: z.ZodType<T>,
  now = Date.now(),
): string {
  const clean = schema.parse(value);
  const raw = JSON.stringify({ version: 1, savedAt: now, value: clean });
  if (raw.length > 250_000) throw new Error("Draft too large");
  return raw;
}

/** Office drafts only: called after successful office logout on a shared device. */
export function clearOfficeDrafts(storage: Storage) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("smartcar:clear-office-drafts"));
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
  keys.forEach((key) => {
    if (key?.startsWith(QUOTE_DRAFT_PREFIX)) storage.removeItem(key);
  });
}
