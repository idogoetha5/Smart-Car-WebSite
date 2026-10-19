// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AdminSheet from "@/components/admin/AdminSheet";
import { officeSheetViewport } from "@/lib/office-sheet-viewport";

describe("office sheet visible viewport geometry", () => {
  it("lifts the footer above a phone keyboard and limits the scrollable sheet", () => {
    expect(
      officeSheetViewport({ height: 440, offsetTop: 20, scale: 1 }, 800),
    ).toEqual({ height: 404, bottom: 340, top: 37 });
  });
  it("does not lift the footer for a browser toolbar or a resized layout viewport", () => {
    expect(
      officeSheetViewport({ height: 760, offsetTop: 0, scale: 1 }, 800)?.bottom,
    ).toBe(0);
    expect(
      officeSheetViewport({ height: 440, offsetTop: 0, scale: 1 }, 440)?.bottom,
    ).toBe(0);
  });
  it("leaves pinch zoom and invalid geometry to the native browser", () => {
    expect(
      officeSheetViewport({ height: 400, offsetTop: 50, scale: 2 }, 800),
    ).toBeNull();
    expect(
      officeSheetViewport({ height: NaN, offsetTop: 0, scale: 1 }, 800),
    ).toBeNull();
    expect(
      officeSheetViewport({ height: 0, offsetTop: 0, scale: 1 }, 800),
    ).toBeNull();
  });
});

let root: Root;
let host: HTMLDivElement;
let previousViewport: PropertyDescriptor | undefined;
let previousHeight: PropertyDescriptor | undefined;
let viewport: EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  previousViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
  previousHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
  viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
    scale: 1,
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (previousViewport)
    Object.defineProperty(window, "visualViewport", previousViewport);
  else Reflect.deleteProperty(window, "visualViewport");
  if (previousHeight)
    Object.defineProperty(window, "innerHeight", previousHeight);
});
it("reacts to keyboard opening/scrolling/closing without remounting or losing typed text", async () => {
  await act(async () =>
    root.render(
      createElement(
        AdminSheet,
        {
          open: true,
          onClose: () => {},
          title: "פנייה לבדיקה",
          footer: createElement("button", null, "שמירה"),
          children: createElement("input", {
            defaultValue: "טקסט שלא נשמר עדיין",
            "aria-label": "הערה",
          }),
        },
      ),
    ),
  );
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const input = dialog.querySelector("input")!;
  expect(dialog.style.getPropertyValue("--office-sheet-bottom")).toBe("0px");
  await act(async () => {
    viewport.height = 460;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(dialog.style.getPropertyValue("--office-sheet-bottom")).toBe("340px");
  expect(dialog.style.getPropertyValue("--office-sheet-height")).toBe("423px");
  await act(async () => {
    viewport.offsetTop = 20;
    viewport.dispatchEvent(new Event("scroll"));
  });
  expect(dialog.style.getPropertyValue("--office-sheet-bottom")).toBe("320px");
  expect(dialog.querySelector("input")).toBe(input);
  expect(input.value).toBe("טקסט שלא נשמר עדיין");
  await act(async () => {
    viewport.height = 800;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(dialog.style.getPropertyValue("--office-sheet-bottom")).toBe("0px");
  expect(dialog.querySelector("button")!.textContent).not.toBeNull();
});
