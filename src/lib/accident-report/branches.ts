import { OFFICE_PHONE } from '@/lib/constants';

// Same details as src/components/layout/BranchesSection.tsx — keep the two in sync.
export const REPORT_BRANCHES = [
  { key: 'herzliya', nameHe: 'הרצליה', nameEn: 'Herzliya', addressHe: 'רחוב רמת ים 122 (מלון דן אכדיה), הרצליה', phone: OFFICE_PHONE },
  { key: 'tel-aviv', nameHe: 'תל אביב', nameEn: 'Tel Aviv', addressHe: 'מאפו 2 פינת הירקון 112, תל אביב', phone: '03-5233073' },
  { key: 'jerusalem', nameHe: 'ירושלים', nameEn: 'Jerusalem', addressHe: 'המלך דוד 8, ירושלים', phone: '02-6221150' },
  { key: 'airport', nameHe: 'נתב"ג', nameEn: 'Ben Gurion Airport', addressHe: 'נמל התעופה בן גוריון', phone: OFFICE_PHONE },
] as const;

export type BranchKey = (typeof REPORT_BRANCHES)[number]['key'];

export function branchByKey(key?: string | null) {
  return REPORT_BRANCHES.find((b) => b.key === key);
}
