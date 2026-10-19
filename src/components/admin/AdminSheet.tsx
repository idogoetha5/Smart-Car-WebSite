"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

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
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl focus:outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[5vh] sm:max-h-[90dvh] sm:w-[min(640px,94vw)] sm:-translate-x-1/2 sm:rounded-3xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-black text-[#0D2B2B]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  id={descriptionId}
                  className="mt-1 text-sm leading-6 text-slate-500"
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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
