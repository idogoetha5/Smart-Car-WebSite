"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useCallback,
  useId,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { officeSheetViewport } from "@/lib/office-sheet-viewport";

const serverViewport = () => "";
function useSheetViewport(open: boolean): CSSProperties | undefined {
  const subscribe = useCallback(
    (changed: () => void) => {
      if (!open || !window.visualViewport) return () => {};
      const viewport = window.visualViewport;
      viewport.addEventListener("resize", changed);
      viewport.addEventListener("scroll", changed);
      window.addEventListener("resize", changed);
      return () => {
        viewport.removeEventListener("resize", changed);
        viewport.removeEventListener("scroll", changed);
        window.removeEventListener("resize", changed);
      };
    },
    [open],
  );
  const snapshot = useCallback(() => {
    const viewport = window.visualViewport;
    return open && viewport
      ? `${viewport.height},${viewport.offsetTop},${viewport.scale},${window.innerHeight}`
      : "";
  }, [open]);
  const value = useSyncExternalStore(subscribe, snapshot, serverViewport);
  if (!value) return undefined;
  const [height, offsetTop, scale, layoutHeight] = value.split(",").map(Number);
  const geometry = officeSheetViewport(
    { height, offsetTop, scale },
    layoutHeight,
  );
  return geometry
    ? ({
        "--office-sheet-height": `${geometry.height}px`,
        "--office-sheet-bottom": `${geometry.bottom}px`,
        "--office-sheet-top": `${geometry.top}px`,
      } as CSSProperties)
    : undefined;
}

/** Office-only sheet: focus trapping/return and inert background are handled by Radix. */
export default function AdminSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
  alert = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  alert?: boolean;
}) {
  const descriptionId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const viewportStyle = useSheetViewport(open);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0D2B2B]/45 backdrop-blur-sm" />
        <Dialog.Content
          dir="rtl"
          role={alert ? "alertdialog" : "dialog"}
          aria-describedby={description ? descriptionId : undefined}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected)
              returnFocus.current.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
          style={viewportStyle}
          className="fixed inset-x-0 bottom-[var(--office-sheet-bottom,0px)] z-50 flex max-h-[min(92dvh,var(--office-sheet-height,92dvh))] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl focus:outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[var(--office-sheet-top,5vh)] sm:max-h-[min(90dvh,var(--office-sheet-height,90dvh))] sm:w-[min(640px,94vw)] sm:-translate-x-1/2 sm:rounded-3xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="break-words text-lg font-black text-[#0D2B2B] [overflow-wrap:anywhere] sm:text-xl">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  id={descriptionId}
                  className="mt-1 break-words text-sm leading-6 text-slate-500"
                >
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              disabled={busy}
              aria-label="סגירה"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain scroll-py-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
          {footer && (
            <footer className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
