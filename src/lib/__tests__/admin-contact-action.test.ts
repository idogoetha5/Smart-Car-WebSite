import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContactLeadAction from "@/components/admin/ContactLeadAction";
import AdminLeadsPage from "@/app/[locale]/admin/(protected)/leads/page";
import {
  DEFAULT_FOLLOWUP,
  isNewContactLead,
  leadInboxView,
  type AdminLead,
} from "@/lib/admin-leads";

const state = vi.hoisted(() => ({
  items: [] as AdminLead[],
  isLoading: false,
  error: null as Error | null,
  query: "source=contact&status=NEW",
}));
vi.mock("@/lib/swr", () => ({
  useApiList: () => ({ ...state, mutate: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "he" }),
  useSearchParams: () => new URLSearchParams(state.query),
}));
function lead(key: string, status = "NEW"): AdminLead {
  return {
    key,
    name: key,
    source: key.startsWith("contact:") ? "צור קשר" : "השכרה",
    phone: "",
    email: "",
    createdAt: "2026-10-19T10:00:00Z",
    details: "",
    followup: {
      ...DEFAULT_FOLLOWUP,
      status: status as typeof DEFAULT_FOLLOWUP.status,
    },
  };
}
const render = () =>
  renderToStaticMarkup(createElement(ContactLeadAction, { locale: "he" }));
beforeEach(() => {
  state.items = [
    lead("contact:new"),
    lead("contact:handled", "CONTACTED"),
    lead("booking:example"),
  ];
  state.error = null;
  state.isLoading = false;
  state.query = "source=contact&status=NEW";
});
describe("contact quick action", () => {
  it("counts only new contact enquiries and opens that exact inbox view", () => {
    const html = render();
    expect(html).toContain("פנייה חדשה ממתינה לטיפול");
    expect(html).toContain("לטיפול בפניות");
    expect(html).toContain(
      'href="/he/admin/leads?source=contact&amp;status=NEW"',
    );
    expect(state.items.filter(isNewContactLead)).toHaveLength(1);
    const inbox = renderToStaticMarkup(createElement(AdminLeadsPage));
    expect(inbox).toContain("contact:new");
    expect(inbox).not.toContain("contact:handled");
    expect(inbox).not.toContain("booking:example");
    expect(inbox).toContain("1 פניות");
  });
  it("removes a handled enquiry from the count and keeps access to all contact enquiries", () => {
    state.items[0].followup!.status = "CONTACTED";
    const html = render();
    expect(html).toContain("אין פניות חדשות שממתינות לטיפול");
    expect(html).toContain('href="/he/admin/leads?source=contact"');
    state.query = "source=contact";
    const inbox = renderToStaticMarkup(createElement(AdminLeadsPage));
    expect(inbox).toContain("contact:handled");
    expect(inbox).not.toContain("booking:example");
  });
  it("does not show an empty inbox claim while loading or after a failed request", () => {
    state.items = [];
    state.isLoading = true;
    expect(render()).toContain("בודק פניות");
    expect(render()).not.toContain("אין פניות חדשות");
    state.isLoading = false;
    state.error = new Error("Network");
    expect(render()).toContain("הספירה אינה זמינה");
    expect(render()).not.toContain("אין פניות חדשות");
  });
  it("treats a contact without follow-up metadata as new, never a booking", () => {
    expect(
      isNewContactLead({ ...lead("contact:legacy"), followup: null }),
    ).toBe(true);
    expect(
      isNewContactLead({ ...lead("booking:legacy"), followup: null }),
    ).toBe(false);
    for (const status of ["CONTACTED", "QUOTED", "WON", "CLOSED"])
      expect(isNewContactLead(lead("contact:x", status))).toBe(false);
  });
  it("ignores unsupported source/status filters instead of exposing another task queue", () => {
    expect(
      leadInboxView(new URLSearchParams("source=booking&status=NEW")),
    ).toEqual({ source: "", newOnly: false });
    expect(
      leadInboxView(new URLSearchParams("source=contact&status=CLOSED")),
    ).toEqual({ source: "צור קשר", newOnly: false });
  });
});
