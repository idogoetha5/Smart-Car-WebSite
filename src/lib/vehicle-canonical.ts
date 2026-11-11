import type { Vehicle } from '@/types';

// Never combine different years, photos, equipment, availability, capacity or
// commercial terms. Paint is not displayed/promised on the public model page;
// its photos explicitly illustrate a vehicle group.
const equivalentFields = [
  'make', 'model', 'year', 'category', 'seats', 'doors', 'transmission',
  'fuelType', 'pricePerDay', 'displayPricePerDay', 'minimumDailyPrice',
  'pricePerMonth', 'depositAmount', 'mileageLimit', 'imageUrls', 'features',
  'descriptionHe', 'descriptionEn', 'isAvailable', 'totalUnits',
] as const satisfies readonly (keyof Vehicle)[];

// Office data entry sometimes leaves line breaks or double spaces inside a
// value ("Backup \n  Camera"). That is not a real difference between two
// listings, so compare text with whitespace collapsed.
function normalise(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(normalise);
  return value;
}

function fingerprint(vehicle: Vehicle): string {
  return JSON.stringify(equivalentFields.map(field => normalise(vehicle[field] ?? null)));
}

/** Stable across database tie ordering; newer duplicates retain the older URL. */
export function preferredVehicleId(vehicle: Vehicle, fleet: readonly Vehicle[]): string {
  if (!vehicle.isAvailable || !vehicle.make || !vehicle.model) return vehicle.id;
  const key = fingerprint(vehicle);
  const candidates = fleet.filter(candidate => candidate.isAvailable && fingerprint(candidate) === key);
  // Self canonical if the fleet read is incomplete, stale or failed.
  if (!candidates.some(candidate => candidate.id === vehicle.id)) return vehicle.id;
  return candidates.reduce((preferred, candidate) => {
    const date = candidate.createdAt || '';
    const previousDate = preferred.createdAt || '';
    return date < previousDate || (date === previousDate && candidate.id > preferred.id) ? candidate : preferred;
  }, vehicle).id;
}

export function canonicalVehicles(fleet: readonly Vehicle[]): Vehicle[] {
  return fleet.filter(vehicle => preferredVehicleId(vehicle, fleet) === vehicle.id);
}
