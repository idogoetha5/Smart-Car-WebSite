import { describe, expect, it } from 'vitest';
import { formatPlace, parseCityCountry, toPlace, uniquePlaces } from '@/lib/city-country';

describe('toPlace', () => {
  it('reads city and country from a Nominatim result', () => {
    expect(toPlace({ name: 'London', address: { city: 'London', state: 'England', country: 'United Kingdom', country_code: 'gb' } }))
      .toEqual({ city: 'London', country: 'United Kingdom', countryCode: 'GB', region: 'England' });
  });

  it('falls back to town or village when there is no city', () => {
    expect(toPlace({ address: { town: 'Zikhron Ya\'akov', country: 'Israel', country_code: 'il' } })?.city).toBe('Zikhron Ya\'akov');
    expect(toPlace({ address: { village: 'Gordes', country: 'France' } })?.city).toBe('Gordes');
  });

  it('drops a result without a country', () => {
    expect(toPlace({ name: 'Nowhere', address: { city: 'Nowhere' } })).toBeNull();
  });
});

describe('uniquePlaces', () => {
  it('removes duplicate suggestions', () => {
    const paris = { city: 'Paris', country: 'France', countryCode: 'FR', region: '' };
    expect(uniquePlaces([paris, { ...paris }])).toHaveLength(1);
  });
});

describe('parseCityCountry', () => {
  it('splits typed text on the last comma', () => {
    expect(parseCityCountry('Paris, Texas, United States')).toEqual({ city: 'Paris, Texas', country: 'United States' });
  });

  it('keeps the whole text as the city when there is no comma', () => {
    expect(parseCityCountry('London')).toEqual({ city: 'London', country: '' });
  });
});

describe('formatPlace', () => {
  it('joins city and country', () => {
    expect(formatPlace({ city: 'Haifa', country: 'Israel' })).toBe('Haifa, Israel');
    expect(formatPlace({ city: '', country: '' })).toBe('');
  });
});
