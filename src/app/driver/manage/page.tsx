'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight } from 'lucide-react';
import { fetcher, useApiList } from '@/lib/swr';
import DriverTaskForm from '@/components/admin/DriverTaskForm';
import { bookingLicensePlate, bookingVehicleName, type BookingVehicleSource } from '@/lib/booking-vehicle';

interface DriverOption {
  id: string;
  name: string;
}

interface Task {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  notes: string | null;
  assigned_driver_id: string | null;
  booking: (BookingVehicleSource & {
    customer_name: string;
    customer_phone?: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_location: string;
    dropoff_location: string;
  }) | null;
  inspection: { id: string; status: 'awaiting_signature' | 'signed' } | null;
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Branch managers (no admin access): assign tasks to drivers and follow
 * them — the same task form and actions as the admin "נהגים" page, on the
 * phone-friendly driver app. Reached from "My day" for drivers whose role
 * is 'manager' (set in the admin).
 */
export default function BranchManagerPage() {
  const { data: me, isLoading: meLoading } = useSWR<{ role: string; canManage: boolean }>('/api/driver/me', fetcher);
  const canManage = Boolean(me?.canManage);

  const { items: drivers } = useApiList<DriverOption>(canManage ? '/api/driver/manage/drivers' : null);
  const { items: tasks, mutate: mutateTasks, isLoading: tasksLoading } = useApiList<Task>(canManage ? '/api/driver/manage/tasks' : null);
  const [formDriver, setFormDriver] = useState<DriverOption | null>(null);

  const driverName = useMemo(() => new Map(drivers.map((d) => [d.id, d.name])), [drivers]);

  const openTasks = useMemo(() => {
    const dateOf = (t: Task) => new Date((t.type === 'pickup' ? t.booking?.pickup_date : t.booking?.dropoff_date) ?? 0).getTime();
    return tasks.filter((t) => t.status === 'open').sort((a, b) => dateOf(a) - dateOf(b));
  }, [tasks]);

  const patchTask = async (task: Task, body: Record<string, unknown>, failText: string) => {
    const res = await fetch(`/api/driver/manage/tasks/${encodeURIComponent(task.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      alert(failText);
      return;
    }
    mutateTasks();
  };

  const editAddress = (task: Task, current: string) => {
    const next = window.prompt('כתובת ללקוח (לוויז). השאר ריק כדי למחוק:', current === 'לא צוין' ? '' : current);
    if (next === null) return;
    void patchTask(task, { location: next }, 'עדכון הכתובת נכשל');
  };

  const cancelTask = (task: Task) => {
    if (!window.confirm('לבטל את המשימה?')) return;
    void patchTask(task, { status: 'cancelled' }, 'הביטול נכשל');
  };

  if (meLoading) return <div className="min-h-screen" aria-busy="true" />;

  if (!canManage) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir="rtl">
        <h1 className="text-xl font-black text-gray-900 mb-2">אין הרשאה</h1>
        <p className="text-gray-600 mb-6">הדף הזה מיועד למנהלי סניפים. פנו למשרד.</p>
        <Link href="/driver" className="font-bold text-[#2D5F5F] underline">חזרה</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10" dir="rtl">
      <div className="sticky top-0 z-10 bg-[#F5F0E8]/95 backdrop-blur px-4 pt-6 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link href="/driver" aria-label="חזרה" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-black text-gray-900">משימות לנהגים</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6 max-w-2xl mx-auto">
        {/* New task */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="font-black text-gray-900 mb-3">משימה חדשה — בחר נהג</h2>
          <div className="grid grid-cols-2 gap-2">
            {drivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setFormDriver(d)}
                className={`min-h-12 rounded-xl border-2 font-black text-sm ${
                  formDriver?.id === d.id ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]' : 'border-gray-200 text-gray-700'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
          {formDriver && (
            <div className="mt-4">
              <DriverTaskForm
                key={formDriver.id}
                driver={formDriver}
                tasksApi="/api/driver/manage/tasks"
                bookingsApi="/api/driver/manage/bookings"
                onCancel={() => setFormDriver(null)}
                onCreated={() => {
                  setFormDriver(null);
                  mutateTasks();
                }}
              />
            </div>
          )}
        </section>

        {/* Open tasks */}
        <section>
          <h2 className="text-sm font-black text-gray-500 mb-2">משימות פתוחות ({openTasks.length})</h2>
          {tasksLoading && <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />}
          {!tasksLoading && openTasks.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">אין משימות פתוחות</p>}
          <div className="space-y-3">
            {openTasks.map((task) => {
              const scheduledAt = task.type === 'pickup' ? task.booking?.pickup_date : task.booking?.dropoff_date;
              const location = (task.type === 'pickup' ? task.booking?.pickup_location : task.booking?.dropoff_location) ?? '';
              const hasAddress = Boolean(location) && location !== 'לא צוין';
              const plate = bookingLicensePlate(task.booking);
              return (
                <div key={task.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 truncate">{task.booking?.customer_name ?? 'ללא שם לקוח'}</p>
                      <p className="text-xs text-gray-500">
                        {task.type === 'pickup' ? 'מסירה' : 'החזרה'} · {formatDateTime(scheduledAt)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {bookingVehicleName(task.booking)}
                        {plate !== '—' ? ` · ${plate}` : ''}
                      </p>
                    </div>
                    {task.inspection?.status === 'awaiting_signature' && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">ממתין לחתימה</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    {hasAddress ? location : 'ללא כתובת'}{' '}
                    <button onClick={() => editAddress(task, location)} className="font-bold text-[#2D5F5F] underline">
                      {hasAddress ? 'ערוך' : 'הוסף כתובת'}
                    </button>
                  </p>
                  {task.notes && <p className="mt-1 text-xs text-gray-500">הערה: {task.notes}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={task.assigned_driver_id ?? ''}
                      onChange={(e) => void patchTask(task, { assignedDriverId: e.target.value || null }, 'שיוך הנהג נכשל')}
                      aria-label="נהג"
                      className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm"
                    >
                      <option value="">ללא שיוך</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {!task.assigned_driver_id && <span className="text-xs font-bold text-red-500">לא משויך</span>}
                    {task.assigned_driver_id && !driverName.has(task.assigned_driver_id) && (
                      <span className="text-xs text-gray-400">נהג לא פעיל</span>
                    )}
                    <button onClick={() => cancelTask(task)} className="ms-auto text-xs font-bold text-red-500">ביטול משימה</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
