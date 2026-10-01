'use client';

import { useState } from 'react';
import { CalendarClock, Car, FileText, Hash, MapPin, MessageCircle, Navigation, Phone, StickyNote, Video, Wrench } from 'lucide-react';
import { serviceKindLabel, serviceReasonLabel, serviceTitle } from '@/lib/service-task';
import { taskCar } from './types';
import Sheet from '@/components/ui/Sheet';
import Avatar from '@/components/ui/Avatar';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { numericOrderReference } from '@/lib/order-reference';
import { dayLabel, taskLocation, taskWhen } from '@/lib/task-schedule';
import { useManager } from './ManagerData';

const STATUS: Record<string, { text: string; cls: string }> = {
  open: { text: 'פתוחה', cls: 'bg-amber-50 text-amber-800' },
  done: { text: 'בוצעה', cls: 'bg-green-50 text-green-700' },
  cancelled: { text: 'בוטלה', cls: 'bg-gray-100 text-gray-500' },
};

/** Everything about one task, and every change a manager can make to it. */
export default function TaskSheet() {
  const { openTaskId, closeTask, tasks, activeDrivers, driverName, patchTask, deleteTask, signedById, now } = useManager();
  const task = tasks.find((t) => t.id === openTaskId) ?? null;
  const [editing, setEditing] = useState<'when' | 'address' | null>(null);
  const [whenDraft, setWhenDraft] = useState({ day: '', time: '' });
  const [addressDraft, setAddressDraft] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setEditing(null);
    setConfirming(false);
    closeTask();
  };

  if (!task) return <Sheet open={false} onClose={close}>{null}</Sheet>;

  const { day, time } = taskWhen(task);
  const location = taskLocation(task);
  const service = task.type === 'service';
  const car = taskCar(task);
  const plate = bookingLicensePlate(car);
  const phone = task.booking?.customer_phone?.replace(/[^\d+]/g, '') ?? '';
  const waPhone = phone.startsWith('0') ? `972${phone.slice(1)}` : phone.replace('+', '');
  const doc = task.inspection?.status === 'signed' ? signedById.get(task.inspection.id) : undefined;
  const status = STATUS[task.status];
  const pickup = task.type === 'pickup';

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    return ok;
  };

  const saveWhen = () =>
    run(async () => {
      if (!whenDraft.day) return false;
      const scheduledAt = new Date(`${whenDraft.day}T${whenDraft.time || '12:00'}:00`).toISOString();
      const ok = await patchTask(task, { scheduledAt, scheduledTime: whenDraft.time }, 'המועד עודכן');
      if (ok) setEditing(null);
      return ok;
    });

  const saveAddress = () =>
    run(async () => {
      const ok = await patchTask(task, { location: addressDraft.trim() }, 'הכתובת עודכנה');
      if (ok) setEditing(null);
      return ok;
    });

  const quick = 'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-gray-50 text-xs font-black text-[#2D5F5F] transition hover:bg-[#eef6f6]';
  const row = 'flex items-start gap-3 py-3.5';
  const field = 'min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-base focus:border-[#2D5F5F] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10';
  const linkBtn = 'min-h-11 shrink-0 rounded-full px-4 text-sm font-black text-[#2D5F5F] hover:bg-[#eef6f6]';

  return (
    <Sheet
      open
      onClose={close}
      variant="drawer"
      title={
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${service ? 'bg-indigo-50 text-[#5B5BD6]' : pickup ? 'bg-orange-50 text-[#C24E17]' : 'bg-[#eef6f6] text-[#2D5F5F]'}`}>
              {service ? serviceKindLabel(task.service_kind) : pickup ? 'מסירה' : 'החזרה'}
            </span>
            {task.urgent && task.status === 'open' && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white">דחוף</span>}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${status.cls}`}>{status.text}</span>
            {task.inspection?.status === 'awaiting_signature' && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-800">ממתין לחתימה</span>}
          </div>
          <p className="truncate text-xl">{service ? serviceTitle(task.service_kind, task.service_place) : task.booking?.customer_name || 'ללא שם לקוח'}</p>
        </div>
      }
      footer={
        task.status === 'done' ? null : confirming ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-bold text-gray-700">{task.status === 'open' ? 'לבטל את המשימה? הנהג יקבל הודעה.' : 'למחוק לצמיתות?'}</p>
            <button
              disabled={busy}
              onClick={() => run(async () => {
                const ok = task.status === 'open' ? await patchTask(task, { status: 'cancelled' }, 'המשימה בוטלה') : await deleteTask(task);
                setConfirming(false);
                if (ok && task.status !== 'open') close();
                return ok;
              })}
              className="min-h-11 rounded-2xl bg-red-600 px-5 text-sm font-black text-white disabled:opacity-50"
            >
              כן
            </button>
            <button onClick={() => setConfirming(false)} className="min-h-11 rounded-2xl bg-gray-100 px-5 text-sm font-bold text-gray-600">לא</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="min-h-12 w-full rounded-2xl text-sm font-black text-red-600 hover:bg-red-50">
            {task.status === 'open' ? 'ביטול המשימה' : 'מחיקת המשימה'}
          </button>
        )
      }
    >
      {/* Quick actions */}
      <div className="mb-2 flex gap-2">
        {phone && (
          <a href={`tel:${phone}`} className={quick}>
            <Phone className="h-5 w-5" aria-hidden="true" />
            התקשר
          </a>
        )}
        {phone && (
          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className={quick}>
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            וואטסאפ
          </a>
        )}
        {location && (
          <a href={`https://waze.com/ul?q=${encodeURIComponent(location)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className={quick}>
            <Navigation className="h-5 w-5" aria-hidden="true" />
            ניווט
          </a>
        )}
        {doc?.pdfUrl && (
          <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" className={quick}>
            <FileText className="h-5 w-5" aria-hidden="true" />
            טופס חתום
          </a>
        )}
        {doc?.videoUrl && (
          <a href={doc.videoUrl} target="_blank" rel="noopener noreferrer" className={quick}>
            <Video className="h-5 w-5" aria-hidden="true" />
            סרטון
          </a>
        )}
      </div>

      {/* Details */}
      <div className="divide-y divide-gray-100">
        {service && (
          <div className={row}>
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-400">סיבה</p>
              <p className="text-base font-bold text-[#0D2B2B]">{serviceReasonLabel(task.service_reason) || '—'}</p>
              {task.notes && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{task.notes}</p>}
            </div>
          </div>
        )}
        <div className={row}>
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-400">מועד</p>
            {editing === 'when' ? (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={whenDraft.day} onChange={(e) => setWhenDraft({ ...whenDraft, day: e.target.value })} className={field} aria-label="תאריך" />
                  <input type="time" value={whenDraft.time} onChange={(e) => setWhenDraft({ ...whenDraft, time: e.target.value })} className={field} aria-label="שעה" />
                </div>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={saveWhen} className="min-h-11 flex-1 rounded-2xl bg-[#2D5F5F] text-sm font-black text-white disabled:opacity-50">שמירה</button>
                  <button onClick={() => setEditing(null)} className="min-h-11 rounded-2xl bg-gray-100 px-5 text-sm font-bold text-gray-600">ביטול</button>
                </div>
              </div>
            ) : (
              <p className="text-base font-bold text-[#0D2B2B]">{dayLabel(day, now)} · <span dir="ltr">{time ?? 'ללא שעה'}</span></p>
            )}
          </div>
          {editing !== 'when' && task.status === 'open' && (
            <button onClick={() => { setWhenDraft({ day, time: time ?? '' }); setEditing('when'); }} className={linkBtn}>שינוי</button>
          )}
        </div>

        <div className={row}>
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-400">כתובת</p>
            {editing === 'address' ? (
              <div className="mt-2 space-y-2">
                <input value={addressDraft} onChange={(e) => setAddressDraft(e.target.value)} placeholder="רחוב, מספר, עיר" autoFocus className={field} />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={saveAddress} className="min-h-11 flex-1 rounded-2xl bg-[#2D5F5F] text-sm font-black text-white disabled:opacity-50">שמירה</button>
                  <button onClick={() => setEditing(null)} className="min-h-11 rounded-2xl bg-gray-100 px-5 text-sm font-bold text-gray-600">ביטול</button>
                </div>
              </div>
            ) : (
              <p className={`text-base font-bold ${location ? 'text-[#0D2B2B]' : 'text-gray-300'}`}>{location || 'לא צוינה'}</p>
            )}
          </div>
          {editing !== 'address' && task.status !== 'cancelled' && (
            <button onClick={() => { setAddressDraft(location); setEditing('address'); }} className={linkBtn}>{location ? 'עריכה' : 'הוספה'}</button>
          )}
        </div>

        <div className={row}>
          <Car className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-400">רכב</p>
            <p className="flex flex-wrap gap-x-2 text-base font-bold text-[#0D2B2B]">
              <span>{bookingVehicleName(car)}</span>
              {plate !== '—' && <span className="font-black text-gray-600" dir="ltr">{plate}</span>}
            </p>
          </div>
        </div>

        {task.booking?.id && (
          <div className={row}>
            <Hash className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-gray-400">הזמנה</p>
              <p className="text-base font-bold text-[#0D2B2B]" dir="ltr">#{numericOrderReference(task.booking.id)}</p>
            </div>
          </div>
        )}

        {task.notes && !service && (
          <div className={row}>
            <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-gray-400">הערה לנהג</p>
              <p className="text-base text-[#0D2B2B]">{task.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Driver */}
      {task.status !== 'cancelled' && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-black text-[#0D2B2B]">נהג</p>
          <div className="flex flex-wrap gap-2">
            {activeDrivers.map((d) => {
              const selected = task.assigned_driver_id === d.id;
              return (
                <button
                  key={d.id}
                  disabled={busy || selected}
                  onClick={() => run(() => patchTask(task, { assignedDriverId: d.id }, `המשימה הועברה ל${d.name}`))}
                  className={`flex min-h-11 items-center gap-2 rounded-full py-1 pe-4 ps-1 text-sm font-bold transition ${
                    selected ? 'bg-[#2D5F5F] text-white' : 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-[#eef6f6]'
                  }`}
                >
                  <Avatar name={d.name} size="sm" />
                  {d.name}
                </button>
              );
            })}
            {task.assigned_driver_id && (
              <button
                disabled={busy}
                onClick={() => run(() => patchTask(task, { assignedDriverId: null }, 'הנהג הוסר מהמשימה'))}
                className="min-h-11 rounded-full px-4 text-sm font-bold text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50"
              >
                ללא נהג
              </button>
            )}
          </div>
          {!task.assigned_driver_id && <p className="mt-2 text-sm text-red-600">עוד לא שויך נהג למשימה הזו.</p>}
          {task.assigned_driver_id && !activeDrivers.some((d) => d.id === task.assigned_driver_id) && (
            <p className="mt-2 text-sm text-gray-500">משויך ל{driverName(task.assigned_driver_id) || 'נהג לא פעיל'}.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
