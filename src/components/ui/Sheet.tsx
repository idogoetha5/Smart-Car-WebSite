'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Bottom sheet on a phone; on a computer a side drawer (`drawer`) or a
 * centred dialog. Rendered in a portal so no parent can trap it, closes on
 * Escape or a tap outside, and locks the page scroll while open.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'dialog',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'dialog' | 'drawer';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const panel =
    variant === 'drawer'
      ? 'sm:inset-y-0 sm:left-0 sm:right-auto sm:h-full sm:max-h-none sm:w-[460px] sm:rounded-none sm:rounded-r-3xl'
      : 'sm:inset-auto sm:left-1/2 sm:top-[8vh] sm:-translate-x-1/2 sm:w-[520px] sm:max-h-[84vh] sm:rounded-3xl';

  return createPortal(
    <div className="fixed inset-0 z-50" dir="rtl" role="dialog" aria-modal="true">
      <button type="button" aria-label="סגירה" onClick={onClose} className="absolute inset-0 bg-[#0D2B2B]/40 backdrop-blur-[2px] animate-fade-in" />
      <div className={`absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up ${panel}`}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <div className="min-w-0 text-lg font-black text-[#0D2B2B]">{title}</div>
          <button onClick={onClose} aria-label="סגירה" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-gray-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
