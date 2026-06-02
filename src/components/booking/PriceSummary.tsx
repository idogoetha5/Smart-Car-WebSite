'use client';

import { formatCurrency } from '@/lib/utils';

interface PriceSummaryProps {
  totalDays: number;
  total: number;
  locale: string;
}

export function PriceSummary({ totalDays, total, locale }: PriceSummaryProps) {
  const isHe = locale === 'he';

  return (
    <div className="bg-[#eef6f6] rounded-xl p-4 border border-[#B8D8D8]">
      <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
        <span>{totalDays} {isHe ? 'ימים' : 'days'}</span>
      </div>
      <div className="flex justify-between items-center font-bold text-gray-900 border-t border-[#B8D8D8] pt-3">
        <span className="text-base">{isHe ? 'סה"כ לתשלום' : 'Total to pay'}</span>
        <span className="text-2xl text-[#2D5F5F]">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
