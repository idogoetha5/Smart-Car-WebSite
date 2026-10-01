'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarCheck, Clock3, FileWarning, Search, UserX, X, Zap } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { numericOrderReference } from '@/lib/order-reference';
import { byWhen, dayParts, greeting, israelDate, longDate, taskLocation, taskWhen } from '@/lib/task-schedule';
import EmptyState from '@/components/ui/EmptyState';
import { useManager, type AlertKind } from './ManagerData';
import TaskRow, { TaskList } from './TaskRow';
import { taskCar } from './types';
import { serviceReasonLabel, serviceTitle } from '@/lib/service-task';
import RentalAlertsPanel from './RentalAlertsPanel';

const DAYS_AHEAD = 14;

/** Manager home: greeting, search, a strip of days, what needs attention, and the chosen day's tasks by time. */
export default function TodayView() {
  const { liveTasks, tasks, alerts, now, today, loading, openNewTask } = useManager();
  const { data: me } = useSWR<{ name?: string }>('/api/driver/me?as=manager', fetcher);
  const [day, setDay] = useState(today);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AlertKind | null>(null);

  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => israelDate(now, i)), [now]);
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of liveTasks) {
      const d = taskWhen(t).day;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [liveTasks]);

  const dayTasks = useMemo(() => liveTasks.filter((t) => taskWhen(t).day === day), [liveTasks, day]);
  const done = dayTasks.filter((t) => t.status === 'done').length;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const digits = needle.replace(/\D/g, '');
    return tasks
      .filter((t) => {
        if (t.type === 'service') {
          const car = taskCar(t);
          return [serviceTitle(t.service_kind, t.service_place), serviceReasonLabel(t.service_reason), taskLocation(t), bookingVehicleName(car), t.notes ?? '']
            .some((v) => v.toLowerCase().includes(needle)) || (digits.length >= 3 && bookingLicensePlate(car).replace(/\D/g, '').includes(digits));
        }
        const b = t.booking;
        if (!b) return false;
        return (
          (b.customer_name ?? '').toLowerCase().includes(needle) ||
          taskLocation(t).toLowerCase().includes(needle) ||
          bookingVehicleName(b).toLowerCase().includes(needle) ||
          (digits.length >= 3 && (bookingLicensePlate(b).replace(/\D/g, '').includes(digits) || (b.customer_phone ?? '').replace(/\D/g, '').includes(digits))) ||
          (b.id !== undefined && numericOrderReference(b.id) === query.trim())
        );
      })
      .sort((a, b) => byWhen(b, a))
      .slice(0, 50);
  }, [tasks, query]);

  const chips: Array<{ kind: AlertKind; label: string; count: number; icon: typeof Clock3; cls: string }> = [
    { kind: 'urgent', label: 'משימות דחופות', count: alerts.urgent.length, icon: Zap, cls: 'bg-white text-[#0D2B2B] ring-gray-200' },
    { kind: 'late', label: 'משימות באיחור', count: alerts.late.length, icon: Clock3, cls: 'bg-red-50 text-red-700 ring-red-100' },
    { kind: 'unassigned', label: 'ללא נהג', count: alerts.unassigned.length, icon: UserX, cls: 'bg-amber-50 text-amber-800 ring-amber-100' },
    { kind: 'unsigned', label: 'ממתינים לחתימה', count: alerts.unsigned.length, icon: FileWarning, cls: 'bg-sky-50 text-sky-800 ring-sky-100' },
  ];
  const name = me?.name ? `, ${me.name}` : '';

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-500">{longDate(today)}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0D2B2B] sm:text-4xl">{greeting(now)}{name}</h1>
        </div>
        <div className="relative w-full xl:max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי לקוח, רכב, טלפון או כתובת"
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white ps-12 pe-12 text-base shadow-sm transition focus:border-[#2D5F5F] focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="ניקוי" className="absolute top-1/2 end-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        </div>
      </header>

      {query.trim() ? (
        <section>
          <p className="mb-2 text-sm font-bold text-gray-500">{results.length ? `${results.length} תוצאות` : ''}</p>
          {results.length ? (
            <TaskList>{results.map((t) => <TaskRow key={t.id} task={t} showDay />)}</TaskList>
          ) : (
            <EmptyState icon={Search} title="לא נמצאו תוצאות" text="נסו לחפש לפי שם, מספר רישוי, טלפון או כתובת." />
          )}
        </section>
      ) : (
        <>
          {/* Attention */}
          <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
              {chips.map(({ kind, label, count, icon: Icon, cls }) => (
                <button
                  key={kind}
                  disabled={!count}
                  onClick={() => setFilter(filter === kind ? null : kind)}
                  aria-pressed={filter === kind}
                  className={`flex min-h-[68px] min-w-44 shrink-0 items-center gap-3 rounded-2xl border bg-white px-4 text-start shadow-sm transition sm:min-w-0 ${filter === kind ? 'border-[#2D5F5F] ring-2 ring-[#2D5F5F]/10' : 'border-slate-200'} disabled:cursor-default`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${cls}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span>
                    <span className="block text-xl font-extrabold tabular-nums text-[#0D2B2B]">{count}</span>
                    <span className="block text-xs font-bold text-slate-500">{label}</span>
                  </span>
                </button>
              ))}
          </div>

          <RentalAlertsPanel />

          {filter ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#0D2B2B]">{chips.find((c) => c.kind === filter)?.label}</h2>
                <button onClick={() => setFilter(null)} className="min-h-11 rounded-full px-4 text-sm font-bold text-[#2D5F5F] hover:bg-[#eef6f6]">חזרה ליום</button>
              </div>
              <TaskList>{alerts[filter].map((t) => <TaskRow key={t.id} task={t} showDay />)}</TaskList>
            </section>
          ) : (
            <>
              {/* Day strip */}
              <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="בחירת יום">
                {days.map((d) => {
                  const { weekday, date } = dayParts(d);
                  const n = countByDay.get(d) ?? 0;
                  const selected = d === day;
                  return (
                    <button
                      key={d}
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setDay(d)}
                      className={`flex h-[68px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition ${
                        selected ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white shadow-sm' : 'border-slate-200 bg-white text-[#0D2B2B] hover:border-[#B8D8D8]'
                      }`}
                    >
                      <span className={`text-xs font-bold ${selected ? 'text-white/80' : 'text-gray-400'}`}>{d === today ? 'היום' : weekday}</span>
                      <span className="text-lg font-black leading-none">{date}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${n ? (selected ? 'bg-white' : 'bg-[#E8743B]') : 'bg-transparent'}`} aria-label={n ? `${n} משימות` : undefined} />
                    </button>
                  );
                })}
              </div>

              {/* Day summary */}
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#0D2B2B]">{day === today ? 'היום' : longDate(day)}</h2>
                  <p className="text-sm text-gray-500">
                    {dayTasks.length ? `${dayTasks.length} משימות · ${done} בוצעו` : 'אין משימות'}
                  </p>
                </div>
                {dayTasks.length > 0 && (
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                    <div className="h-full rounded-full bg-[#2D5F5F] transition-all" style={{ width: `${Math.round((done / dayTasks.length) * 100)}%` }} />
                  </div>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-white" />)}
                </div>
              ) : dayTasks.length ? (
                <TaskList>{[...dayTasks].sort((a, b) => Number(Boolean(b.urgent && b.status === 'open')) - Number(Boolean(a.urgent && a.status === 'open')) || byWhen(a, b)).map((t) => <TaskRow key={t.id} task={t} />)}</TaskList>
              ) : (
                <EmptyState
                  icon={CalendarCheck}
                  title={day === today ? 'אין משימות היום' : 'אין משימות ביום הזה'}
                  text="אפשר להוסיף משימה ולשייך לה נהג עכשיו או אחר כך."
                  action={
                    <button onClick={() => openNewTask({ date: day })} className="min-h-12 rounded-2xl bg-[#E8743B] px-6 text-base font-black text-white">
                      משימה חדשה
                    </button>
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
