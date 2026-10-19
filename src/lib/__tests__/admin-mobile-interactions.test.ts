// @vitest-environment happy-dom
import { act, createElement, useCallback, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import AdminBookingsPage from "@/app/[locale]/admin/(protected)/bookings/page";
import { ToastProvider } from "@/components/ui/AppToast";
import { useQuoteDraft } from "@/lib/use-quote-draft";
import { clearOfficeDrafts, QUOTE_DRAFT_PREFIX } from "@/lib/quote-drafts";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "he" }) }));
vi.mock("@/lib/swr", () => ({
  useApiList: () => ({
    items: [
      {
        id: "fixture",
        customer_name: "לקוח לדוגמה",
        status: "PENDING",
        pickup_location: "הרצל 12, תל אביב",
        dropoff_location: "יפו 15, ירושלים",
        pickup_time: "09:15",
        return_time: "17:30",
        extras: ["baby_seat"],
        customer_phone: "0500000000",
      },
    ],
    isLoading: false,
    isValidating: false,
    mutate: mocks.mutate,
  }),
}));

let root: Root;
let host: HTMLDivElement;
function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/he/admin/bookings");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find(
    (el) => el.textContent === text,
  );
  if (!node) throw new Error(`Missing button: ${text}`);
  return node;
}

describe("office booking touch interactions", () => {
  it("keeps the mobile card and opens/closes the complete booking sheet", async () => {
    await act(async () =>
      root.render(
        createElement(ToastProvider, null, createElement(AdminBookingsPage)),
      ),
    );
    await act(async () =>
      (
        document.querySelector(
          '[aria-label="פתיחת כל פרטי ההזמנה של לקוח לדוגמה"]',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(document.querySelector("article")).not.toBeNull();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("הרצל 12, תל אביב");
    expect(dialog.textContent).toContain("יפו 15, ירושלים");
    expect(dialog.textContent).toContain("כיסא בטיחות לילד");
    expect(dialog.textContent).toContain("09:15");
    await act(async () =>
      (
        dialog.querySelector('[aria-label="סגירה"]') as HTMLButtonElement
      ).click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("article")).not.toBeNull();
  });

  it("uses an in-app confirmation, prevents duplicate writes and reports failed mail accurately", async () => {
    const request = vi.fn(async () =>
      Response.json({
        booking: { status: "CONFIRMED" },
        confirmationEmailed: false,
      }),
    );
    vi.stubGlobal("fetch", request);
    await act(async () =>
      root.render(
        createElement(ToastProvider, null, createElement(AdminBookingsPage)),
      ),
    );
    await act(async () => button("אישור הזמנה").click());
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    await act(async () => {
      button("אישור ההזמנה").click();
      button("אישור ההזמנה").click();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("שליחת מייל האישור לא אושרה");
    expect(document.body.textContent).not.toContain("מייל האישור נשלח ללקוח");
  });
});

const schema = z.object({ text: z.string() });
function DraftFixture() {
  const [text, setText] = useState("");
  const value = useMemo(() => ({ text }), [text]);
  const restore = useCallback(
    (saved: { text: string }) => setText(saved.text),
    [],
  );
  const draft = useQuoteDraft(
    "interaction-fixture",
    value,
    schema,
    restore,
    true,
  );
  return createElement(
    "div",
    null,
    createElement("span", { "data-value": true }, text),
    createElement(
      "button",
      { onClick: () => setText("address and extras retained") },
      "Edit",
    ),
    createElement("button", { onClick: draft.discard }, "Discard"),
  );
}
describe("draft lifecycle around refresh/logout", () => {
  it("restores edits after remount, and does not resurrect a discarded draft", async () => {
    await act(async () => root.render(createElement(DraftFixture)));
    await act(async () => button("Edit").click());
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(createElement(DraftFixture)));
    expect(host.querySelector("[data-value]")?.textContent).toBe(
      "address and extras retained",
    );
    await act(async () => button("Discard").click());
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(
      localStorage.getItem(QUOTE_DRAFT_PREFIX + "interaction-fixture"),
    ).toBeNull();
  });
  it("does not write the draft back during logout unmount", async () => {
    await act(async () => root.render(createElement(DraftFixture)));
    await act(async () => button("Edit").click());
    clearOfficeDrafts(localStorage);
    await act(async () => root.unmount());
    root = createRoot(host);
    expect(
      localStorage.getItem(QUOTE_DRAFT_PREFIX + "interaction-fixture"),
    ).toBeNull();
  });
});
