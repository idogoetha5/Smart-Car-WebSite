'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'smartcar-install-hint-dismissed';

/**
 * "Add to home screen" card: a one-tap install button where the browser
 * supports it (Android Chrome, desktop Chrome/Edge), otherwise the iPhone
 * steps. Hidden once installed (standalone) or dismissed.
 */
export default function InstallHint({ appName }: { appName: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* storage unavailable — show the hint */
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    // iPhone has no install prompt — show the manual steps instead.
    const t = ios ? setTimeout(() => { setIsIos(true); setVisible(true); }, 0) : undefined;
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#B8D8D8] bg-white p-4 shadow-sm" dir="rtl">
      <Download className="mt-0.5 h-6 w-6 shrink-0 text-[#2D5F5F]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#0D2B2B]">התקנת {appName} כאפליקציה</p>
        {isIos ? (
          <p className="mt-1 text-sm text-gray-600">בספארי: לחצו על כפתור השיתוף ⬆︎ ואז &quot;הוספה למסך הבית&quot;.</p>
        ) : (
          <button onClick={install} className="mt-2 min-h-11 rounded-xl bg-[#2D5F5F] px-4 text-sm font-black text-white">
            התקנה
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="סגירה" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
