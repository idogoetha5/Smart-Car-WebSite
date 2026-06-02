'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import { LEASING_DURATIONS, MILEAGE_PACKAGES } from '@/lib/constants';
import type { Vehicle } from '@/types';

const DURATION_MULTIPLIER: Record<number, number> = {
  12: 1.15,
  18: 1.10,
  24: 1.05,
  30: 1.02,
  36: 1.00,
  42: 0.98,
  48: 0.95,
  54: 0.93,
  60: 0.90,
};

const MILEAGE_MULTIPLIER: Record<number, number> = {
  10000: 0.95,
  15000: 1.00,
  20000: 1.08,
  30000: 1.18,
};

interface LeasingCalculatorProps {
  vehicles: Vehicle[];
  defaultVehicleId?: string;
}

export default function LeasingCalculator({
  vehicles,
  defaultVehicleId,
}: LeasingCalculatorProps) {
  const t = useTranslations('leasing');
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? '');
  const [durationMonths, setDurationMonths] = useState(36);
  const [downPayment, setDownPayment] = useState(0);
  const [mileagePackage, setMileagePackage] = useState(15000);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  const monthlyPayment = useMemo(() => {
    if (!selectedVehicle) return 0;
    const base = selectedVehicle.pricePerMonth;
    const mileageMultiplier = MILEAGE_MULTIPLIER[mileagePackage] ?? 1.0;
    const durationMultiplier = DURATION_MULTIPLIER[durationMonths] ?? 1.0;
    const monthly = Math.round(base * mileageMultiplier * durationMultiplier);
    if (downPayment > 0) {
      return Math.max(0, Math.round(monthly - downPayment / durationMonths));
    }
    return monthly;
  }, [selectedVehicle, durationMonths, mileagePackage, downPayment]);

  const totalCost = monthlyPayment * durationMonths + downPayment;

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('vehicle')}
          </label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('vehicle')}...</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} – ₪{v.pricePerMonth}/{t('months')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('duration')}: {durationMonths} {t('months')}
            {durationMonths >= 36 && (
              <span className="ms-2 text-xs text-green-600 font-normal">
                {durationMonths === 60 ? '(חיסכון מקסימלי)' : '(חיסכון)'}
              </span>
            )}
          </label>
          <div className="flex gap-2 flex-wrap">
            {LEASING_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMonths(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  durationMonths === d
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('down_payment')}: ₪{downPayment.toLocaleString()}
          </label>
          <input
            type="range"
            min={0}
            max={50000}
            step={1000}
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>₪0</span>
            <span>₪50,000</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('mileage_package')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {MILEAGE_PACKAGES.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setMileagePackage(km)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mileagePackage === km
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {km.toLocaleString()} {t('km_per_year')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        className="lg:col-span-2"
        key={`${vehicleId}-${durationMonths}-${downPayment}-${mileagePackage}`}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold mb-6 opacity-90">{t('monthly_payment')}</h3>

          <div className="text-5xl font-black mb-2">
            {formatCurrency(monthlyPayment)}
          </div>
          <p className="text-blue-200 text-sm mb-6">
            /{t('months')} × {durationMonths}
          </p>

          <div className="space-y-3 border-t border-blue-500 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-blue-200">{t('down_payment')}</span>
              <span className="font-semibold">{formatCurrency(downPayment)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200">{t('mileage_package')}</span>
              <span className="font-semibold">
                {mileagePackage.toLocaleString()} {t('km_per_year')}
              </span>
            </div>
            <div className="flex justify-between font-bold border-t border-blue-500 pt-3">
              <span className="text-blue-100">{t('total_cost')}</span>
              <span className="text-xl">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
