/**
 * City + country lookup for the branch customer form.
 *
 * The customer picks both in one field: a Nominatim settlement search returns
 * "City, Country" suggestions, and choosing one fills the two separate
 * database columns (city, country) together.
 */

export type Place = {
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2, upper-case (e.g. "GB"); '' when unknown. */
  countryCode: string;
  /** State / region, shown only to tell same-named towns apart. */
  region: string;
};

export type NominatimResult = {
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

export function toPlace(item: NominatimResult): Place | null {
  const address = item.address ?? {};
  const city = address.city || address.town || address.village || address.municipality || address.hamlet || item.name || '';
  const country = address.country || '';
  if (!city.trim() || !country.trim()) return null;
  return {
    city: city.trim(),
    country: country.trim(),
    countryCode: (address.country_code ?? '').toUpperCase(),
    region: address.state && address.state !== city ? address.state : '',
  };
}

/** Removes repeated suggestions (the same town can come back more than once). */
export function uniquePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.city}|${place.region}|${place.country}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Free text typed without picking a suggestion ("City, Country"): split on
 * the last comma. Without a comma nothing is inferred, so the customer is
 * asked to pick from the list or add the country.
 */
export function parseCityCountry(text: string): { city: string; country: string } {
  const index = text.lastIndexOf(',');
  if (index === -1) return { city: '', country: '' };
  return { city: text.slice(0, index).trim(), country: text.slice(index + 1).trim() };
}

export function formatPlace(place: { city: string; country: string }): string {
  return place.city && place.country ? `${place.city}, ${place.country}` : '';
}
