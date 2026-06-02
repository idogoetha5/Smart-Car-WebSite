'use client';

import { useState, useEffect, useCallback } from 'react';

interface ChartPoint { date: string; count: number }

const DAY_LABELS_HE: Record<number, string> = { 0: 'א', 1: 'ב', 2: 'ג', 3: 'ד', 4: 'ה', 5: 'ו', 6: 'ש' };
const DAY_LABELS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DashboardChart({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats/chart?days=${d}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(days); }, [fetchData, days]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const switchDays = (d: 7 | 30) => { setDays(d); fetchData(d); };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          {isHe ? 'הזמנות לפי תאריך' : 'Bookings by Date'}
        </h2>
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => switchDays(7)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${days === 7 ? 'bg-[#2D5F5F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {isHe ? '7 ימים' : '7 Days'}
          </button>
          <button
            onClick={() => switchDays(30)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${days === 30 ? 'bg-[#2D5F5F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {isHe ? '30 ימים' : '30 Days'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-end gap-1">
          {Array.from({ length: days }).map((_, i) => (
            <div key={i} className="flex-1 bg-gray-100 rounded-t-lg animate-pulse" style={{ height: `${20 + Math.random() * 80}px` }} />
          ))}
        </div>
      ) : (
        <div className="flex items-end gap-1 h-40 overflow-x-auto">
          {data.map(({ date, count }) => {
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
