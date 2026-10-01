'use client';

import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Zap } from 'lucide-react';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { dayLabel, israelClock, taskLocation, taskWhen } from '@/lib/task-schedule';
import Avatar from '@/components/ui/Avatar';
import { useManager } from './ManagerData';
import { taskCar, type ManagerTask } from './types';
import { serviceKindLabel, serviceReasonLabel, serviceTitle } from '@/lib/service-task';

/** One task as a tappable row: time · customer, car, address · driver and state. Opens the task sheet. */
export default function TaskRow({ task, showDay = false }: { task: ManagerTask; showDay?: boolean }) {
  const { openTask, driverName, now, today } = useManager();
  const { day, time } = taskWhen(task);
  const car = taskCar(task);
  const plate = bookingLicensePlate(car);
  const service = task.type === 'service';
  const location = taskLocation(task);
  const driver = driverName(task.assigned_driver_id);
  const late = task.status === 'open' && day && (day < today || (day === today && time !== null && time < israelClock(now)));
  const pickup = task.type === 'pickup';

  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      className={`group flex w-full items-center gap-3 px-4 py-3.5 text-start transition hover:bg-[#f7fbfb] active:bg-[#eef6f6] ${task.status === 'cancelled' ? 'opacity-50' : ''}`}
    >
      <div className="w-14 shrink-0 text-center">
        {showDay && <p className="text-[11px] font-bold text-gray-400">{dayLabel(day, now)}</p>}
        <p className={`text-lg font-black tabular-nums leading-tight ${late ? 'text-red-600' : 'text-[#0D2B2B]'}`} dir="ltr">{time ?? '—'}</p>
        <p className={`mt-0.5 text-xs font-black ${service ? 'text-[#5B5BD6]' : pickup ? 'text-[#E8743B]' : 'text-[#2D5F5F]'}`}>
          {service ? serviceKindLabel(task.service_kind) : pickup ? 'מסירה' : 'החזרה'}
        </p>
      </div>

      <div className="min-w-0 flex-1 border-s border-gray-100 ps-3">
        {task.urgent && task.status === 'open' && (
          <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
            <Zap className="h-3 w-3" aria-hidden="true" />
            דחוף
          </span>
        )}
        <p className={`truncate text-base font-black ${task.status === 'done' ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#0D2B2B]'}`}>
          {service ? serviceTitle(task.service_kind, task.service_place) : task.booking?.customer_name || 'ללא שם לקוח'}
        </p>
        <p className="flex min-w-0 gap-1 text-sm text-gray-500">
          {service && <><span className="shrink-0 font-bold text-[#5B5BD6]">{serviceReasonLabel(task.service_reason)}</span><span className="shrink-0" aria-hidden="true">·</span></>}
          <span className="truncate">{bookingVehicleName(car)}</span>
          {plate !== '—' && <><span className="shrink-0" aria-hidden="true">·</span><span className="shrink-0 font-bold text-gray-700" dir="ltr">{plate}</span></>}
        </p>
        <p className={`truncate text-sm ${location ? 'text-gray-400' : 'text-gray-300'}`}>{location || 'ללא כתובת'}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {driver ? (
          <span className="flex items-center gap-1.5">
            <span className="hidden text-sm font-bold text-gray-600 sm:inline">{driver}</span>
            <Avatar name={driver} size="sm" />
          </span>
        ) : task.status === 'open' ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-600">ללא נהג</span>
        ) : null}
        {task.status === 'cancelled' ? (
          <span className="text-xs font-bold text-gray-400">בוטלה</span>
        ) : task.inspection?.status === 'signed' ? (
          <span className="flex items-center gap-1 text-xs font-black text-green-700"><FileCheck2 className="h-4 w-4" aria-hidden="true" />נחתם</span>
        ) : task.inspection?.status === 'awaiting_signature' ? (
          <span className="flex items-center gap-1 text-xs font-black text-amber-700"><Clock3 className="h-4 w-4" aria-hidden="true" />לחתימה</span>
        ) : task.status === 'done' ? (
          <span className="flex items-center gap-1 text-xs font-black text-green-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />בוצע</span>
        ) : late ? (
          <span className="flex items-center gap-1 text-xs font-black text-red-600"><AlertCircle className="h-4 w-4" aria-hidden="true" />באיחור</span>
        ) : null}
      </div>
    </button>
  );
}

/** White rounded list that holds TaskRows with hairline dividers. */
export function TaskList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">{children}</div>;
}
