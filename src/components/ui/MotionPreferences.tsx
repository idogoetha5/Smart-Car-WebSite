'use client';

import { MotionConfig } from 'framer-motion';

// Visitors who turn on "reduce motion" on their phone or computer get no sliding, scaling or tilting
// from framer-motion (IS 5568 / WCAG 2.3.3). The CSS rule in globals.css only covers CSS animations;
// framer-motion animates from JavaScript, so it needs this setting too.
export default function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
