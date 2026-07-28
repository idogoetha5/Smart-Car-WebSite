/**
 * Single source of truth for branch details.
 *
 * These values were confirmed by the owner on 2026-07-28 and supersede
 * every earlier copy. Before this file existed the same four branches
 * were duplicated in three places (the home page, the branches page and
 * BranchesSection) and had drifted apart — Tel Aviv was published as
 * "Mapu 2" in two of them, and the map links were hard-coded lat/lng
 * pairs that pointed at city centres rather than at the branches.
 *
 * Map links are derived from the address instead of stored coordinates,
 * so a link can never silently disagree with the address printed next to
 * it, and correcting an address corrects its links too.
 */

export type BranchId = 'herzliya' | 'telaviv' | 'jerusalem' | 'airport';

export interface Branch {
  id: BranchId;
  nameHe: string;
  nameEn: string;
  /** Street address, no city. */
  streetHe: string;
  streetEn: string;
  cityHe: string;
  cityEn: string;
  phone: string;
  image: string;
}

export const BRANCHES: Branch[] = [
  {
    id: 'herzliya',
    nameHe: 'סניף הרצליה',
    nameEn: 'Herzliya',
    streetHe: 'רמת ים 122',
    streetEn: 'Ramat Yam 122',
    cityHe: 'הרצליה',
    cityEn: 'Herzliya',
    phone: '09-9509757',
    image: '/images/branch-herzliya.webp',
  },
  {
    id: 'telaviv',
    nameHe: 'סניף תל אביב',
    nameEn: 'Tel Aviv',
    streetHe: 'הירקון 112',
    streetEn: 'HaYarkon 112',
    cityHe: 'תל אביב',
    cityEn: 'Tel Aviv',
    phone: '03-5233073',
    image: '/images/branch-telaviv.webp',
  },
  {
    id: 'jerusalem',
    nameHe: 'סניף ירושלים',
    nameEn: 'Jerusalem',
    streetHe: 'מלך דוד 8',
    streetEn: 'King David 8',
    cityHe: 'ירושלים',
    cityEn: 'Jerusalem',
    phone: '02-6221150',
    image: '/images/branch-jerusalem.webp',
  },
  {
    id: 'airport',
    nameHe: 'נתב"ג',
    nameEn: 'Ben Gurion Airport',
    streetHe: 'נמל התעופה בן גוריון',
    streetEn: 'Ben Gurion Airport',
    cityHe: 'לוד',
    cityEn: 'Lod',
    phone: '09-9509757',
    image: '/images/branch-airport.webp',
  },
];

/** Full "street, city" address in the requested locale. */
export function branchAddress(branch: Branch, locale: string): string {
  return locale === 'he'
    ? `${branch.streetHe}, ${branch.cityHe}`
    : `${branch.streetEn}, ${branch.cityEn}`;
}

export function branchName(branch: Branch, locale: string): string {
  return locale === 'he' ? branch.nameHe : branch.nameEn;
}

/**
 * Navigation links. Always built from the Hebrew address — that is what
 * both providers resolve most reliably for Israeli destinations, whatever
 * language the visitor is browsing in.
 */
export function wazeUrl(branch: Branch): string {
  const q = encodeURIComponent(`${branch.streetHe}, ${branch.cityHe}`);
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}

export function mapsUrl(branch: Branch): string {
  const q = encodeURIComponent(`${branch.streetHe}, ${branch.cityHe}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function getBranch(id: BranchId): Branch {
  const branch = BRANCHES.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown branch id: ${id}`);
  return branch;
}
