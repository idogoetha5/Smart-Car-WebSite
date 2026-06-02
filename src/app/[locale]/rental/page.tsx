'use client';

import { useState, useMemo } from 'react';

const CATEGORY_ORDER: Record<string, number> = {
  MINI: 0, ECONOMY: 1, COMPACT: 2, SEDAN: 3,
  CROSSOVER: 4, SUV: 5, LUXURY: 6, VAN: 7, COMMERCIAL: 8, ELECTRIC: 9,
};
import { useTranslations, useLocale } from 'next-intl';
import { useVehicles } from '@/hooks/useVehicles';
import VehicleGrid from '@/components/catalog/VehicleGrid';
import { Car, ChevronRight, ChevronLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function RentalPage() {
  const t = useTranslations('booking');
  const locale = useLocale();
  const isHe = locale === 'he';
  const { vehicles, isLoading } = useVehicles({ isAvailable: true });
  const searchParams = useSearchParams();

  const pickupDate     = searchParams.get('pickup') ?? '';
  const returnDate     = searchParams.get('return') ?? '';
  const location       = searchParams.get('location') ?? '';
  const pickupLocation = searchParams.get('pickupLocation') ?? location;
  const returnLocation = searchParams.get('returnLocation') ?? pickupLocation;

  const [categoryFilter, setCategoryFilter]       = useState('');
  const [seatsFilter, setSeatsFilter]             = useState('');
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
      .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));
  }, [vehicles, categoryFilter, seatsFilter, transmissionFilter]);

  const hasFilters = categoryFilter || seatsFilter || transmissionFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <div className="flex items-center gap-2 text-blue-600 mb-3">
          <Car className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            {isHe ? 'השכרת רכב' : 'Car Rental'}
          </span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-3">{t('title')}</h1>
        <p className="text-gray-500 text-lg">
          {isHe
            ? 'בחר רכב מהמלאי ובצע הזמנה מהירה'
            : 'Choose a vehicle from our fleet and make a quick booking'}
        </p>
      </div>

      <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <h2 className="font-bold text-gray-800 mb-2">
          {isHe ? 'איך זה עובד?' : 'How it works'}
        </h2>
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          {(isHe
            ? ['בחר רכב', 'בחר תאריכים', 'מלא פרטים', 'אשר הזמנה']
            : ['Choose vehicle', 'Select dates', 'Fill details', 'Confirm booking']
          ).map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <span>{step}</span>
              {i < 3 && (isHe
                ? <ChevronLeft className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="p-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-[#2D5F5F] cursor-pointer"
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
          <span className="text-xs text-gray-500 me-1">{isHe ? 'מושבים:' : 'Seats:'}</span>
          {(['', '4', '5', '7', '8'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSeatsFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors ${
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
          onChange={(e) => setTransmissionFilter(e.target.value)}
          className="p-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-[#2D5F5F] cursor-pointer"
        >
          <option value="">{isHe ? 'כל סוגי ההילוכים' : 'All transmissions'}</option>
          <option value="AUTOMATIC">{isHe ? 'אוטומטי' : 'Automatic'}</option>
          <option value="MANUAL">{isHe ? 'ידני' : 'Manual'}</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setCategoryFilter(''); setSeatsFilter(''); setTransmissionFilter(''); }}
            className="px-3 py-2 text-sm text-[#E8743B] border border-[#E8743B] rounded-lg hover:bg-orange-50 transition-colors"
          >
            {isHe ? 'נקה פילטרים' : 'Clear filters'}
          </button>
        )}

        {!isLoading && (
          <span className="ms-auto self-center text-sm text-gray-400">
            {filteredVehicles.length} {isHe ? 'רכבים' : 'vehicles'}
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
    </div>
  );
}
