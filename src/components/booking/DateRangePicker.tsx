'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useLocale } from 'next-intl';

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: DateRangePickerProps) {
  const locale = useLocale();
  const isRTL = locale === 'he';
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-3">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <input
        type="date"
        value={startDate ?? ''}
        min={today}
        lang={isRTL ? 'he' : 'en'}
        onChange={(e) => onStartChange(e.target.value)}
        className="flex-1 text-sm border-none outline-none bg-transparent"
      />
      <span className="text-gray-400">{isRTL ? '←' : '→'}</span>
      <input
        type="date"
        value={endDate ?? ''}
        min={startDate ?? today}
        lang={isRTL ? 'he' : 'en'}
        onChange={(e) => onEndChange(e.target.value)}
        className="flex-1 text-sm border-none outline-none bg-transparent"
      />
    </div>
  );
}
