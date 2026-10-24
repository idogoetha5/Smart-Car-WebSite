export type RentalSearchInput = Record<string, string | string[] | undefined>;
export type RentalSearchCriteria = {
  pickupDate: string;
  returnDate: string;
  location: string;
  pickupLocation: string;
  returnLocation: string;
  category: string;
};

const CATEGORIES = new Set(['MINI', 'ECONOMY', 'COMPACT', 'ECONOMY_COMPACT', 'SEDAN', 'CROSSOVER', 'SUV', 'LUXURY', 'VAN', 'COMMERCIAL', 'ELECTRIC']);
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

export function rentalSearchCriteria(input: RentalSearchInput = {}): RentalSearchCriteria {
  const location = first(input.location);
  const pickupLocation = first(input.pickupLocation) || location;
  const category = first(input.category);
  return {
    pickupDate: first(input.pickup),
    returnDate: first(input.return),
    location,
    pickupLocation,
    returnLocation: first(input.returnLocation) || pickupLocation,
    category: CATEGORIES.has(category) ? category : '',
  };
}
