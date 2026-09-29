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

/** Tap-scale fuel gauge: 0/2/4/6/8 eighths → E / ¼ / ½ / ¾ / F. */
export function fuelEighthsToLabel(eighths: number): string {
  const labels: Record<number, string> = { 0: 'E', 2: '¼', 4: '½', 6: '¾', 8: 'F' };
  return labels[eighths] ?? `${eighths}/8`;
}

export const FUEL_TAP_OPTIONS = [
  { eighths: 0, he: 'ריק', en: 'Empty', symbol: 'E' },
  { eighths: 2, he: 'רבע', en: 'Quarter', symbol: '¼' },
  { eighths: 4, he: 'חצי', en: 'Half', symbol: '½' },
  { eighths: 6, he: 'שלושת רבעי', en: 'Three quarters', symbol: '¾' },
  { eighths: 8, he: 'מלא', en: 'Full', symbol: 'F' },
] as const;
