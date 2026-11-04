import { BRANCHES } from '@/lib/branches';

// Built from the site's single branch list (src/lib/branches.ts), so the
// report always shows the same addresses and phone numbers as the website.
export const REPORT_BRANCHES = BRANCHES.map((b) => ({
  key: b.id as string,
  nameHe: b.nameHe.replace(/^סניף\s+/, ''),
  nameEn: b.nameEn,
  addressHe: `${b.streetHe}, ${b.cityHe}`,
  phone: b.phone,
}));

export function branchByKey(key?: string | null) {
  return REPORT_BRANCHES.find((b) => b.key === key);
}
