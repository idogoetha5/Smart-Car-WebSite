'use client';

import { useEffect } from 'react';

/**
 * Keeps the installed, private office app current without caching office data.
 * When a new deployment activates, or iOS restores a paused standalone window,
 * the current screen reloads from the network instead of requiring a reinstall.
 */
export default function AdminAppSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloadingForWorker = false;
    let hiddenAt: number | null = null;

    const reload = () => {
      if (reloadingForWorker) return;
      reloadingForWorker = true;
      window.location.reload();
    };

    const onControllerChange = () => reload();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reload();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      // iOS can resume an installed web app from an old page snapshot. A short
      // background interval is enough to fetch the current deployment, while
      // normal in-app navigation remains uninterrupted.
      if (hiddenAt && Date.now() - hiddenAt >= 60_000) reload();
      hiddenAt = null;
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    void navigator.serviceWorker
      .register('/admin-sw.js', { scope: '/' })
      .then((registration) => registration.update())
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
