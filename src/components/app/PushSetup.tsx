'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';

type State = 'loading' | 'unsupported' | 'needs-install' | 'off' | 'denied' | 'on' | 'not-configured';

const DISMISS_KEY = 'smartcar-push-card-dismissed';

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
 * "Turn on notifications" card for the driver and manager apps. Shows the
 * right thing per phone: on an iPhone that hasn't installed the app yet it
 * explains that notifications need the home-screen app; otherwise one tap
 * turns them on and sends a test notification. Hidden once on (or dismissed).
 */
export default function PushSetup({ audience }: { audience: 'driver' | 'manager' }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const set = (s: State) => { if (!cancelled) setState(s); };
    (async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
      } catch {
        /* storage unavailable */
      }
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        set(ios && !standalone ? 'needs-install' : 'unsupported');
        return;
      }
      const key = await fetch('/api/driver/push').then((r) => r.json()).catch(() => null);
      if (!key?.publicKey) { set('not-configured'); return; }
      if (Notification.permission === 'denied') { set('denied'); return; }
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        // Re-save quietly (keeps the server in sync if it was cleaned up).
        void fetch('/api/driver/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        set('on');
      } else {
        set('off');
      }
    })().catch(() => set('unsupported'));
    return () => { cancelled = true; };
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage('');
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
      setMessage('ההתראות הופעלו. שלחנו התראת ניסיון לטלפון.');
    } catch {
      setMessage('לא הצלחנו להפעיל התראות. בדקו שיש אינטרנט ונסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (state === 'loading' || state === 'unsupported' || state === 'not-configured') return null;
  if (state === 'on') {
    return message ? (
      <p className="flex items-center gap-2 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-800" dir="rtl">
        <BellRing className="h-5 w-5 shrink-0" aria-hidden="true" />
        {message}
      </p>
    ) : null;
  }
  if (dismissed && state !== 'off') return null;

  const what = audience === 'manager' ? 'על כל טופס שנחתם ועל החזרות עם נזקים חדשים' : 'על כל משימה חדשה, שינוי מועד או ביטול';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#B8D8D8] bg-white p-4 shadow-sm" dir="rtl">
      <Bell className="mt-0.5 h-6 w-6 shrink-0 text-[#E8743B]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {state === 'needs-install' && (
          <>
            <p className="font-black text-[#0D2B2B]">רוצים לקבל התראות לטלפון?</p>
            <p className="mt-1 text-sm text-gray-600">
              באייפון ההתראות עובדות רק מהאפליקציה שעל מסך הבית: בספארי לוחצים על כפתור השיתוף ⬆︎ ואז &quot;הוספה למסך הבית&quot;, ונכנסים מהאייקון החדש.
            </p>
          </>
        )}
        {state === 'off' && (
          <>
            <p className="font-black text-[#0D2B2B]">הפעלת התראות</p>
            <p className="mt-1 text-sm text-gray-600">קבלו הודעה לטלפון {what}.</p>
            <button onClick={enable} disabled={busy} className="mt-3 min-h-12 w-full rounded-xl bg-[#E8743B] px-4 text-base font-black text-white disabled:opacity-50 sm:w-auto">
              {busy ? 'מפעיל…' : 'הפעלת התראות'}
            </button>
          </>
        )}
        {state === 'denied' && (
          <>
            <p className="font-black text-[#0D2B2B]">ההתראות חסומות בטלפון</p>
            <p className="mt-1 text-sm text-gray-600">כדי לקבל הודעות {what}, אפשרו התראות ל־SmartCar בהגדרות הטלפון ורעננו את הדף.</p>
          </>
        )}
        {message && <p className="mt-2 text-sm font-bold text-red-600">{message}</p>}
      </div>
      {state !== 'off' && (
        <button onClick={dismiss} aria-label="סגירה" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
