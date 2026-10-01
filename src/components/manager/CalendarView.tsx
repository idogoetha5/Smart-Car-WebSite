'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { byWhen, dayParts, longDate, taskWhen } from '@/lib/task-schedule';
import EmptyState from '@/components/ui/EmptyState';
import { useManager } from './ManagerData';
import TaskRow, { TaskList } from './TaskRow';
import type { ManagerTask } from './types';

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/** Month grid (pickups/returns per day, red dot = no driver) with the chosen day beside it, or everything ahead as a list. */
export default function CalendarView() {
  const { liveTasks, today, openNewTask, loading } = useManager();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<'month' | 'list'>('month');

  const byDay = useMemo(() => {
    const map = new Map<string, ManagerTask[]>();
    for (const t of liveTasks) {
      const d = taskWhen(t).day;
      if (!d) continue;
      map.set(d, [...(map.get(d) ?? []), t]);
    }
    return map;
  }, [liveTasks]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: first.getUTCDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  const title = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const shift = (delta: number) => {
    const next = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const selected = [...(byDay.get(day) ?? [])].sort(byWhen);
  const ahead = [...byDay.keys()].filter((d) => d >= today).sort();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0D2B2B]">יומן</h1>
          <p className="mt-1 text-sm text-slate-500">תכנון ומעקב אחר כל משימות הצוות</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([['month', 'חודש', CalendarPlus], ['list', 'רשימה', List]] as const).map(([key, text, Icon]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold transition ${mode === key ? 'bg-[#2D5F5F] text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {text}
            </button>
          ))}
        </div>
      </div>

      {mode === 'month' ? (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <button onClick={() => shift(-1)} aria-label="החודש הקודם" className="flex h-11 w-11 items-center justify-center rounded-full text-[#2D5F5F] hover:bg-[#eef6f6]">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <p className="text-lg font-black text-[#0D2B2B]">{title}</p>
              <button onClick={() => shift(1)} aria-label="החודש הבא" className="flex h-11 w-11 items-center justify-center rounded-full text-[#2D5F5F] hover:bg-[#eef6f6]">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 pb-1 text-center text-xs font-bold text-gray-400 sm:gap-1">
              {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`} />;
                const list = byDay.get(d) ?? [];
                const pickups = list.filter((t) => t.type === 'pickup').length;
                const services = list.filter((t) => t.type === 'service').length;
                const returns = list.length - pickups - services;
                const noDriver = list.some((t) => t.status === 'open' && !t.assigned_driver_id);
                const isSel = d === day;
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    onClick={() => setDay(d)}
                    aria-pressed={isSel}
                    aria-label={`${dayParts(d).date} — ${list.length} משימות`}
                    className={`relative flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-2xl p-1 transition sm:min-h-[84px] sm:items-stretch sm:p-2 ${
                      isSel ? 'bg-[#2D5F5F] text-white' : isToday ? 'bg-[#eef6f6]' : 'hover:bg-gray-50'
                    } ${d < today && !isSel ? 'opacity-50' : ''}`}
                  >
                    <span className={`text-sm font-black sm:text-start ${isSel ? 'text-white' : isToday ? 'text-[#E8743B]' : 'text-[#0D2B2B]'}`}>{dayParts(d).date}</span>
                    {list.length > 0 && (
                      <>
                        <span className="flex gap-0.5 sm:hidden" aria-hidden="true">
                          {pickups > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-[#E8743B]'}`} />}
                          {returns > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white/70' : 'bg-[#2D5F5F]'}`} />}
                          {services > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white/50' : 'bg-[#5B5BD6]'}`} />}
                        </span>
                        <span className="hidden flex-col gap-0.5 text-start text-[11px] font-bold leading-4 sm:flex">
                          {pickups > 0 && <span className={`truncate rounded-md px-1.5 ${isSel ? 'bg-white/15' : 'bg-orange-50 text-[#C24E17]'}`}>{pickups} מסירות</span>}
                          {returns > 0 && <span className={`truncate rounded-md px-1.5 ${isSel ? 'bg-white/15' : 'bg-[#eef6f6] text-[#2D5F5F]'}`}>{returns} החזרות</span>}
                          {services > 0 && <span className={`truncate rounded-md px-1.5 ${isSel ? 'bg-white/15' : 'bg-indigo-50 text-[#5B5BD6]'}`}>{services} רכב</span>}
                        </span>
                      </>
                    )}
                    {noDriver && <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-label="יש משימה בלי נהג" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 px-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E8743B]" />מסירה</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2D5F5F]" />החזרה</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#5B5BD6]" />טיפול ברכב / שטיפה</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />בלי נהג</span>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-[#0D2B2B]">{day === today ? 'היום' : longDate(day)}</h2>
              <button onClick={() => openNewTask({ date: day })} className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#E8743B] px-4 text-sm font-black text-white shadow-sm shadow-orange-200 hover:bg-[#d4632a]">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                משימה ליום הזה
              </button>
            </div>
            {loading ? (
              <div className="h-24 animate-pulse rounded-3xl bg-white" />
            ) : selected.length ? (
              <TaskList>{selected.map((t) => <TaskRow key={t.id} task={t} />)}</TaskList>
            ) : (
              <EmptyState icon={CalendarPlus} title="יום פנוי" text="אין משימות ביום הזה." />
            )}
          </section>
        </div>
      ) : ahead.length ? (
        <div className="space-y-6">
          {ahead.map((d) => {
            const list = [...(byDay.get(d) ?? [])].sort(byWhen);
            return (
              <section key={d}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-base font-black text-[#0D2B2B]">
                    {d === today ? 'היום' : longDate(d)}
                    <span className="ms-2 text-sm font-bold text-gray-400">{list.length}</span>
                  </h2>
                  <button onClick={() => openNewTask({ date: d })} aria-label="משימה ליום הזה" className="min-h-11 rounded-full px-3 text-sm font-black text-[#E8743B] hover:bg-orange-50">+ משימה</button>
                </div>
                <TaskList>{list.map((t) => <TaskRow key={t.id} task={t} />)}</TaskList>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={List} title="אין משימות קדימה" />
      )}
    </div>
  );
}
