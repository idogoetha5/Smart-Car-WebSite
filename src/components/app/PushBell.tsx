'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, BellRing, Download, X } from 'lucide-react';
import { brandIconButton } from '@/components/app/Brand';

type State = 'loading' | 'hidden' | 'needs-install' | 'off' | 'denied' | 'on';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/driver/');
  return existing ?? navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver/' });
}

/**
 * Small bell in the top bar of the driver and manager apps. A dot on it
 * means notifications aren't on yet; tapping opens a short sheet to turn
 * them on (sends a test), shows iPhone install steps when needed, and
 * offers one-tap install where the browser supports it.
 */
export default function PushBell({ audience }: { audience: 'driver' | 'manager' }) {
  const [state, setState] = useState<State>('loading');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const set = (s: State) => { if (!cancelled) setState(s); };

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        set(ios && !standalone ? 'needs-install' : 'hidden');
        return;
      }
      const key = await fetch('/api/driver/push').then((r) => r.json()).catch(() => null);
      if (!key?.publicKey) { set('hidden'); return; }
      if (Notification.permission === 'denied') { set('denied'); return; }
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        // Re-save quietly, in case the server cleaned it up.
        void fetch('/api/driver/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        set('on');
      } else {
        set('off');
      }
    })().catch(() => set('hidden'));

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { publicKey } = await fetch('/api/driver/push').then((r) => r.json());
      const reg = await registration();
      await navigator.serviceWorker.ready;
      // The phone's push service can hang when offline — give up after 20s.
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000));
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await Promise.race([
          reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }),
          timeout,
        ]));
      const res = await fetch('/api/driver/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error();
      await fetch('/api/driver/push/test', { method: 'POST' });
      setState('on');
      setMessage({ ok: true, text: 'ההתראות הופעלו. שלחנו התראת ניסיון.' });
    } catch {
      setMessage({ ok: false, text: 'לא הצלחנו להפעיל. בדקו שיש אינטרנט ונסו שוב.' });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    await fetch('/api/driver/push/test', { method: 'POST' }).catch(() => null);
    setBusy(false);
    setMessage({ ok: true, text: 'נשלחה התראת ניסיון.' });
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  };

  if (state === 'loading' || (state === 'hidden' && !installEvent)) return null;

  const what = audience === 'manager' ? 'על כל טופס שנחתם ועל החזרות עם נזקים חדשים' : 'על משימה חדשה, שינוי מועד או ביטול';
  const needsAction = state === 'off' || state === 'needs-install';
  const Icon = state === 'on' ? BellRing : state === 'denied' ? BellOff : Bell;
  const btn = 'min-h-12 w-full rounded-xl text-base font-black';

  return (
    <>
      <button onClick={() => { setOpen(true); setMessage(null); }} className={`${brandIconButton} relative`} aria-label="התראות">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {needsAction && <span className="absolute top-2 end-2 h-2.5 w-2.5 rounded-full bg-[#E8743B] ring-2 ring-white" aria-hidden="true" />}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:pt-20" dir="rtl" role="dialog" aria-modal="true" aria-label="התראות">
          <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-black text-[#0D2B2B]">התראות</p>
              <button onClick={() => setOpen(false)} aria-label="סגירה" className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {state === 'on' && (
              <>
                <p className="text-sm text-gray-600">ההתראות פעילות בטלפון הזה. תקבלו הודעה {what}.</p>
                <button onClick={sendTest} disabled={busy} className={`${btn} mt-4 border-2 border-[#B8D8D8] text-[#2D5F5F] disabled:opacity-50`}>שליחת התראת ניסיון</button>
              </>
            )}
            {state === 'off' && (
              <>
                <p className="text-sm text-gray-600">קבלו הודעה לטלפון {what}.</p>
                <button onClick={enable} disabled={busy} className={`${btn} mt-4 bg-[#2D5F5F] text-white disabled:opacity-50`}>{busy ? 'מפעיל…' : 'הפעלה'}</button>
              </>
            )}
            {state === 'denied' && (
              <p className="text-sm text-gray-600">ההתראות חסומות בטלפון. כדי לקבל הודעות {what}, אפשרו התראות ל־SmartCar בהגדרות הטלפון ורעננו את הדף.</p>
            )}
            {state === 'needs-install' && (
              <p className="text-sm text-gray-600">
                באייפון התראות עובדות רק מהאפליקציה שעל מסך הבית: בספארי לוחצים על כפתור השיתוף ⬆︎, בוחרים &quot;הוספה למסך הבית&quot;, ונכנסים מהאייקון החדש.
              </p>
            )}

            {installEvent && (
              <button onClick={install} className={`${btn} mt-3 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700`}>
                <Download className="h-5 w-5" aria-hidden="true" />
                התקנה כאפליקציה
              </button>
            )}

            {message && <p className={`mt-3 text-sm font-bold ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>}
          </div>
        </div>,
        // Portal: the top bar's backdrop blur would otherwise trap this fixed sheet inside the bar.
        document.body
      )}
    </>
  );
}
