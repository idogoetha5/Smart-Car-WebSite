'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Car, ChevronLeft, Droplets, Gauge, KeyRound, Plus, RotateCcw, Search, Trash2, Wrench, X } from 'lucide-react';
import { useApiList } from '@/lib/swr';
import { dayLabel } from '@/lib/task-schedule';
import { serviceReasonLabel, serviceTitle } from '@/lib/service-task';
import Sheet from '@/components/ui/Sheet';
import EmptyState from '@/components/ui/EmptyState';
import type { FleetEvent, FleetVehicle } from '@/app/api/driver/manage/fleet/route';
import { useManager } from './ManagerData';
import { useToast } from '@/components/ui/AppToast';

const FILTERS = [
  { key: 'all', label: 'הכל' },
  { key: 'garage', label: 'במוסך' },
  { key: 'wash', label: 'לשטיפה' },
  { key: 'out', label: 'אצל לקוח' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const km = (n: number) => `${n.toLocaleString('he-IL')} ק״מ`;
const carName = (v: FleetVehicle) => `${v.make} ${v.model}`.trim();
const field = 'min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-base transition focus:border-[#2D5F5F] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10';
const label = 'mb-1.5 block text-sm font-bold text-gray-700';

const CATEGORY_OPTIONS = [
  ['MINI', 'מיני'], ['ECONOMY', 'חסכוני'], ['COMPACT', 'קומפקטי'], ['SEDAN', 'סדאן'],
  ['CROSSOVER', 'קרוסאובר'], ['SUV', 'SUV'], ['LUXURY', 'יוקרה'], ['VAN', 'ואן'],
  ['COMMERCIAL', 'מסחרי'], ['ELECTRIC', 'חשמלי'],
] as const;
const FUEL_OPTIONS = [['GASOLINE', 'בנזין'], ['DIESEL', 'דיזל'], ['ELECTRIC', 'חשמלי'], ['HYBRID', 'היברידי']] as const;
const TRANSMISSION_OPTIONS = [['AUTOMATIC', 'אוטומטי'], ['MANUAL', 'ידני']] as const;

interface NewVehicleForm {
  make: string;
  model: string;
  licensePlate: string;
  year: string;
  testDueDate: string;
  currentOdometerKm: string;
  color: string;
  category: string;
  fuelType: string;
  transmission: string;
  seats: string;
  doors: string;
  pricePerDay: string;
  pricePerMonth: string;
  depositAmount: string;
  available: boolean;
}

const emptyVehicle = (): NewVehicleForm => ({
  make: '', model: '', licensePlate: '', year: String(new Date().getFullYear()), testDueDate: '', currentOdometerKm: '',
  color: 'לבן', category: 'ECONOMY', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', seats: '5', doors: '4',
  pricePerDay: '150', pricePerMonth: '2000', depositAmount: '1500', available: true,
});

function testLabel(date: string | null, now: number) {
  if (!date) return { text: 'מועד טסט לא הוזן', urgent: false };
  const due = new Date(`${date}T12:00:00`).getTime();
  const days = Math.ceil((due - now) / 86_400_000);
  const formatted = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(due));
  if (days < 0) return { text: `הטסט פג ב־${formatted}`, urgent: true };
  if (days <= 30) return { text: `טסט עד ${formatted}`, urgent: true };
  return { text: `טסט עד ${formatted}`, urgent: false };
}

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
  const toast = useToast();
  const { items: cars, isLoading, mutate } = useApiList<FleetVehicle>('/api/driver/manage/fleet', { refreshInterval: 60_000 });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewVehicleForm>(() => emptyVehicle());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<FleetVehicle | null>(null);

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

  const setField = <K extends keyof NewVehicleForm>(key: K, value: NewVehicleForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const response = await fetch('/api/driver/manage/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFormError(json.error || 'לא הצלחנו להוסיף את הרכב');
        return;
      }
      setAdding(false);
      setForm(emptyVehicle());
      await mutate();
      toast('הרכב נוסף לצי');
    } finally {
      setSaving(false);
    }
  };

  const deleteVehicle = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/driver/manage/fleet/${deleting.id}`, { method: 'DELETE' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(json.error || 'לא הצלחנו למחוק את הרכב', false);
        return;
      }
      setOpenId(null);
      setDeleting(null);
      await mutate();
      toast('הרכב נמחק מהצי');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0D2B2B]">רכבים</h1>
          <p className="mt-1 text-sm text-slate-500">{cars.length ? `${cars.length} רכבים בצי · מצב, תחזוקה וזמינות` : 'הצי של הסניף'}</p>
        </div>
        <button
          type="button"
          onClick={() => { setForm(emptyVehicle()); setFormError(''); setAdding(true); }}
          className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#E8743B] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#d4632a] active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          הוספת רכב
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי דגם או מספר רישוי"
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white ps-12 pe-12 text-base shadow-sm transition focus:border-[#2D5F5F] focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10"
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
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-4 text-sm font-bold transition ${
              filter === f.key ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
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
            <li key={v.id} className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <button
                type="button"
                onClick={() => setDeleting(v)}
                aria-label={`מחיקת ${carName(v)}`}
                className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
              <button onClick={() => setOpenId(v.id)} className="mb-3 flex min-h-12 items-start gap-3 ps-12 text-start">
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
                <span className={`flex items-center gap-1 ${testLabel(v.testDueDate, now).urgent ? 'font-bold text-red-600' : ''}`}>
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  {testLabel(v.testDueDate, now).text}
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
              {open.color ? <span className="text-sm text-gray-500">{open.color}</span> : null}
            </div>
            <dl className="mb-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                { label: 'ק״מ אחרון', value: open.lastKm != null ? open.lastKm.toLocaleString('he-IL') : '—' },
                { label: 'שטיפה אחרונה', value: open.lastWash ? dayLabel(open.lastWash, now) : '—' },
                { label: 'טיפול אחרון', value: open.lastService ? dayLabel(open.lastService, now) : '—' },
                { label: 'טסט', value: testLabel(open.testDueDate, now).text.replace('טסט עד ', '') },
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

      <Sheet
        open={adding}
        onClose={() => !saving && setAdding(false)}
        title="הוספת רכב לצי"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} disabled={saving} className="min-h-12 flex-1 rounded-2xl bg-gray-100 text-sm font-bold text-gray-600">ביטול</button>
            <button type="submit" form="add-fleet-vehicle" disabled={saving} className="min-h-12 flex-[2] rounded-2xl bg-[#E8743B] text-sm font-black text-white shadow-sm shadow-orange-200 disabled:opacity-50">
              {saving ? 'מוסיף את הרכב…' : 'הוספת הרכב'}
            </button>
          </div>
        }
      >
        <form id="add-fleet-vehicle" onSubmit={addVehicle} className="space-y-5">
          <p className="text-sm text-gray-500">הפרטים ישמשו את צוות הסניף, המשימות וההזמנות.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><span className={label}>יצרן *</span><input required value={form.make} onChange={(e) => setField('make', e.target.value)} className={field} placeholder="לדוגמה: Kia" /></label>
            <label><span className={label}>דגם *</span><input required value={form.model} onChange={(e) => setField('model', e.target.value)} className={field} placeholder="לדוגמה: Picanto" /></label>
            <label><span className={label}>מספר רישוי *</span><input required dir="ltr" value={form.licensePlate} onChange={(e) => setField('licensePlate', e.target.value)} className={field} placeholder="12-345-67" /></label>
            <label><span className={label}>שנת ייצור *</span><input required type="number" min="1950" max={new Date().getFullYear() + 1} value={form.year} onChange={(e) => setField('year', e.target.value)} className={field} /></label>
            <label><span className={label}>מועד הטסט הבא *</span><input required type="date" value={form.testDueDate} onChange={(e) => setField('testDueDate', e.target.value)} className={field} /></label>
            <label><span className={label}>קילומטרים נוכחיים</span><input type="number" min="0" value={form.currentOdometerKm} onChange={(e) => setField('currentOdometerKm', e.target.value)} className={field} placeholder="לדוגמה: 45210" /></label>
            <label><span className={label}>צבע</span><input value={form.color} onChange={(e) => setField('color', e.target.value)} className={field} /></label>
            <label><span className={label}>קטגוריה</span><select value={form.category} onChange={(e) => setField('category', e.target.value)} className={field}>{CATEGORY_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label><span className={label}>סוג דלק</span><select value={form.fuelType} onChange={(e) => setField('fuelType', e.target.value)} className={field}>{FUEL_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label><span className={label}>תיבת הילוכים</span><select value={form.transmission} onChange={(e) => setField('transmission', e.target.value)} className={field}>{TRANSMISSION_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label><span className={label}>מספר מושבים</span><input type="number" min="1" value={form.seats} onChange={(e) => setField('seats', e.target.value)} className={field} /></label>
            <label><span className={label}>מספר דלתות</span><input type="number" min="1" value={form.doors} onChange={(e) => setField('doors', e.target.value)} className={field} /></label>
          </div>
          <div>
            <h3 className="mb-2 font-black text-[#0D2B2B]">תמחור</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label><span className={label}>מחיר ליום</span><input type="number" min="0" value={form.pricePerDay} onChange={(e) => setField('pricePerDay', e.target.value)} className={field} /></label>
              <label><span className={label}>מחיר לחודש</span><input type="number" min="0" value={form.pricePerMonth} onChange={(e) => setField('pricePerMonth', e.target.value)} className={field} /></label>
              <label><span className={label}>פיקדון</span><input type="number" min="0" value={form.depositAmount} onChange={(e) => setField('depositAmount', e.target.value)} className={field} /></label>
            </div>
          </div>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-gray-50 px-4 text-sm font-bold text-gray-700">
            <input type="checkbox" checked={form.available} onChange={(e) => setField('available', e.target.checked)} className="h-5 w-5 accent-[#2D5F5F]" />
            הרכב זמין להזמנות
          </label>
          {formError && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{formError}</p>}
        </form>
      </Sheet>

      <Sheet
        open={!!deleting}
        onClose={() => !saving && setDeleting(null)}
        title="מחיקת רכב"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeleting(null)} disabled={saving} className="min-h-12 flex-1 rounded-2xl bg-gray-100 text-sm font-bold text-gray-600">חזרה</button>
            <button type="button" onClick={deleteVehicle} disabled={saving} className="min-h-12 flex-[2] rounded-2xl bg-red-600 text-sm font-black text-white disabled:opacity-50">{saving ? 'מוחק…' : 'מחיקת הרכב'}</button>
          </div>
        }
      >
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-black">למחוק את {deleting ? carName(deleting) : 'הרכב'}?</p>
          <p className="mt-1">הפעולה סופית. רכב שיש לו היסטוריית הזמנות לא יימחק, כדי לשמור על המסמכים הקיימים.</p>
        </div>
      </Sheet>
    </div>
  );
}
