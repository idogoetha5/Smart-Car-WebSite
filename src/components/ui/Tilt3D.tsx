'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

/**
 * Lightweight pointer-tracking 3D tilt. Deliberately NOT framer-motion:
 * this component is rendered on every vehicle card (dozens per page), so it
 * uses a plain div, updates `transform` directly via rAF only while the
 * mouse is over it, and lets a short CSS transition smooth the motion. No
 * springs, no idle work, no per-card animation loops — cheap enough for
 * long grids on low-end / Windows GPUs.
 *
 * The effect only runs for a real mouse on a fine-pointer device that has
 * not asked for reduced motion. Everything else gets the undecorated card.
 */

/**
 * Hard ceiling on the hover grow. Call sites had drifted well past what the
 * layout can absorb (a 1.4 on the cars-for-sale grid grew a card by 40%,
 * far enough to sit on top of its neighbours), so the cap is enforced here
 * rather than trusted to each caller.
 */
export const MAX_HOVER_SCALE = 1.25;

/** Tilt angle in degrees at the corners of the element. */
const MAX_TILT_DEG = 8;

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
  /** Scale on hover. Clamped to MAX_HOVER_SCALE. Default 1 (tilt only). */
  hoverScale?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const [enabled, setEnabled] = useState(false);

  // Only enable for a fine pointer (real mouse) with motion allowed. Both
  // are live queries, so a user toggling "reduce motion" or docking a mouse
  // is picked up without a reload.
  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(finePointer.matches && !reduced.matches);
    update();
    finePointer.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      finePointer.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);

  const scale = Math.min(Math.max(hoverScale, 1), MAX_HOVER_SCALE);

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    el.style.transform = '';
    el.style.willChange = 'auto';
    el.style.zIndex = '';
  };

  // If the effect gets disabled mid-hover (reduced motion toggled on),
  // drop any transform we already applied instead of leaving it stuck.
  useEffect(() => {
    if (!enabled) reset();
  }, [enabled]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform =
        `perspective(1200px) rotateX(${(-py * MAX_TILT_DEG).toFixed(2)}deg) ` +
        `rotateY(${(px * MAX_TILT_DEG).toFixed(2)}deg) scale(${scale})`;
    });
  };

  const onEnter = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    el.style.willChange = 'transform';
    // Lifts the hovered card above its siblings only. Stays well below the
    // z-50 chrome (navbar, cookie banner, WhatsApp button) so a hovered
    // card can never cover site navigation.
    el.style.zIndex = '20';
  };

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={reset}
      style={{
        ...style,
        // Deliberately NOT setting `transform-style: preserve-3d` here.
        // It establishes a containing block for absolutely positioned
        // descendants, so any `next/image` with `fill` rendered inside a
        // Tilt3D that has no height of its own collapses to nothing —
        // which is exactly what blanked the vehicle gallery's main image.
        // The tilt does not need it; the rotation still renders correctly.
        transition: enabled ? 'transform 0.16s cubic-bezier(0.22,1,0.36,1)' : undefined,
      }}
    >
      {children}
    </div>
  );
}
