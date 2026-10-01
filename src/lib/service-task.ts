/** Garage / tyre-shop jobs ("מוסך / פנצ'רייה"): the kinds of place and the reasons, in Hebrew. */

export const SERVICE_KINDS = {
  garage: 'מוסך',
  tire: "פנצ'רייה",
  wash: 'שטיפה',
  test: 'מכון רישוי',
  other: 'אחר',
} as const;

export const SERVICE_REASONS = {
  maintenance: 'טיפול תקופתי',
  fault: 'תקלה',
  tires: "צמיגים / פנצ'ר",
  bodywork: 'תאונה / פחחות',
  test: 'טסט שנתי',
  wash: 'שטיפה וניקיון',
  other: 'אחר',
} as const;

export type ServiceKind = keyof typeof SERVICE_KINDS;
export type ServiceReason = keyof typeof SERVICE_REASONS;

/** Sensible default reason for a place kind (still editable). */
export const DEFAULT_REASON: Record<ServiceKind, ServiceReason> = {
  garage: 'maintenance',
  tire: 'tires',
  wash: 'wash',
  test: 'test',
  other: 'other',
};

export const isServiceKind = (v: unknown): v is ServiceKind => typeof v === 'string' && v in SERVICE_KINDS;
export const isServiceReason = (v: unknown): v is ServiceReason => typeof v === 'string' && v in SERVICE_REASONS;

export function serviceKindLabel(kind: string | null | undefined): string {
  return isServiceKind(kind) ? SERVICE_KINDS[kind] : 'מוסך';
}

export function serviceReasonLabel(reason: string | null | undefined): string {
  return isServiceReason(reason) ? SERVICE_REASONS[reason] : '';
}

/** "מוסך יוסי" when a name was given, otherwise the kind ("פנצ'רייה"). */
export function serviceTitle(kind: string | null | undefined, place: string | null | undefined): string {
  return place?.trim() || serviceKindLabel(kind);
}
