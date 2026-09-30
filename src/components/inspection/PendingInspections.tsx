'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { listDrafts, OfflineError, sendDraft, type InspectionDraft } from '@/lib/inspection-outbox';

type RowState = { status: 'waiting' | 'sending' | 'sent' | 'error'; message?: string; inspectionId?: string };

/**
 * Inspections saved on this phone that haven't reached the server yet
 * (no signal when the driver pressed send, or the app was closed). They
 * are sent automatically when the connection is back.
 */
export default function PendingInspections() {
  const [drafts, setDrafts] = useState<InspectionDraft[]>([]);
  const [state, setState] = useState<Record<string, RowState>>({});
  const busy = useRef(false);

  const sendAll = useCallback(async () => {
    if (busy.current || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    busy.current = true;
    try {
      const list = await listDrafts();
      setDrafts(list);
      for (const d of list) {
        setState((s) => ({ ...s, [d.localId]: { status: 'sending' } }));
        try {
          const id = await sendDraft(d, () => {});
          setState((s) => ({ ...s, [d.localId]: { status: 'sent', inspectionId: id } }));
        } catch (err) {
          setState((s) => ({
            ...s,
            [d.localId]: err instanceof OfflineError ? { status: 'waiting' } : { status: 'error', message: (err as Error).message },
          }));
          if (err instanceof OfflineError) break;
        }
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    listDrafts().then(setDrafts);
    void sendAll();
    window.addEventListener('online', sendAll);
    const timer = window.setInterval(sendAll, 60_000);
    return () => {
      window.removeEventListener('online', sendAll);
      window.clearInterval(timer);
    };
  }, [sendAll]);

  if (drafts.length === 0) return null;

  return (
    <section className="mx-4 mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" dir="rtl">
      <p className="mb-2 flex items-center gap-2 font-black text-amber-800">
        <WifiOff className="h-5 w-5" aria-hidden="true" />
        בדיקות שמורות בטלפון ({drafts.length})
      </p>
      <ul className="space-y-2">
        {drafts.map((d) => {
          const st = state[d.localId] ?? { status: 'waiting' };
          return (
            <li key={d.localId} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
              <span className="font-bold text-gray-700">
                {d.type === 'pickup' ? 'מסירה' : 'החזרה'} · {new Date(d.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {st.status === 'sent' && st.inspectionId ? (
                <Link href={`/driver/inspection/${encodeURIComponent(st.inspectionId)}/sign`} className="rounded-lg bg-[#E8743B] px-3 py-2 font-black text-white">
                  לחתימת הלקוח
                </Link>
              ) : st.status === 'sending' ? (
                <span className="font-bold text-gray-500">שולח…</span>
              ) : st.status === 'error' ? (
                <button type="button" onClick={() => void sendAll()} className="font-bold text-red-600 underline">
                  נכשל — נסה שוב
                </button>
              ) : (
                <button type="button" onClick={() => void sendAll()} className="font-bold text-amber-800 underline">
                  ממתין לקליטה — שלח עכשיו
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
