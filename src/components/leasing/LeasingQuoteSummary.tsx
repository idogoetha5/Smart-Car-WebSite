'use client';

import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/utils';

interface LeasingQuoteSummaryProps {
  monthlyPayment: number;
  totalCost: number;
  downPayment: number;
  durationMonths: number;
  mileagePackage: number;
}

export function LeasingQuoteSummary({
  monthlyPayment,
  totalCost,
  downPayment,
  durationMonths,
  mileagePackage,
}: LeasingQuoteSummaryProps) {
  const t = useTranslations('leasing');

  return (
    <div className="bg-gray-50 rounded-xl p-5 space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">{t('duration')}</span>
        <span className="font-semibold">{durationMonths} {t('months')}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">{t('down_payment')}</span>
        <span className="font-semibold">{formatCurrency(downPayment)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">{t('mileage_package')}</span>
        <span className="font-semibold">{mileagePackage.toLocaleString()} {t('km_per_year')}</span>
      </div>
      <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-3">
        <span>{t('monthly_payment')}</span>
        <span className="text-blue-600">{formatCurrency(monthlyPayment)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>{t('total_cost')}</span>
        <span className="font-semibold">{formatCurrency(totalCost)}</span>
      </div>
    </div>
  );
}
