'use client';

import { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useVehicles } from '@/hooks/useVehicles';
import VehicleGrid from '@/components/catalog/VehicleGrid';
import type { Vehicle } from '@/types';
import { rentalSearchCriteria, type RentalSearchCriteria } from '@/lib/rental-search';

const CATEGORY_ORDER: Record<string, number> = {
  MINI: 0, ECONOMY: 1, COMPACT: 2, SEDAN: 3,
  CROSSOVER: 4, SUV: 5, LUXURY: 6, VAN: 7, COMMERCIAL: 8, ELECTRIC: 9,
};

/**
 * Filters stay interactive, and SWR still refreshes public fleet data. URL
 * criteria arrive from the server instead of forcing the whole grid through
 * a useSearchParams rendering bailout. Undated discovery gets fleet seed data.
 */
export default function RentalResults({ initialVehicles, criteria = rentalSearchCriteria() }: { initialVehicles?: Vehicle[]; criteria?: RentalSearchCriteria }) {
  const locale = useLocale();
  const isHe = locale === 'he';
  const { vehicles, isLoading } = useVehicles({ isAvailable: true }, initialVehicles);

  const { pickupDate, returnDate, location, pickupLocation, returnLocation } = criteria;

  const [categoryFilter, setCategoryFilter]         = useState(criteria.category);
  const [seatsFilter, setSeatsFilter]               = useState('');
  const [transmissionFilter, setTransmissionFilter] = useState('');

  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter(v => {
        if (categoryFilter) {
          if (categoryFilter === 'ECONOMY_COMPACT') {
            if (v.category !== 'ECONOMY' && v.category !== 'COMPACT') return false;
          } else if (v.category !== categoryFilter) {
            return false;
          }
        }
        if (transmissionFilter && v.transmission !== transmissionFilter) return false;
        if (seatsFilter) {
          const seats = Number(seatsFilter);
          if (seatsFilter === '8') { if (v.seats < 8) return false; }
          else { if (v.seats !== seats) return false; }
        }
        return true;
      })
      .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99))
      .filter((v, _, arr) => arr.findIndex(x => x.make === v.make && x.model === v.model) === arr.indexOf(v));
  }, [vehicles, categoryFilter, seatsFilter, transmissionFilter]);

  const hasFilters = categoryFilter || seatsFilter || transmissionFilter;

  return (
    <>
      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
        <select
          value={categoryFilter}
          aria-label={isHe ? 'סינון לפי קטגוריה' : 'Filter by category'}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="min-h-12 p-2 border border-gray-200 rounded-lg text-base bg-white outline-none focus:border-[#2D5F5F] cursor-pointer"
        >
          <option value="">{isHe ? 'כל הקטגוריות' : 'All categories'}</option>
          <option value="MINI">{isHe ? 'מיני' : 'Mini'}</option>
          <option value="ECONOMY_COMPACT">{isHe ? 'אקונומי / קומפקטי' : 'Economy / Compact'}</option>
          <option value="SEDAN">{isHe ? 'סדאן' : 'Sedan'}</option>
          <option value="CROSSOVER">{isHe ? 'קרוסאובר' : 'Crossover'}</option>
          <option value="SUV">SUV</option>
          <option value="LUXURY">{isHe ? 'יוקרה' : 'Luxury'}</option>
          <option value="VAN">{isHe ? 'ואן' : 'Van'}</option>
          <option value="COMMERCIAL">{isHe ? 'מסחרי' : 'Commercial'}</option>
          <option value="ELECTRIC">{isHe ? 'חשמלי' : 'Electric'}</option>
        </select>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-600 me-1">{isHe ? 'מושבים:' : 'Seats:'}</span>
          {(['', '4', '5', '7', '8'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSeatsFilter(s)}
              aria-pressed={seatsFilter === s}
              className={`min-h-11 min-w-11 px-3 py-1.5 rounded-lg text-sm border-2 transition-colors ${
                seatsFilter === s
                  ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white font-bold'
                  : 'border-gray-200 text-gray-600 hover:border-[#2D5F5F]'
              }`}
            >
              {s === '' ? (isHe ? 'הכל' : 'All') : s === '8' ? '8+' : `${s}`}
            </button>
          ))}
        </div>

        <select
          value={transmissionFilter}
          aria-label={isHe ? 'סינון לפי תיבת הילוכים' : 'Filter by transmission'}
          onChange={(e) => setTransmissionFilter(e.target.value)}
          className="min-h-12 p-2 border border-gray-200 rounded-lg text-base bg-white outline-none focus:border-[#2D5F5F] cursor-pointer"
        >
          <option value="">{isHe ? 'כל סוגי ההילוכים' : 'All transmissions'}</option>
          <option value="AUTOMATIC">{isHe ? 'אוטומטי' : 'Automatic'}</option>
          <option value="MANUAL">{isHe ? 'ידני' : 'Manual'}</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setCategoryFilter(''); setSeatsFilter(''); setTransmissionFilter(''); }}
            className="min-h-11 px-3 py-2 text-sm text-[#B64916] border border-[#B64916] rounded-lg hover:bg-orange-50 transition-colors"
          >
            {isHe ? 'נקה פילטרים' : 'Clear filters'}
          </button>
        )}

        {!isLoading && (
          <span className="ms-auto self-center text-sm text-gray-600">
            {filteredVehicles.length} {isHe ? 'דגמים' : 'models'}
          </span>
        )}
      </div>

      <VehicleGrid
        vehicles={filteredVehicles}
        isLoading={isLoading}
        pickupDate={pickupDate}
        returnDate={returnDate}
        location={location}
        pickupLocation={pickupLocation}
        returnLocation={returnLocation}
      />
    </>
  );
}
