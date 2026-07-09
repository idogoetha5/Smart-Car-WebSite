'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

/**
 * A real pointer-tracking 3D tilt — rotation follows where the cursor is
 * over the element, the same effect used on the hero car. Not a fixed CSS
 * :hover transform, which only ever shows one angle.
 *
 * Single element (not a wrapper + inner motion.div): `perspective` is set
 * directly on this element's own transform via framer-motion, so it can be
 * dropped in as a straight replacement for a plain <div> — e.g. as a CSS
 * grid item — without an extra wrapper messing up grid stretch/sizing.
 */
export default function Tilt3D({
  children,
  className,
  style,
  hoverScale,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Scale factor on hover, e.g. 1.4 for a 40% grow. Omit for tilt-only. */
  hoverScale?: number;
  onClick?: () => void;
}) {
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(useTransform(tiltY, [-0.5, 0.5], [12, -12]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(tiltX, [-0.5, 0.5], [-12, 12]), { stiffness: 200, damping: 20 });

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handlePointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <motion.div
      className={className}
      style={{ ...style, perspective: 1200, rotateX, rotateY, transformStyle: 'preserve-3d' }}
      whileHover={hoverScale ? { scale: hoverScale, zIndex: 20 } : { zIndex: 20 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
