'use client';

import { useEffect } from 'react';

/** Registers a network-only worker so the secured office dashboard is installable. */
export default function AdminAppSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/admin-sw.js', { scope: '/' }).catch(() => undefined);
  }, []);

  return null;
}
