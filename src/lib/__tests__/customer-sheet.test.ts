import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteEq = vi.fn().mockResolvedValue({ error: null });
const updateEq = vi.fn().mockResolvedValue({ error: null });
const maybeSingle = vi
  .fn()
  .mockResolvedValue({ data: { attempts: 0 }, error: null });
const from = vi.fn(() => ({
  delete: () => ({ eq: deleteEq }),
  select: () => ({ eq: () => ({ maybeSingle }) }),
  update: () => ({ eq: updateEq }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from }),
}));

import {
  syncCustomerToSheet,
  type CustomerSheetRow,
} from "@/lib/customer-sheet";

const row: CustomerSheetRow = {
  id: "form-123",
  createdAt: "2026-09-29T08:00:00.000Z",
  fullName: "Test Customer",
  dateOfBirth: "1990-01-01",
  passportNumber: "123456789",
  driverLicenseNumber: "987654321",
  country: "Israel",
  city: "Tel Aviv",
  address: "Test Street 1",
  phone: "+972501234567",
  email: "test@example.com",
  locale: "he",
};

describe("Google Sheets customer sync", () => {
  beforeEach(() => {
    process.env.CUSTOMER_SHEETS_WEBHOOK_URL = "https://example.test/sheets";
    process.env.CUSTOMER_SHEETS_WEBHOOK_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a transient failure and clears the outbox after success", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncCustomerToSheet(row);

    expect(result).toEqual({ ok: true, attempts: 2, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deleteEq).toHaveBeenCalledWith("form_id", row.id);
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(payload).toEqual({ secret: "test-secret", row });
  });

  it("does not retry a permanent 4xx response and leaves the form queued", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncCustomerToSheet(row);

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateEq).toHaveBeenCalledWith("form_id", row.id);
  });
});
