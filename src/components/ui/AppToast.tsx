'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

type Toast = { id: number; text: string; ok: boolean };
const ToastContext = createContext<(text: string, ok?: boolean) => void>(() => {});

/** Small confirmation pill at the bottom ("המשימה נשמרה") instead of browser alerts. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, ok = true) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-8" dir="rtl" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-full bg-[#0D2B2B] px-5 py-3 text-sm font-bold text-white shadow-xl animate-slide-up">
            {t.ok ? <CheckCircle2 className="h-5 w-5 text-[#7fd1b9]" aria-hidden="true" /> : <XCircle className="h-5 w-5 text-red-300" aria-hidden="true" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
