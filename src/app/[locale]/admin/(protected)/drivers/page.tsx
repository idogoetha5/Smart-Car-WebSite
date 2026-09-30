'use client';

import { useMemo, useState } from 'react';
import { ClipboardPlus, KeyRound, RefreshCw, UserPlus } from 'lucide-react';
import DriverTaskForm from '@/components/admin/DriverTaskForm';
import { bookingLicensePlate, bookingVehicleName, type BookingVehicleSource } from '@/lib/booking-vehicle';
import { useApiList } from '@/lib/swr';

interface Driver {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

interface Task {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  notes: string | null;
  assigned_driver_id: string | null;
  booking: (BookingVehicleSource & {
    customer_name: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_location: string;
    dropoff_location: string;
  }) | null;
  inspection: { id: string; status: 'awaiting_signature' | 'signed' } | null;
}

const STATUS_LABEL: Record<Task['status'], string> = { open: 'פתוחה', done: 'בוצעה', cancelled: 'בוטלה' };
const STATUS_CLASS: Record<Task['status'], string> = {
  open: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AdminDriversPage() {
  const { items: drivers, isLoading, isValidating, mutate } = useApiList<Driver>('/api/admin/drivers');
  const { items: tasks, isLoading: tasksLoading, isValidating: tasksValidating, mutate: mutateTasks } = useApiList<Task>('/api/admin/tasks');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const activeDrivers = useMemo(() => drivers.filter((driver) => driver.active), [drivers]);

  const visibleTasks = useMemo(() => {
    if (!filterDate) return tasks;
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
    return tasks.filter((task) => {
      const value = task.type === 'pickup' ? task.booking?.pickup_date : task.booking?.dropoff_date;
      return value ? formatter.format(new Date(value)) === filterDate : false;
    });
  }, [tasks, filterDate]);

  const tasksByDriver = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    visibleTasks.forEach((task) => {
      const key = task.assigned_driver_id ?? 'unassigned';
      const group = grouped.get(key);
      if (group) group.push(task);
      else grouped.set(key, [task]);
    });
    return grouped;
  }, [visibleTasks]);

  const createDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('הקוד חייב להיות 4 ספרות');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || 'יצירת הנהג נכשלה');
        return;
      }
      setName('');
      setPin('');
      mutate((current) => (current ? [json.data, ...current] : [json.data]), { revalidate: false });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (driver: Driver) => {
    const response = await fetch(`/api/admin/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !driver.active }),
    });
    if (!response.ok) { alert('העדכון נכשל'); return; }
    mutate((current) => (current ?? []).map((item) => (item.id === driver.id ? { ...item, active: !driver.active } : item)), { revalidate: false });
  };

  const resetPin = async (driver: Driver) => {
    const newPin = window.prompt(`קוד חדש עבור ${driver.name} (4 ספרות)`);
    if (!newPin) return;
    if (!/^\d{4}$/.test(newPin)) { alert('הקוד חייב להיות 4 ספרות'); return; }
    const response = await fetch(`/api/admin/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    });
    if (!response.ok) { alert('איפוס הקוד נכשל'); return; }
    alert('הקוד עודכן');
  };

  const reassign = async (task: Task, driverId: string) => {
    const response = await fetch(`/api/admin/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedDriverId: driverId || null }),
    });
    if (!response.ok) { alert('שיוך הנהג נכשל'); return; }
    mutateTasks();
  };

  const cancelTask = async (task: Task) => {
    if (!window.confirm('לבטל את המשימה?')) return;
    const response = await fetch(`/api/admin/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!response.ok) { alert('הביטול נכשל'); return; }
    mutateTasks();
  };

  const renderTask = (task: Task) => {
    const scheduledAt = task.type === 'pickup' ? task.booking?.pickup_date : task.booking?.dropoff_date;
    const location = task.type === 'pickup' ? task.booking?.pickup_location : task.booking?.dropoff_location;
    const plate = bookingLicensePlate(task.booking);
    return (
      <div key={task.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-bold text-gray-900">{task.booking?.customer_name ?? 'ללא שם לקוח'}</p>
            <p className="mt-0.5 text-xs text-gray-500">{task.type === 'pickup' ? 'קבלה' : 'החזרה'} · {formatDateTime(scheduledAt)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
        </div>
        <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
          <span>{bookingVehicleName(task.booking)}{plate !== '—' ? ` · ${plate}` : ''}</span>
          <span>{location || 'לא צוינה כתובת'}</span>
        </div>
        {task.notes && <p className="mt-2 text-xs text-gray-500">הערה: {task.notes}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={task.assigned_driver_id ?? ''} onChange={(event) => reassign(task, event.target.value)} aria-label="שינוי נהג למשימה" className="min-h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs">
            <option value="">ללא שיוך</option>
            {activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
          </select>
          {task.inspection?.status === 'signed' && <span className="text-xs font-bold text-green-600">✓ נחתם</span>}
          {task.inspection?.status === 'awaiting_signature' && <span className="text-xs font-bold text-amber-600">ממתין לחתימה</span>}
          {task.status === 'open' && <button onClick={() => cancelTask(task)} className="text-xs font-bold text-red-500 hover:text-red-700">ביטול משימה</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8" dir="rtl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-900">נהגים</h1>
          <p className="mt-1 text-gray-500">{drivers.length} נהגים · ניהול והקצאת משימות</p>
        </div>
        <button onClick={() => { mutate(); mutateTasks(); }} disabled={isValidating || tasksValidating} className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${isValidating || tasksValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
          רענון
        </button>
      </div>

      <form onSubmit={createDriver} className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-500">שם הנהג</label>
          <input value={name} onChange={(event) => setName(event.target.value)} required className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-500">קוד (4 ספרות)</label>
          <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} required className="min-h-11 w-32 rounded-xl border border-gray-200 px-3 text-sm" dir="ltr" />
        </div>
        <button type="submit" disabled={creating} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#E8743B] px-4 text-sm font-black text-white hover:bg-[#d4632a] disabled:opacity-50">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          הוספת נהג
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900">משימות לפי נהג</h2>
          <p className="text-sm text-gray-500">מקצים ורואים את המשימות בתוך הנהג המתאים</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
          תאריך
          <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 font-normal" />
        </label>
      </div>

      {isLoading || tasksLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      ) : (
        <div className="space-y-4">
          {drivers.map((driver) => {
            const driverTasks = tasksByDriver.get(driver.id) ?? [];
            const openCount = driverTasks.filter((task) => task.status === 'open').length;
            return (
              <section key={driver.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-gray-900">{driver.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${driver.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{driver.active ? 'פעיל' : 'מושבת'}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{openCount} משימות פתוחות</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{driverTasks.length} משימות בתצוגה</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {driver.active && (
                      <button onClick={() => setAssigningDriverId(assigningDriverId === driver.id ? null : driver.id)} className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[#E8743B] px-3 text-xs font-black text-white hover:bg-[#d4632a]">
                        <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
                        הקצאת משימה
                      </button>
                    )}
                    <button onClick={() => toggleActive(driver)} className="min-h-10 rounded-lg bg-gray-50 px-3 text-xs font-bold text-gray-700 hover:bg-gray-100">{driver.active ? 'השבתה' : 'הפעלה'}</button>
                    <button onClick={() => resetPin(driver)} className="flex min-h-10 items-center gap-1 rounded-lg bg-[#eef6f6] px-3 text-xs font-bold text-[#2D5F5F] hover:bg-[#d9ecec]"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" />איפוס קוד</button>
                  </div>
                </div>

                {assigningDriverId === driver.id && <DriverTaskForm driver={driver} onCancel={() => setAssigningDriverId(null)} onCreated={() => { setAssigningDriverId(null); mutateTasks(); }} />}

                <div className="space-y-2 border-t border-gray-100 p-4 sm:p-5">
                  {driverTasks.map(renderTask)}
                  {driverTasks.length === 0 && <p className="py-4 text-center text-sm text-gray-400">אין משימות לנהג בתאריך שנבחר</p>}
                </div>
              </section>
            );
          })}

          {(tasksByDriver.get('unassigned') ?? []).length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="border-b border-amber-100 bg-amber-50 p-4 sm:p-5">
                <h3 className="text-lg font-black text-amber-900">משימות שעדיין לא שויכו</h3>
                <p className="text-sm text-amber-700">בחרו נהג בכל משימה כדי להעביר אותה אליו</p>
              </div>
              <div className="space-y-2 p-4 sm:p-5">{(tasksByDriver.get('unassigned') ?? []).map(renderTask)}</div>
            </section>
          )}

          {drivers.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-gray-400">אין נהגים עדיין</div>}
        </div>
      )}
    </div>
  );
}
