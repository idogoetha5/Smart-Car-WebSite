'use client';

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

/**
 * Lightweight pointer-tracking 3D tilt. Deliberately NOT framer-motion:
 * this component is rendered on every vehicle card (dozens per page), so it
 * uses a plain div, updates `transform` directly via rAF only while the
 * mouse is over it, and lets a short CSS transition smooth the motion. No
 * springs, no idle work, no per-card animation loops — cheap enough for
 * long grids on low-end / Windows GPUs. Effect only runs for a real mouse.
 */
export default function Tilt3D({
  children,
  className,
  style,
  hoverScale = 1,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Scale on hover, e.g. 1.4 for a 40% grow. Default 1 (tilt only). */
  hoverScale?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1200px) rotateX(${(-py * 12).toFixed(2)}deg) rotateY(${(px * 12).toFixed(2)}deg) scale(${hoverScale})`;
    });
  };

  const onEnter = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    el.style.willChange = 'transform';
    el.style.zIndex = '20';
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)';
    el.style.willChange = 'auto';
    el.style.zIndex = '';
  };

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={{ ...style, transition: 'transform 0.16s cubic-bezier(0.22,1,0.36,1)' }}
    >
      {children}
    </div>
  );
}
