'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

/**
 * Wraps its children in a real pointer-tracking 3D tilt — rotation follows
 * where the cursor is over the element, the same effect used on the hero
 * car. Not a fixed CSS :hover transform, which only ever shows one angle.
 */
export default function Tilt3D({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
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
    <div
      className={className}
      style={{ ...style, perspective: 1000, position: 'relative', width: '100%', height: '100%' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}>
        {children}
      </motion.div>
    </div>
  );
}
