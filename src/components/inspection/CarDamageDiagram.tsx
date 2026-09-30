'use client';

import type { MouseEvent } from 'react';
import { CAR_VIEW_SHAPES, DIAGRAM_ORDER } from '@/lib/car-diagram-shapes';
import { VIEW_LABELS, type DamageView } from '@/lib/inspection-damage';

export interface DiagramMark {
  n: number;
  view: DamageView;
  x: number;
  y: number;
}

interface CarDamageDiagramProps {
  marks: DiagramMark[];
  isHe: boolean;
  /** When set, tapping a view reports the tapped point (as 0..1 fractions). */
  onTap?: (view: DamageView, x: number, y: number) => void;
  /** A point being added right now (shown as a hollow ring). */
  pending?: { view: DamageView; x: number; y: number } | null;
  disabled?: boolean;
}

/**
 * The five car outlines from the paper inspection form, with numbered red
 * dots for marked damage. Editable (driver form) when onTap is given,
 * read-only (customer sign page) otherwise.
 */
export default function CarDamageDiagram({ marks, isHe, onTap, pending, disabled }: CarDamageDiagramProps) {
  const handleClick = (view: DamageView) => (e: MouseEvent<SVGSVGElement>) => {
    if (!onTap || disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onTap(view, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {DIAGRAM_ORDER.map((view) => {
        const s = CAR_VIEW_SHAPES[view];
        const wide = s.width >= 400;
        return (
          <figure key={view} className={`${wide ? 'col-span-2' : ''} rounded-xl border border-gray-200 bg-white p-2`}>
            <figcaption className="mb-1 text-center text-xs font-bold text-gray-500">
              {isHe ? VIEW_LABELS[view].he : VIEW_LABELS[view].en}
            </figcaption>
            <svg
              viewBox={`0 0 ${s.width} ${s.height}`}
              className={`w-full h-auto select-none ${onTap && !disabled ? 'cursor-crosshair touch-manipulation' : ''}`}
              onClick={handleClick(view)}
              role={onTap ? 'button' : 'img'}
              aria-label={isHe ? `סימון נזק — ${VIEW_LABELS[view].he}` : `Mark damage — ${VIEW_LABELS[view].en}`}
            >
              <rect x="0" y="0" width={s.width} height={s.height} fill="transparent" />
              <g transform={s.mirror ? `translate(${s.width} 0) scale(-1 1)` : undefined}>
                {s.paths.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke="#334155" strokeWidth={2} strokeLinejoin="round" />
                ))}
                {s.circles.map(([cx, cy, r], i) => (
                  <circle key={`c${i}`} cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={2} />
                ))}
              </g>
              {s.frontArrow && (
                <text
                  x={s.frontArrow.x}
                  y={s.frontArrow.y}
                  fontSize="12"
                  fill="#94a3b8"
                  textAnchor={s.frontArrow.dir === 'left' ? 'start' : 'end'}
                  fontFamily="Arial"
                >
                  {s.frontArrow.dir === 'left' ? (isHe ? '◄ חזית' : '◄ front') : (isHe ? 'חזית ►' : 'front ►')}
                </text>
              )}
              {marks
                .filter((m) => m.view === view)
                .map((m) => (
                  <g key={m.n}>
                    <circle cx={m.x * s.width} cy={m.y * s.height} r={12} fill="#dc2626" stroke="#fff" strokeWidth={2} />
                    <text
                      x={m.x * s.width}
                      y={m.y * s.height}
                      dy="4.5"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="#fff"
                      fontFamily="Arial"
                    >
                      {m.n}
                    </text>
                  </g>
                ))}
              {pending && pending.view === view && (
                <circle
                  cx={pending.x * s.width}
                  cy={pending.y * s.height}
                  r={12}
                  fill="none"
                  stroke="#E8743B"
                  strokeWidth={3}
                  strokeDasharray="4 3"
                />
              )}
            </svg>
          </figure>
        );
      })}
    </div>
  );
}
