import { DAMAGE_VIEWS, VIEW_LABELS, type DamageMark, type DamageView } from './inspection-damage';

/**
 * Line-art car outlines for the damage diagram (front, rear, both sides,
 * top) — generic sedan, drawn to mirror the paper inspection form. Used by
 * the React diagram (driver form + customer sign page) and as an SVG string
 * inside the signed PDF, so what the customer signs matches the PDF.
 *
 * Side and top views point the front of the car to the left; the right
 * side view is the left side mirrored (front to the right).
 */

export interface CarViewShape {
  width: number;
  height: number;
  paths: string[];
  circles: Array<[number, number, number]>;
  mirror?: boolean;
  /** Where the "front" arrow sits, if the view has a front/back direction. */
  frontArrow?: { x: number; y: number; dir: 'left' | 'right' };
}

const SIDE_PATHS = [
  // body
  'M18 112 L18 92 Q20 78 40 74 L120 66 L160 34 Q168 28 182 28 L268 28 Q282 28 292 36 L326 64 L368 70 Q384 74 384 90 L384 112 Q384 120 376 120 L344 120 A30 30 0 0 0 284 120 L132 120 A30 30 0 0 0 72 120 L26 120 Q18 120 18 112 Z',
  // windows
  'M130 66 L164 38 Q170 34 180 34 L216 34 L216 66 Z',
  'M224 34 L266 34 Q278 34 286 42 L312 66 L224 66 Z',
  // door lines, handles
  'M220 34 L220 118 M128 70 L130 118 M306 66 L300 118',
  'M196 80 H210 M282 80 H296',
  // lights, mirror
  'M22 86 Q30 80 44 80 L44 90 L22 92 Z',
  'M380 80 L368 80 L368 92 L382 92 Z',
  'M150 58 L138 55 L138 64 Z',
];
const SIDE_WHEELS: Array<[number, number, number]> = [
  [102, 120, 24],
  [102, 120, 11],
  [314, 120, 24],
  [314, 120, 11],
];

const FRONT_BODY =
  'M28 150 L28 104 Q28 92 40 88 L56 48 Q62 36 78 36 L162 36 Q178 36 184 48 L200 88 Q212 92 212 104 L212 150 Q212 156 206 156 L34 156 Q28 156 28 150 Z';
const END_WHEELS = 'M36 156 H64 V176 H36 Z M176 156 H204 V176 H176 Z';
const END_MIRRORS = 'M40 84 L22 80 L22 92 L40 92 Z M200 84 L218 80 L218 92 L200 92 Z';

export const CAR_VIEW_SHAPES: Record<DamageView, CarViewShape> = {
  left: { width: 400, height: 150, paths: SIDE_PATHS, circles: SIDE_WHEELS, frontArrow: { x: 20, y: 18, dir: 'left' } },
  right: {
    width: 400,
    height: 150,
    paths: SIDE_PATHS,
    circles: SIDE_WHEELS,
    mirror: true,
    frontArrow: { x: 380, y: 18, dir: 'right' },
  },
  front: {
    width: 240,
    height: 184,
    paths: [
      FRONT_BODY,
      'M66 50 Q70 44 80 44 L160 44 Q170 44 174 50 L186 84 L54 84 Z',
      'M40 100 L76 100 L72 114 L40 114 Z M200 100 L164 100 L168 114 L200 114 Z',
      'M88 104 L152 104 L148 124 L92 124 Z',
      'M34 134 L206 134',
      'M100 138 H140 V148 H100 Z',
      END_WHEELS,
      END_MIRRORS,
    ],
    circles: [],
  },
  rear: {
    width: 240,
    height: 184,
    paths: [
      FRONT_BODY,
      'M72 50 Q76 44 86 44 L154 44 Q164 44 168 50 L178 80 L62 80 Z',
      'M50 90 L190 90',
      'M34 98 L74 98 L74 112 L34 112 Z M206 98 L166 98 L166 112 L206 112 Z',
      'M98 104 H142 V116 H98 Z',
      'M34 134 L206 134',
      END_WHEELS,
      END_MIRRORS,
    ],
    circles: [],
  },
  top: {
    width: 400,
    height: 180,
    paths: [
      'M60 26 L330 26 Q380 28 384 70 L384 110 Q380 152 330 154 L60 154 Q18 150 16 110 L16 70 Q18 30 60 26 Z',
      'M110 34 Q104 90 110 146',
      'M118 40 L160 50 L160 130 L118 140 Q112 90 118 40 Z',
      'M166 50 L280 50 L280 130 L166 130 Z',
      'M286 50 L318 44 Q324 90 318 136 L286 130 Z',
      'M140 26 L146 14 L158 14 L158 26 Z M140 154 L146 166 L158 166 L158 154 Z',
      'M80 20 H124 V26 H80 Z M80 154 H124 V160 H80 Z M290 20 H334 V26 H290 Z M290 154 H334 V160 H290 Z',
    ],
    circles: [],
    frontArrow: { x: 6, y: 92, dir: 'left' },
  },
};

export const DIAGRAM_ORDER: DamageView[] = ['left', 'right', 'front', 'rear', 'top'];

const STROKE = '#334155';

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Static SVG for one view with its numbered marks (used in the signed PDF). */
export function renderCarViewSvg(view: DamageView, marks: DamageMark[], widthPx = 300, ghostMarks: DamageMark[] = []): string {
  const s = CAR_VIEW_SHAPES[view];
  const shapeTransform = s.mirror ? ` transform="translate(${s.width} 0) scale(-1 1)"` : '';
  const shape =
    s.paths.map((d) => `<path d="${d}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>`).join('') +
    s.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${STROKE}" stroke-width="2"/>`).join('');
  const ghosts = ghostMarks
    .filter((m) => m.view === view)
    .map((m) => {
      const cx = (m.x * s.width).toFixed(1);
      const cy = (m.y * s.height).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="10" fill="#cbd5e1" stroke="#fff" stroke-width="2"/><text x="${cx}" y="${cy}" dy="4" text-anchor="middle" font-size="11" font-weight="700" fill="#475569" font-family="Arial">${m.n}</text>`;
    })
    .join('');
  const dots = marks
    .filter((m) => m.view === view)
    .map((m) => {
      const cx = (m.x * s.width).toFixed(1);
      const cy = (m.y * s.height).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="11" fill="#dc2626" stroke="#fff" stroke-width="2"/><text x="${cx}" y="${cy}" dy="4.5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Arial">${m.n}</text>`;
    })
    .join('');
  const heightPx = Math.round((widthPx * s.height) / s.width);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.width} ${s.height}" width="${widthPx}" height="${heightPx}"><g${shapeTransform}>${shape}</g>${ghosts}${dots}</svg>`;
}

/** All five views in a grid, captioned (for the signed PDF). */
export function renderCarDiagramHtml(marks: DamageMark[], ghostMarks: DamageMark[] = []): string {
  const cells = DIAGRAM_ORDER.map(
    (view) =>
      `<div style="display:inline-block;vertical-align:top;margin:4px 6px;text-align:center;"><div style="font-size:11px;color:#666;margin-bottom:2px;">${escapeXml(VIEW_LABELS[view].he)}</div>${renderCarViewSvg(view, marks, CAR_VIEW_SHAPES[view].width > 300 ? 300 : 170, ghostMarks)}</div>`
  ).join('');
  return `<div style="text-align:center;">${cells}</div>`;
}

export { DAMAGE_VIEWS };
