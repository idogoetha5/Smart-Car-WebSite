'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';

/** Varied but fixed skeleton bar heights, so the placeholder does not jitter. */
const SKELETON_HEIGHTS = [46, 72, 28, 61, 39, 80, 34, 55, 68, 24, 50, 76, 31, 64];

interface ChartPoint { date: string; count: number }

const DAY_LABELS_HE: Record<number, string> = { 0: 'א', 1: 'ב', 2: 'ג', 3: 'ד', 4: 'ה', 5: 'ו', 6: 'ש' };
const DAY_LABELS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DashboardChart({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  const [days, setDays] = useState<7 | 30>(7);

  // The range is part of the key, so switching it refetches on its own. The
  // previous version both set state and called the fetcher by hand, which
  // fired the request twice for every click; and the range already visited
  // now comes straight from cache.
  const { data, isLoading: loading } = useSWR<ChartPoint[]>(
    `/api/admin/stats/chart?days=${days}`,
    fetcher,
  );
  const points = data ?? [];

  const maxCount = Math.max(...points.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          {isHe ? 'הזמנות לפי תאריך' : 'Bookings by Date'}
        </h2>
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setDays(7)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${days === 7 ? 'bg-[#2D5F5F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {isHe ? '7 ימים' : '7 Days'}
          </button>
          <button
            onClick={() => setDays(30)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${days === 30 ? 'bg-[#2D5F5F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {isHe ? '30 ימים' : '30 Days'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-end gap-1">
          {Array.from({ length: days }).map((_, i) => (
            // Deterministic heights. Math.random() here re-rolled on every
            // render and produced different markup on the server than on the
            // client, so the skeleton flickered through hydration. A fixed
            // repeating pattern looks the same and stays put.
            <div
              key={i}
              className="flex-1 bg-gray-100 rounded-t-lg animate-pulse"
              style={{ height: `${20 + SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length]}px` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-end gap-1 h-40 overflow-x-auto">
          {points.map(({ date, count }) => {
            const d = new Date(date);
            const barH = Math.max(8, Math.round((count / maxCount) * 128));
            const label = isHe ? DAY_LABELS_HE[d.getDay()] : DAY_LABELS_EN[d.getDay()];
            const dayNum = d.getDate();
            return (
              <div key={date} className="flex-1 min-w-[24px] flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-[#2D5F5F]">{count > 0 ? count : ''}</span>
                <div
                  className="w-full rounded-t-lg bg-[#2D5F5F] hover:bg-[#E8743B] transition-colors cursor-default"
                  style={{ height: `${barH}px` }}
                  title={`${date}: ${count}`}
                />
                <span className="text-[9px] text-gray-400 leading-none">{days === 30 ? dayNum : label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
