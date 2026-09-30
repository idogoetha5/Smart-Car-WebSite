/** Shared object-path/label helpers for the vehicle-inspection feature. */

export const INSPECTION_BUCKET = 'vehicle-inspections';

export function inspectionVideoPath(inspectionId: string, ext: string): string {
  return `${inspectionId}/video.${ext}`;
}

export function inspectionSignaturePath(inspectionId: string): string {
  return `${inspectionId}/signature.png`;
}

export function inspectionPdfPath(inspectionId: string): string {
  return `${inspectionId}/signed.pdf`;
}

/** Fuel gauge in eighths, like the paper form: 0..8 → E, 1/8 … 7/8, F. */
export function fuelEighthsToLabel(eighths: number): string {
  if (eighths === 0) return 'E';
  if (eighths === 8) return 'F';
  return `${eighths}/8`;
}

export const FUEL_TAP_OPTIONS = [
  { eighths: 0, he: 'ריק', en: 'Empty', symbol: 'E' },
  { eighths: 1, he: 'שמינית', en: 'One eighth', symbol: '1/8' },
  { eighths: 2, he: 'שתי שמיניות', en: 'Two eighths', symbol: '2/8' },
  { eighths: 3, he: 'שלוש שמיניות', en: 'Three eighths', symbol: '3/8' },
  { eighths: 4, he: 'חצי', en: 'Half', symbol: '4/8' },
  { eighths: 5, he: 'חמש שמיניות', en: 'Five eighths', symbol: '5/8' },
  { eighths: 6, he: 'שש שמיניות', en: 'Six eighths', symbol: '6/8' },
  { eighths: 7, he: 'שבע שמיניות', en: 'Seven eighths', symbol: '7/8' },
  { eighths: 8, he: 'מלא', en: 'Full', symbol: 'F' },
] as const;
