'use client';

import { useSyncExternalStore } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { isAutomatedUserAgent } from '@/lib/automated-user-agent';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Loads Web Vitals measurement only for real browsers, never for crawlers. */
export default function HumanSpeedInsights() {
  // Keep server output deterministic, then decide from the real browser UA
  // after hydration. SpeedInsights itself renders no DOM, so this adds no
  // visible layout shift.
  const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const shouldLoad = isClient && !isAutomatedUserAgent(navigator.userAgent);

  return shouldLoad ? <SpeedInsights /> : null;
}
