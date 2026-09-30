/**
 * Damage diagram for pickup/return inspections — the digital version of the
 * paper form's car outlines. The driver taps a spot on one of the car views,
 * picks what it is (scratch/dent/...), optionally writes a note and takes a
 * photo. Shared by the client form, the server routes, the sign page, the
 * signed PDF and the office email, so every surface agrees on the shape.
 *
 * Evidence rule (at least one is required):
 *   - a walk-around video, OR
 *   - at least one damage marked on the diagram, OR
 *   - "no damage" confirmed + a photo of each of the 4 sides.
 */

export const DAMAGE_VIEWS = ['front', 'rear', 'left', 'right', 'top'] as const;
export type DamageView = (typeof DAMAGE_VIEWS)[number];

export const SIDE_PHOTO_VIEWS = ['front', 'rear', 'left', 'right'] as const;
export type SidePhotoView = (typeof SIDE_PHOTO_VIEWS)[number];

export const VIEW_LABELS: Record<DamageView, { he: string; en: string }> = {
  front: { he: 'חזית', en: 'Front' },
  rear: { he: 'אחור', en: 'Rear' },
  left: { he: 'צד שמאל', en: 'Left side' },
  right: { he: 'צד ימין', en: 'Right side' },
  top: { he: 'מבט מלמעלה', en: 'Top' },
};

export const DAMAGE_KINDS = [
  { id: 'scratch', he: 'שריטה', en: 'Scratch' },
  { id: 'dent', he: 'מכה', en: 'Dent' },
  { id: 'crack', he: 'סדק / שבר', en: 'Crack / break' },
  { id: 'paint', he: 'צבע', en: 'Paint' },
  { id: 'missing', he: 'חסר', en: 'Missing part' },
  { id: 'other', he: 'אחר', en: 'Other' },
] as const;
export type DamageKind = (typeof DAMAGE_KINDS)[number]['id'];

export function damageKindLabel(kind: string, isHe = true): string {
  const found = DAMAGE_KINDS.find((k) => k.id === kind);
  return found ? (isHe ? found.he : found.en) : kind;
}

export interface DamageMark {
  /** 1-based number shown on the diagram and in the list. */
  n: number;
  view: DamageView;
  /** Position as a fraction (0..1) of the view's width/height. */
  x: number;
  y: number;
  kind: DamageKind;
  note: string;
  /** Storage path of the close-up photo (server-side only; null if none). */
  photo_path?: string | null;
}

/** What the browser sends when creating an inspection. */
export interface DamageMarkInput {
  n: number;
  view: DamageView;
  x: number;
  y: number;
  kind: DamageKind;
  note: string;
  hasPhoto: boolean;
}

export const MAX_MARKS = 40;
const MAX_NOTE = 300;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Validates and normalises marks from an untrusted request body. Returns null if invalid. */
export function parseDamageMarks(raw: unknown): DamageMarkInput[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_MARKS) return null;
  const kinds = new Set<string>(DAMAGE_KINDS.map((k) => k.id));
  const views = new Set<string>(DAMAGE_VIEWS);
  const out: DamageMarkInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i] as Record<string, unknown>;
    if (!m || typeof m !== 'object') return null;
    const x = Number(m.x);
    const y = Number(m.y);
    if (!views.has(String(m.view)) || !kinds.has(String(m.kind))) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push({
      n: i + 1,
      view: m.view as DamageView,
      x: Math.round(clamp01(x) * 1000) / 1000,
      y: Math.round(clamp01(y) * 1000) / 1000,
      kind: m.kind as DamageKind,
      note: String(m.note ?? '').trim().slice(0, MAX_NOTE),
      hasPhoto: m.hasPhoto === true,
    });
  }
  return out;
}

export function parseSidePhotoViews(raw: unknown): SidePhotoView[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const allowed = new Set<string>(SIDE_PHOTO_VIEWS);
  const views = Array.from(new Set(raw.map(String)));
  if (views.some((v) => !allowed.has(v))) return null;
  return views as SidePhotoView[];
}

/** Returns a Hebrew error message if the evidence rule isn't met, else null. */
export function evidenceError(params: {
  hasVideo: boolean;
  markCount: number;
  noDamage: boolean;
  sidePhotoViews: readonly string[];
}): string | null {
  const { hasVideo, markCount, noDamage, sidePhotoViews } = params;
  if (noDamage && markCount > 0) return 'סומנו נזקים וגם "אין נזקים" — יש לבחור אחד';
  if (hasVideo || markCount > 0) return null;
  if (noDamage) {
    const missing = SIDE_PHOTO_VIEWS.filter((v) => !sidePhotoViews.includes(v));
    if (missing.length === 0) return null;
    return `חסרות תמונות: ${missing.map((v) => VIEW_LABELS[v].he).join(', ')}`;
  }
  return 'יש לצלם סרטון או לסמן נזקים בשרטוט (או לאשר "אין נזקים" ולצלם 4 צדדים)';
}

export function markPhotoPath(inspectionId: string, n: number): string {
  return `${inspectionId}/marks/${n}.jpg`;
}

export function sidePhotoPath(inspectionId: string, view: SidePhotoView): string {
  return `${inspectionId}/sides/${view}.jpg`;
}

/** Photo keys used by the token-gated photo route: "mark-3" or "side-front". */
export function photoKeyToPath(
  inspection: { id: string; damage_marks: DamageMark[] | null; side_photos: Record<string, string> | null },
  key: string
): string | null {
  const markMatch = key.match(/^mark-(\d{1,2})$/);
  if (markMatch) {
    const n = Number(markMatch[1]);
    const mark = (inspection.damage_marks ?? []).find((m) => m.n === n);
    return mark?.photo_path ?? null;
  }
  const sideMatch = key.match(/^side-(front|rear|left|right)$/);
  if (sideMatch) return inspection.side_photos?.[sideMatch[1]] ?? null;
  return null;
}
