'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, ChevronLeft, Droplets, Gauge, KeyRound, RotateCcw, Search, Wrench, X } from 'lucide-react';
import { useApiList } from '@/lib/swr';
import { dayLabel } from '@/lib/task-schedule';
import { serviceReasonLabel, serviceTitle } from '@/lib/service-task';
import Sheet from '@/components/ui/Sheet';
import EmptyState from '@/components/ui/EmptyState';
import type { FleetEvent, FleetVehicle } from '@/app/api/driver/manage/fleet/route';
import { useManager } from './ManagerData';

const FILTERS = [
  { key: 'all', label: 'הכל' },
  { key: 'garage', label: 'במוסך' },
  { key: 'wash', label: 'לשטיפה' },
  { key: 'out', label: 'אצל לקוח' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const km = (n: number) => `${n.toLocaleString('he-IL')} ק״מ`;
const carName = (v: FleetVehicle) => `${v.make} ${v.model}`.trim();

function Plate({ plate }: { plate: string | null }) {
  if (!plate) return <span className="text-xs text-gray-400">אין מספר רישוי</span>;
  return (
    <span dir="ltr" className="inline-block rounded-md border border-yellow-500/60 bg-yellow-300/90 px-1.5 text-xs font-black tracking-wide text-gray-900">
      {plate}
    </span>
  );
}

function StatusPill({ v }: { v: FleetVehicle }) {
  if (v.inGarage) return <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-[#5B5BD6]">במוסך</span>;
  if (v.toWash) return <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-black text-sky-700">לשטיפה</span>;
  if (v.withCustomer) return <span className="rounded-full bg-[#eef6f6] px-2.5 py-0.5 text-xs font-black text-[#2D5F5F]">אצל לקוח</span>;
  if (!v.available) return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-black text-gray-500">לא זמין</span>;
  return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700">בסניף</span>;
}

function eventLook(e: FleetEvent) {
  if (e.kind === 'pickup') return { Icon: KeyRound, tone: 'bg-[#eef6f6] text-[#2D5F5F]', title: `מסירה ל${e.customerName ?? 'לקוח'}` };
  if (e.kind === 'return') return { Icon: RotateCcw, tone: 'bg-orange-50 text-[#E8743B]', title: `החזרה מ${e.customerName ?? 'לקוח'}` };
  if (e.serviceKind === 'wash') return { Icon: Droplets, tone: 'bg-sky-50 text-sky-600', title: 'שטיפה' };
  return { Icon: Wrench, tone: 'bg-indigo-50 text-[#5B5BD6]', title: serviceTitle(e.serviceKind, e.place) };
}

function EventRow({ e, now, onOpen }: { e: FleetEvent; now: number; onOpen?: () => void }) {
  const { Icon, tone, title } = eventLook(e);
  const reason = e.kind === 'service' && e.serviceKind !== 'wash' ? serviceReasonLabel(e.reason) : '';
  const bits = [
    reason && e.note ? `${reason}: ${e.note}` : reason || e.note || '',
    e.km != null ? km(e.km) : '',
    e.damageCount ? `${e.damageCount} נזקים מסומנים` : '',
    e.driverName ? `נהג: ${e.driverName}` : '',
  ].filter(Boolean);
  const body = (
    <>
      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="font-black text-[#0D2B2B]">{title}</span>
          {e.status === 'open' && <span className="rounded-full bg-amber-50 px-2 text-xs font-black text-amber-700">פתוחה</span>}
        </span>
        <span className="block text-sm text-gray-500">
          {dayLabel(e.day, now)}
          {e.time ? ` · ${e.time}` : ''}
        </span>
        {bits.length > 0 && <span className="block text-sm text-gray-600">{bits.join(' · ')}</span>}
      </span>
      {onOpen && <ChevronLeft className="mt-3 h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />}
    </>
  );
  return (
    <li className="border-b border-gray-100 last:border-0">
      {onOpen ? (
        <button onClick={onOpen} className="flex min-h-16 w-full items-start gap-3 px-4 py-3 transition hover:bg-gray-50">
          {body}
        </button>
      ) : (
        <div className="flex min-h-16 items-start gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

/**
 * Fleet ("רכבים"): every car with where it is now (בסניף / אצל לקוח /
 * במוסך / לשטיפה), quick "שטיפה" and "טיפול" buttons, and a sheet with the
 * car's full story — garage trips, washes, handovers and returns.
 */
export default function VehiclesView() {
  const { now, openNewTask, openTask, newTask } = useManager();
  const { items: cars, isLoading, mutate } = useApiList<FleetVehicle>('/api/driver/manage/fleet', { refreshInterval: 60_000 });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  // A wash / garage job sent from here shows on the car straight away.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !newTask.open) void mutate();
    wasOpen.current = newTask.open;
  }, [newTask.open, mutate]);

  const counts = useMemo(
    () => ({
      all: cars.length,
      garage: cars.filter((v) => v.inGarage).length,
      wash: cars.filter((v) => v.toWash).length,
      out: cars.filter((v) => v.withCustomer).length,
    }),
    [cars]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return cars.filter((v) => {
      if (filter === 'garage' && !v.inGarage) return false;
      if (filter === 'wash' && !v.toWash) return false;
      if (filter === 'out' && !v.withCustomer) return false;
      if (!q) return true;
      if (carName(v).toLowerCase().includes(q)) return true;
      return !!digits && (v.licensePlate ?? '').replace(/\D/g, '').includes(digits);
    });
  }, [cars, query, filter]);

  const open = openId ? cars.find((v) => v.id === openId) ?? null : null;
  const send = (type: 'wash' | 'service', v: FleetVehicle) => {
    setOpenId(null);
    openNewTask({ type, vehicleId: v.id });
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-black text-[#0D2B2B] sm:text-3xl">רכבים</h1>
        <p className="text-sm text-gray-500">{cars.length ? `${cars.length} רכבים בצי` : 'הצי של הסניף'}</p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי דגם או מספר רישוי"
          className="min-h-12 w-full rounded-full border border-gray-200 bg-white ps-12 pe-12 text-base shadow-sm transition focus:border-[#2D5F5F] focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="ניקוי" className="absolute top-1/2 end-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-black transition ${
              filter === f.key ? 'bg-[#2D5F5F] text-white' : 'bg-white text-gray-600 ring-1 ring-black/[0.06] hover:text-gray-900'
            }`}
          >
            {f.label}
            <span className={filter === f.key ? 'text-white/70' : 'text-gray-400'}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {isLoading && !cars.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-white ring-1 ring-black/[0.04]" />
          ))}
        </div>
      ) : !shown.length ? (
        <EmptyState icon={Car} title={query || filter !== 'all' ? 'לא נמצאו רכבים' : 'אין עדיין רכבים בצי'} text={query ? 'נסו דגם אחר או חלק ממספר הרישוי.' : undefined} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => (
            <li key={v.id} className="flex flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
              <button onClick={() => setOpenId(v.id)} className="mb-3 flex min-h-12 items-start gap-3 text-start">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef6f6] text-[#2D5F5F]">
                  <Car className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[#0D2B2B]">{carName(v)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <Plate plate={v.licensePlate} />
                    <StatusPill v={v} />
                  </span>
                </span>
                <ChevronLeft className="mt-3 h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
              </button>
              <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                  {v.lastKm != null ? km(v.lastKm) : 'אין ק״מ'}
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                  {v.lastWash ? dayLabel(v.lastWash, now) : 'לא נשטף'}
                </span>
              </p>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <button onClick={() => send('wash', v)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-sky-50 text-sm font-black text-sky-700 transition hover:bg-sky-100">
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                  שטיפה
                </button>
                <button onClick={() => send('service', v)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-indigo-50 text-sm font-black text-[#5B5BD6] transition hover:bg-indigo-100">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  טיפול
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? carName(open) : ''}
        footer={
          open && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => send('wash', open)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-sky-50 text-base font-black text-sky-700">
                <Droplets className="h-5 w-5" aria-hidden="true" />
                שליחה לשטיפה
              </button>
              <button onClick={() => send('service', open)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-50 text-base font-black text-[#5B5BD6]">
                <Wrench className="h-5 w-5" aria-hidden="true" />
                טיפול ברכב
              </button>
            </div>
          )
        }
      >
        {open && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Plate plate={open.licensePlate} />
              <StatusPill v={open} />
              {open.year ? <span className="text-sm text-gray-500">{open.year}</span> : null}
            </div>
            <dl className="mb-5 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'ק״מ אחרון', value: open.lastKm != null ? open.lastKm.toLocaleString('he-IL') : '—' },
                { label: 'שטיפה אחרונה', value: open.lastWash ? dayLabel(open.lastWash, now) : '—' },
                { label: 'טיפול אחרון', value: open.lastService ? dayLabel(open.lastService, now) : '—' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-gray-50 px-2 py-3">
                  <dt className="text-xs font-bold text-gray-500">{s.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-black text-[#0D2B2B]">{s.value}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mb-2 text-base font-black text-[#0D2B2B]">היסטוריה</h3>
            {open.history.length ? (
              <ul className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.06]">
                {open.history.map((e) => (
                  <EventRow
                    key={`${e.kind}-${e.id}`}
                    e={e}
                    now={now}
                    onOpen={
                      e.kind === 'service' && e.status === 'open'
                        ? () => {
                            setOpenId(null);
                            openTask(e.id);
                          }
                        : undefined
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">עוד אין היסטוריה לרכב הזה. מסירות, החזרות, מוסך ושטיפות יופיעו כאן.</p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
