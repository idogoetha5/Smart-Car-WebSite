'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';

interface ChartPoint { date: string; count: number }

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardChart({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const todayMonth = monthKey(new Date());

  const { data, isLoading: loading } = useSWR<ChartPoint[]>(
    `/api/admin/stats/chart?month=${month}`,
    fetcher,
  );
  const points = data ?? [];
  const maxCount = Math.max(...points.map(d => d.count), 1);
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(isHe ? 'he-IL' : 'en-US', {
    month: 'long', year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`)), [isHe, month]);
  const changeMonth = (direction: number) => {
    const [year, monthNumber] = month.split('-').map(Number);
    setMonth(monthKey(new Date(year, monthNumber - 1 + direction, 1)));
  };

  return (
    <section className="mb-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(13,43,43,0.05)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#0D2B2B]">{isHe ? 'הזמנות שנוצרו לפי יום' : 'Bookings created by day'}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">{isHe ? `חודש ${monthLabel} · ${total} הזמנות` : `${monthLabel} · ${total} bookings`}</p>
        </div>
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => changeMonth(-1)}
            aria-label={isHe ? 'חודש קודם' : 'Previous month'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#2D5F5F] hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => changeMonth(1)}
            disabled={month >= todayMonth}
            aria-label={isHe ? 'חודש הבא' : 'Next month'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#2D5F5F] hover:bg-white disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid h-48 grid-cols-[repeat(31,minmax(0,1fr))] items-end gap-1">
          {Array.from({ length: 31 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-t bg-slate-100" />)}
        </div>
      ) : (
        <div className="grid h-52 grid-cols-[repeat(31,minmax(0,1fr))] items-end gap-1" dir="ltr">
          {points.map(({ date, count }) => {
            const dayNum = Number(date.slice(-2));
            const barH = count ? Math.max(12, Math.round((count / maxCount) * 156)) : 4;
            return (
              <div key={date} className="flex min-w-0 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-black text-[#2D5F5F]">{count || ''}</span>
                <div
                  className="w-full rounded-t-md bg-[#2D5F5F] transition-colors hover:bg-[#E8743B]"
                  style={{ height: `${barH}px` }}
                  title={`${dayNum}: ${count}`}
                />
                <span className="text-[9px] font-semibold text-slate-400 leading-none">{dayNum % 5 === 0 || dayNum === 1 ? dayNum : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
