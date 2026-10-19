import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  followupDue,
  followupSchema,
  israelDateTimeInput,
  israelInputToIso,
  type AdminLead,
} from "@/lib/admin-leads";
import { PATCH } from "@/app/api/admin/contact-leads/[id]/route";

const mocks = vi.hoisted(() => ({
  authorized: true,
  exists: true,
  update: vi.fn(),
  insert: vi.fn(),
  result: { data: { version: 2 }, error: null } as {
    data: unknown;
    error: { code: string } | null;
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "test-session" }) }),
}));
vi.mock("@/lib/admin-auth", () => ({
  verifyAdminToken: async () => mocks.authorized,
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "contact_leads"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mocks.exists ? { id: "contact-fixture" } : null,
                  error: null,
                }),
              }),
            }),
          }
        : { insert: mocks.insert, update: mocks.update },
  }),
}));
const payload = {
  status: "CONTACTED",
  assignee: "דניאל",
  follow_up_at: "2026-11-01T10:00:00Z",
  internal_note: "Private note",
  version: 1,
};
const call = (body: unknown = payload) =>
  PATCH(
    new Request("https://example.invalid", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "contact-fixture" }) },
  );
beforeEach(() => {
  mocks.authorized = true;
  mocks.exists = true;
  mocks.result = { data: { ...payload, version: 2 }, error: null };
  mocks.update
    .mockReset()
    .mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => ({ maybeSingle: async () => mocks.result }),
        }),
      }),
    });
  mocks.insert
    .mockReset()
    .mockReturnValue({ select: () => ({ single: async () => mocks.result }) });
});

describe("contact-only follow-up access and concurrency", () => {
  it("requires the existing office session", async () => {
    mocks.authorized = false;
    expect((await call()).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses a booking/bot id that is not a contact-form enquiry", async () => {
    mocks.exists = false;
    expect((await call()).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejects unsupported fields and invalid dates", async () => {
    expect(
      followupSchema.safeParse({ ...payload, booking_id: "do-not-touch" })
        .success,
    ).toBe(false);
    expect((await call({ ...payload, follow_up_at: "tomorrow" })).status).toBe(
      400,
    );
  });
  it("saves an existing contact with an incremented version", async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CONTACTED", version: 2 }),
    );
  });
  it("reports a concurrent edit without overwriting it", async () => {
    mocks.result = { data: null, error: null };
    expect((await call()).status).toBe(409);
    mocks.result = { data: null, error: { code: "23505" } };
    expect((await call({ ...payload, version: 0 })).status).toBe(409);
  });
});

describe("Israel reminder dates", () => {
  it.each(["2026-07-15T09:30", "2026-12-15T09:30", "2040-02-18T12:00"])(
    "round-trips %s in the Israel timezone",
    (value) => {
      expect(israelDateTimeInput(israelInputToIso(value))).toBe(value);
    },
  );
  it("uses daylight-saving and winter offsets without the phone timezone", () => {
    expect(israelInputToIso("2026-07-15T09:30")).toBe(
      "2026-07-15T06:30:00.000Z",
    );
    expect(israelInputToIso("2026-12-15T09:30")).toBe(
      "2026-12-15T07:30:00.000Z",
    );
    expect(() => israelInputToIso("2026-02-30T09:00")).toThrow();
  });
  it("does not remind on closed enquiries or non-contact sources", () => {
    const lead = {
      followup: { ...payload, status: "WON", version: 2 },
    } as AdminLead;
    expect(followupDue(lead, Date.parse("2027-01-01"))).toBe(false);
    expect(followupDue({ followup: null } as AdminLead)).toBe(false);
  });
});
