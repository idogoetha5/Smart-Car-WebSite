'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import {
  formatPlace,
  parseCityCountry,
  toPlace,
  uniquePlaces,
  type NominatimResult,
  type Place,
} from '@/lib/city-country';

type Props = {
  id: string;
  locale: 'he' | 'en';
  city: string;
  country: string;
  onChange: (value: { city: string; country: string; countryCode: string }) => void;
  inputClass: string;
  labelClass: string;
};

/** One field that fills both city and country: type, then pick "City, Country". */
export default function CityCountryInput({ id, locale, city, country, onChange, inputClass, labelClass }: Props) {
  const isHe = locale === 'he';
  const listboxId = useId();
  const [text, setText] = useState(() => formatPlace({ city, country }));
  const [picked, setPicked] = useState(() => Boolean(city && country));
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
  }, []);

  const search = async (query: string) => {
    request.current?.abort();
    if (query.trim().length < 2) {
      setPlaces([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        addressdetails: '1',
        featureType: 'settlement',
        limit: '7',
        'accept-language': isHe ? 'he,en' : 'en',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('lookup_failed');
      const data = (await response.json()) as NominatimResult[];
      const next = uniquePlaces(data.map(toPlace).filter((place): place is Place => place !== null));
      setPlaces(next);
      setActive(-1);
      setOpen(next.length > 0);
    } catch {
      if (!controller.signal.aborted) {
        setPlaces([]);
        setOpen(false);
      }
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setText(value);
    setPicked(false);
    onChange({ ...parseCityCountry(value), countryCode: '' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(value), 450);
  };

  const choose = (place: Place) => {
    setText(formatPlace(place));
    setPicked(true);
    setOpen(false);
    setPlaces([]);
    onChange({ city: place.city, country: place.country, countryCode: place.countryCode });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || places.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % places.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index <= 0 ? places.length - 1 : index - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(places[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className={labelClass}>{isHe ? 'עיר ומדינה' : 'City and country'}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => places.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={`${inputClass} pe-11`}
          autoComplete="off"
          required
          maxLength={200}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={open && active >= 0 ? `${listboxId}-${active}` : undefined}
        />
        <span className={`pointer-events-none absolute bottom-3.5 end-4 ${picked ? 'text-[#2D5F5F]' : 'text-gray-400'}`} aria-hidden="true">
          {picked ? <Check className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        </span>
        {open && places.length > 0 && (
          <ul id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {places.map((place, index) => (
              <li
                key={`${place.city}|${place.region}|${place.country}`}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => { event.preventDefault(); choose(place); }}
                className={`cursor-pointer border-b border-gray-100 px-4 py-3 text-start last:border-0 ${index === active ? 'bg-[#eef6f6]' : 'hover:bg-[#eef6f6]'}`}
              >
                <span className="block text-sm font-bold text-[#0D2B2B]">{formatPlace(place)}</span>
                {place.region && <span className="block text-xs text-gray-500">{place.region}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-gray-400">{isHe ? 'חיפוש מקומות: © OpenStreetMap contributors' : 'Place search: © OpenStreetMap contributors'}</p>
    </div>
  );
}
