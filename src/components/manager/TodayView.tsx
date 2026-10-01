'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, CalendarCheck, Clock3, FileWarning, Search, UserX, X, Zap } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { numericOrderReference } from '@/lib/order-reference';
import { byWhen, dayParts, greeting, israelDate, longDate, taskLocation, taskWhen } from '@/lib/task-schedule';
import EmptyState from '@/components/ui/EmptyState';
import { useManager, type AlertKind } from './ManagerData';
import TaskRow, { TaskList } from './TaskRow';
import { taskCar } from './types';
import { serviceReasonLabel, serviceTitle } from '@/lib/service-task';
import DocRow from './DocRow';

const DAYS_AHEAD = 14;

/** Manager home: greeting, search, a strip of days, what needs attention, and the chosen day's tasks by time. */
export default function TodayView() {
  const { liveTasks, tasks, alerts, now, today, loading, openNewTask } = useManager();
  const { data: me } = useSWR<{ name?: string }>('/api/driver/me', fetcher);
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
    { kind: 'urgent', label: 'דחופות', count: alerts.urgent.length, icon: Zap, cls: 'bg-white text-[#0D2B2B] ring-gray-200' },
    { kind: 'late', label: 'באיחור', count: alerts.late.length, icon: Clock3, cls: 'bg-red-50 text-red-700 ring-red-100' },
    { kind: 'unassigned', label: 'ללא נהג', count: alerts.unassigned.length, icon: UserX, cls: 'bg-amber-50 text-amber-800 ring-amber-100' },
    { kind: 'unsigned', label: 'ממתינים לחתימה', count: alerts.unsigned.length, icon: FileWarning, cls: 'bg-sky-50 text-sky-800 ring-sky-100' },
    { kind: 'damage', label: 'נזק בהחזרה', count: alerts.damageJobs.length, icon: AlertTriangle, cls: 'bg-red-50 text-red-700 ring-red-100' },
  ];
  const activeChips = chips.filter((c) => c.count > 0);

  const name = me?.name ? `, ${me.name}` : '';

  return (
    <div>
      <p className="text-sm font-bold text-gray-500">{longDate(today)}</p>
      <h1 className="mb-5 text-2xl font-black text-[#0D2B2B] sm:text-3xl">{greeting(now)}{name}</h1>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לקוח, רכב, טלפון או כתובת"
          className="h-13 min-h-12 w-full rounded-full border border-gray-200 bg-white ps-12 pe-12 text-base shadow-sm transition focus:border-[#2D5F5F] focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="ניקוי" className="absolute top-1/2 end-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {query.trim() ? (
        <section>
          <p className="mb-2 text-sm font-bold text-gray-500">{results.length ? `${results.length} תוצאות` : ''}</p>
          {results.length ? (
            <TaskList>{results.map((t) => <TaskRow key={t.id} task={t} showDay />)}</TaskList>
          ) : (
            <EmptyState icon={Search} title="לא נמצא" text="נסו שם אחר, מספר רישוי או טלפון." />
          )}
        </section>
      ) : (
        <>
          {/* Attention */}
          {activeChips.length > 0 && (
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {activeChips.map(({ kind, label, count, icon: Icon, cls }) => (
                <button
                  key={kind}
                  onClick={() => setFilter(filter === kind ? null : kind)}
                  aria-pressed={filter === kind}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black ring-1 transition ${cls} ${filter === kind ? 'ring-2 ring-current' : ''}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="tabular-nums">{count}</span> {label}
                </button>
              ))}
            </div>
          )}

          {filter ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#0D2B2B]">{chips.find((c) => c.kind === filter)?.label}</h2>
                <button onClick={() => setFilter(null)} className="min-h-11 rounded-full px-4 text-sm font-bold text-[#2D5F5F] hover:bg-[#eef6f6]">חזרה ליום</button>
              </div>
              {filter === 'damage' ? (
                <TaskList>{alerts.damageJobs.map((j) => <DocRow key={j.id} job={j} />)}</TaskList>
              ) : (
                <TaskList>{alerts[filter].map((t) => <TaskRow key={t.id} task={t} showDay />)}</TaskList>
              )}
            </section>
          ) : (
            <>
              {/* Day strip */}
              <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="בחירת יום">
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
                      className={`flex h-[72px] w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl transition ${
                        selected ? 'bg-[#2D5F5F] text-white shadow-md shadow-[#2D5F5F]/20' : 'bg-white text-[#0D2B2B] ring-1 ring-black/[0.05] hover:ring-[#B8D8D8]'
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
