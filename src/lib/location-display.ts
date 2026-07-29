import { BRANCHES } from '@/lib/branches';

/**
 * Converts internal branch ids and lower-case Latin locations into customer-
 * facing text. Hebrew and fully formatted street addresses are left intact.
 */
export function formatLocationForCustomer(value: string | null | undefined): string {
  const location = String(value ?? '').trim();
  if (!location) return '—';

  const branch = BRANCHES.find((item) => item.id === location.toLowerCase());
  if (branch) return branch.nameEn;

  return location.replace(/[A-Za-z]+(?:['’][A-Za-z]+)?/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
