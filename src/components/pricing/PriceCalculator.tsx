'use client';

import { useState } from 'react';
import {
  DISPLAY_CATEGORIES,
  CATEGORY_PRICING,
  calculateByDays,
  type PricingCategoryKey,
} from '@/lib/pricing';

export default function PriceCalculator({ locale }: { locale: string }) {
  const [selectedKey, setSelectedKey] = useState<PricingCategoryKey>('COMPACT');
  const [days, setDays] = useState(3);
  const isHe = locale === 'he';

  const pricing = CATEGORY_PRICING[selectedKey];
  const { gross, discountPct, discountAmount, net } = calculateByDays(selectedKey, days);

  const selectedCat = DISPLAY_CATEGORIES.find((c) => c.key === selectedKey)!;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      {/* Category selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {DISPLAY_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedKey(cat.key)}
            className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border ${
              selectedKey === cat.key
                ? 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4D3E] hover:text-[#1B4D3E]'
            }`}
          >
            {isHe ? cat.labelHe : cat.labelEn}
          </button>
        ))}
      </div>

      {/* Days slider */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-700">
            {isHe ? 'מספר ימים' : 'Number of days'}
          </label>
          <span className="text-2xl font-black text-[#1B4D3E]">
            {days} {isHe ? 'ימים' : 'days'}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#1B4D3E]"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1</span>
          <span className="text-[#1B4D3E] font-medium">7 {isHe ? '(הנחה)' : '(discount)'}</span>
          <span className="text-[#1B4D3E] font-medium">14</span>
          <span className="text-[#1B4D3E] font-medium">30</span>
        </div>
      </div>

      {/* Result card */}
      <div className="bg-[#f0f7f4] rounded-2xl p-6 border border-[#d6ece5]">
        <div className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{isHe ? selectedCat.labelHe : selectedCat.labelEn}</span>
          {' · '}
          <span>
            ₪{pricing.pricePerDay.toLocaleString()} {isHe ? 'ליום' : 'per day'}
          </span>
          {' × '}
          <span>{days} {isHe ? 'ימים' : 'days'}</span>
        </div>

        {discountPct > 0 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">{isHe ? 'מחיר מלא' : 'Full price'}</span>
              <span className="text-gray-400 line-through text-sm">₪{gross.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#1B4D3E] font-semibold text-sm">
                {isHe ? `הנחת ${discountPct}%` : `${discountPct}% discount`}
              </span>
              <span className="text-[#1B4D3E] font-semibold text-sm">
                −₪{discountAmount.toLocaleString()}
              </span>
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-between pt-3 border-t border-[#aad8ca]">
          <span className="font-bold text-gray-900 text-lg">
            {isHe ? 'סה"כ לתשלום' : 'Total to pay'}
          </span>
          <span className="text-3xl font-black text-[#1B4D3E]">
            ₪{net.toLocaleString()}
          </span>
        </div>

        {discountPct > 0 && (
          <p className="text-xs text-[#2D6B55] mt-2 font-medium">
            {isHe
              ? `חסכת ₪${discountAmount.toLocaleString()} בהזמנה זו`
              : `You save ₪${discountAmount.toLocaleString()} on this booking`}
          </p>
        )}

        <p className="text-xs text-gray-400 mt-3">
          {isHe
            ? `פיקדון: ₪${pricing.deposit.toLocaleString()} | מחירים כוללים מע"מ | כפוף לתוספות עונתיות`
            : `Deposit: ₪${pricing.deposit.toLocaleString()} | Prices include VAT | Subject to seasonal surcharges`}
        </p>
      </div>
    </div>
  );
}
