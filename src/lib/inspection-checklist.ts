/**
 * Optional condition checklist for pickup/return inspections — a trimmed
 * version of the paper form's list (GPS, external antenna, service sticker,
 * rear shelf and lighter/splitter were dropped as not useful). Nothing here
 * is required: each item is unset, "ok" or "bad". On return, an item that
 * was "ok" at pickup and is "bad" now is flagged to the office.
 */

export const CHECKLIST_ITEMS = [
  { id: 'clean_exterior', he: 'ניקיון חיצוני', en: 'Exterior clean' },
  { id: 'clean_interior', he: 'ניקיון פנימי', en: 'Interior clean' },
  { id: 'lights', he: 'פנסים ואורות תקינים', en: 'Lights working' },
  { id: 'mirrors', he: 'מראות שלמות', en: 'Mirrors intact' },
  { id: 'tires', he: 'צמיגים וצלחות (טסות) תקינים', en: 'Tires and hubcaps OK' },
  { id: 'spare_wheel', he: 'גלגל רזרבי תקין', en: 'Spare wheel OK' },
  { id: 'safety_kit', he: "ג'ק, מפתח גלגלים, משולש ואפוד זוהר", en: 'Jack, wrench, triangle, vest' },
  { id: 'documents', he: 'רישיון רכב וביטוח ברכב', en: 'Registration and insurance in car' },
  { id: 'seats_belts', he: 'מושבים וחגורות בטיחות תקינים', en: 'Seats and seat belts OK' },
  { id: 'interior_trim', he: 'ריפוד, פלסטיקה ודאשבורד שלמים', en: 'Upholstery, trim, dashboard intact' },
  { id: 'audio', he: 'מערכת שמע תקינה', en: 'Audio system working' },
  { id: 'extinguisher', he: 'מטף כיבוי', en: 'Fire extinguisher' },
  { id: 'child_seat', he: 'כסא תינוק (אם הוזמן)', en: 'Child seat (if booked)' },
] as const;

export type ChecklistItemId = (typeof CHECKLIST_ITEMS)[number]['id'];
export type ChecklistValue = 'ok' | 'bad';
export type Checklist = Partial<Record<ChecklistItemId, ChecklistValue>>;

export function checklistLabel(id: string, isHe = true): string {
  const item = CHECKLIST_ITEMS.find((i) => i.id === id);
  return item ? (isHe ? item.he : item.en) : id;
}

/** Keeps only known items with a valid value; anything else is dropped (the checklist is optional). */
export function parseChecklist(raw: unknown): Checklist {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Checklist = {};
  for (const item of CHECKLIST_ITEMS) {
    const v = (raw as Record<string, unknown>)[item.id];
    if (v === 'ok' || v === 'bad') out[item.id] = v;
  }
  return out;
}

/** Items marked in the order of the list, for display. */
export function checklistEntries(checklist: Checklist | null | undefined): Array<{ id: ChecklistItemId; value: ChecklistValue }> {
  if (!checklist) return [];
  return CHECKLIST_ITEMS.filter((i) => checklist[i.id]).map((i) => ({ id: i.id, value: checklist[i.id] as ChecklistValue }));
}

/** Items that were OK at pickup but are marked not OK at return. */
export function checklistRegressions(pickup: Checklist | null | undefined, ret: Checklist | null | undefined): ChecklistItemId[] {
  if (!pickup || !ret) return [];
  return CHECKLIST_ITEMS.filter((i) => pickup[i.id] === 'ok' && ret[i.id] === 'bad').map((i) => i.id);
}
