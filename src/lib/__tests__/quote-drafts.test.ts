import { describe, expect, it } from "vitest";
import {
  clearOfficeDrafts,
  decodeQuoteDraft,
  encodeQuoteDraft,
  leasingDraftSchema,
  rentalDraftSchema,
  QUOTE_DRAFT_PREFIX,
  QUOTE_DRAFT_TTL,
} from "@/lib/quote-drafts";
import {
  emptyRentalVehicle,
  RENTAL_EXTRA_PRESETS,
  type RentalQuoteData,
} from "@/lib/rental-quote";
import { emptyVehicle, type QuoteData } from "@/lib/quote-pdf";

const rental: RentalQuoteData = {
  quoteNumber: "113309",
  date: "2026-10-19",
  validUntil: "2040-02-18",
  locale: "he",
  documentMode: "quote",
  customerName: "Draft fixture",
  customerPhone: "0500000000",
  customerEmail: "",
  pickupDate: "2026-10-20",
  returnDate: "2026-10-22",
  pickupTime: "09:00",
  returnTime: "11:00",
  pickupLocation: "הרצל 12, תל אביב",
  returnLocation: "",
  vehicles: [emptyRentalVehicle()],
  extras: RENTAL_EXTRA_PRESETS.map((e) => ({ ...e })),
  deliveryFee: 0,
  discount: 0,
  vatMode: "included",
  mileageAllowance: "",
  insuranceCoverage: "",
  deposit: "",
  deductible: "",
  fuelPolicy: "",
  notes: "Keep this draft",
};
const leasing: QuoteData = {
  id: "stable-quote-id",
  quoteNumber: "123456",
  date: "19.10.2026",
  customerName: "Draft fixture",
  customerEmail: "",
  companyName: "",
  companyId: "",
  vehicles: [emptyVehicle()],
};

describe("office draft persistence contract", () => {
  it("restores a partial rental without altering quote number, validity, addresses or extras", () => {
    expect(
      decodeQuoteDraft(
        encodeQuoteDraft(rental, rentalDraftSchema, 1000),
        rentalDraftSchema,
        2000,
      ),
    ).toEqual(rental);
  });
  it("preserves the leasing record identity across reloads", () => {
    expect(
      decodeQuoteDraft(
        encodeQuoteDraft(leasing, leasingDraftSchema),
        leasingDraftSchema,
      ),
    ).toEqual(leasing);
  });
  it("rejects stale, corrupted, future or incompatible drafts", () => {
    const raw = encodeQuoteDraft(rental, rentalDraftSchema, 1000);
    expect(
      decodeQuoteDraft(raw, rentalDraftSchema, QUOTE_DRAFT_TTL + 2000),
    ).toBeNull();
    expect(decodeQuoteDraft(raw, rentalDraftSchema, -100_000)).toBeNull();
    expect(decodeQuoteDraft("{bad", rentalDraftSchema)).toBeNull();
    expect(decodeQuoteDraft(raw, leasingDraftSchema)).toBeNull();
    expect(
      decodeQuoteDraft(
        JSON.stringify({ version: 2, savedAt: 1000, value: rental }),
        rentalDraftSchema,
        2000,
      ),
    ).toBeNull();
  });
  it("strips unrelated properties and refuses unsafe sizes or malformed numbers", () => {
    const withExtra = { ...rental, unexpected: "do not retain" };
    expect(encodeQuoteDraft(withExtra, rentalDraftSchema)).not.toContain(
      "unexpected",
    );
    expect(() =>
      encodeQuoteDraft(
        { ...rental, deliveryFee: Number.NaN },
        rentalDraftSchema,
      ),
    ).toThrow();
    expect(decodeQuoteDraft("x".repeat(250_001), rentalDraftSchema)).toBeNull();
  });
  it("logout clears office drafts only, leaving other apps alone", () => {
    const values = new Map([
      [QUOTE_DRAFT_PREFIX + "rental", "draft"],
      [QUOTE_DRAFT_PREFIX + "leasing", "draft"],
      ["driver-session", "keep"],
    ]);
    const storage: Storage = {
      get length() {
        return values.size;
      },
      key: (i: number) => [...values.keys()][i] ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      clear: () => values.clear(),
    };
    clearOfficeDrafts(storage);
    expect([...values.entries()]).toEqual([["driver-session", "keep"]]);
  });
});
