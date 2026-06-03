'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { VehicleFilters, VehicleCategory, Transmission, FuelType } from '@/types';

interface VehicleFiltersProps {
  filters: VehicleFilters;
  onChange: (filters: VehicleFilters) => void;
}

export default function VehicleFiltersPanel({
  filters,
  onChange,
}: VehicleFiltersProps) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const isHe = locale === 'he';

  const categories: Array<{ value: VehicleCategory | 'ALL' | 'ECONOMY_COMPACT'; label: string }> = [
    { value: 'ALL', label: t('all_categories') },
    { value: 'MINI', label: isHe ? 'מיני' : 'Mini' },
    { value: 'ECONOMY_COMPACT', label: isHe ? 'אקונומי / קומפקטי' : 'Economy / Compact' },
    { value: 'SEDAN', label: isHe ? 'סדאן' : 'Sedan' },
    { value: 'CROSSOVER', label: isHe ? 'קרוסאובר' : 'Crossover' },
    { value: 'SUV', label: 'SUV' },
    { value: 'LUXURY', label: isHe ? 'יוקרה' : 'Luxury' },
    { value: 'VAN', label: isHe ? 'ואן' : 'Van' },
    { value: 'COMMERCIAL', label: isHe ? 'מסחרי' : 'Commercial' },
    { value: 'ELECTRIC', label: isHe ? 'חשמלי' : 'Electric' },
  ];

  const transmissions: Array<{ value: Transmission | 'ALL'; label: string }> = [
    { value: 'ALL', label: t('all_categories') },
    { value: 'AUTOMATIC', label: t('automatic') },
    { value: 'MANUAL', label: t('manual') },
  ];

  const fuelTypes: Array<{ value: FuelType | 'ALL'; label: string }> = [
    { value: 'ALL', label: t('all_categories') },
    { value: 'GASOLINE', label: isHe ? 'בנזין' : 'Gasoline' },
    { value: 'DIESEL', label: isHe ? 'דיזל' : 'Diesel' },
    { value: 'ELECTRIC', label: isHe ? 'חשמלי' : 'Electric' },
    { value: 'HYBRID', label: isHe ? 'היברידי' : 'Hybrid' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 pb-5 lg:pb-20">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('filter_category')}
        </label>
        <select
          value={filters.category ?? 'ALL'}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value as VehicleCategory | 'ALL' | 'ECONOMY_COMPACT' })
          }
          className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('filter_transmission')}
        </label>
        <select
          value={filters.transmission ?? 'ALL'}
          onChange={(e) =>
            onChange({ ...filters, transmission: e.target.value as Transmission | 'ALL' })
          }
          className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {transmissions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('filter_fuel')}
        </label>
        <select
          value={filters.fuelType ?? 'ALL'}
          onChange={(e) =>
            onChange({ ...filters, fuelType: e.target.value as FuelType | 'ALL' })
          }
          className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {fuelTypes.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('filter_price')}: ₪{filters.maxPricePerDay ?? 1000}
        </label>
        <input
          type="range"
          dir="ltr"
          min={100}
          max={1000}
          step={50}
          value={filters.maxPricePerDay ?? 1000}
          onChange={(e) =>
            onChange({ ...filters, maxPricePerDay: Number(e.target.value) })
          }
          className="w-full accent-blue-600"
        />
        <div dir="ltr" className="flex justify-between text-xs text-gray-400 mt-1">
          <span>₪100</span>
          <span>₪1000</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {isHe ? 'מספר מושבים' : 'Seats'}
        </label>
        <div className="flex flex-col gap-2">
          {([
            { labelHe: 'כל המושבים', labelEn: 'All seats', value: null },
            { labelHe: '4 מושבים', labelEn: '4 seats', value: 4 },
            { labelHe: '5 מושבים', labelEn: '5 seats', value: 5 },
            { labelHe: '7 מושבים', labelEn: '7 seats', value: 7 },
            { labelHe: '8+ מושבים', labelEn: '8+ seats', value: 8 },
          ] as const).map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => onChange({ ...filters, seats: opt.value })}
              className={`w-full text-start px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                (filters.seats ?? null) === opt.value
                  ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white font-bold'
                  : 'border-gray-200 hover:border-[#2D5F5F] text-gray-700'
              }`}
            >
              {isHe ? opt.labelHe : opt.labelEn}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onChange({})}
        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
      >
        {isHe ? 'נקה סינונים' : 'Clear filters'}
      </button>
    </div>
  );
}
