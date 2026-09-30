'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ClipboardPlus,
  FileText,
  KeyRound,
  Phone,
  RefreshCw,
  Search,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import DriverTaskForm from '@/components/admin/DriverTaskForm';
import { bookingLicensePlate, bookingVehicleName, type BookingVehicleSource } from '@/lib/booking-vehicle';
import { numericOrderReference } from '@/lib/order-reference';
import { useApiList } from '@/lib/swr';

interface Driver {
  id: string;
  name: string;
  active: boolean;
  role?: 'driver' | 'manager';
  created_at: string;
}

interface SignedJob {
  id: string;
  type: 'pickup' | 'return';
  signedAt: string | null;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  address: string;
  driverName: string;
  damageCount: number;
  pdfUrl: string | null;
  videoUrl: string | null;
}

interface Task {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  notes: string | null;
  assigned_driver_id: string | null;
  booking: (BookingVehicleSource & {
    id?: string;
    customer_name: string;
    customer_phone?: string | null;
    pickup_date: string;
    dropoff_date: string;
    pickup_time?: string | null;
    return_time?: string | null;
    pickup_location: string;
    dropoff_location: string;
  }) | null;
  inspection: { id: string; status: 'awaiting_signature' | 'signed' } | null;
}

type View = 'board' | 'drivers' | 'signed';

const STATUS_LABEL: Record<Task['status'], string> = { open: 'פתוחה', done: 'בוצעה', cancelled: 'בוטלה' };
const STATUS_CLASS: Record<Task['status'], string> = {
  open: 'bg-amber-100 text-amber-800',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const REFRESH_MS = 60_000;
/** Items shown in 'דורש טיפול' before 'הצג הכל' — keeps the day's board in view on a phone. */
const ATTENTION_PREVIEW = 2;

const israelDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
const israelClockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });

/** YYYY-MM-DD in Israel, `offsetDays` from `now`. */
function israelDate(now: number, offsetDays = 0): string {
  return israelDayFormatter.format(new Date(now + offsetDays * 86_400_000));
}

function dayLabel(day: string, now: number): string {
  if (day === israelDate(now)) return 'היום';
  if (day === israelDate(now, 1)) return 'מחר';
  if (day === israelDate(now, -1)) return 'אתמול';
  const [y, m, d] = day.split('-');
  return y && m && d ? `${Number(d)}.${Number(m)}` : '—';
}

/** Day (Israel) and time the task is scheduled for — the time comes from the booking's pickup/return time. */
function taskWhen(task: Task): { day: string; time: string | null } {
  const date = task.type === 'pickup' ? task.booking?.pickup_date : task.booking?.dropoff_date;
  const rawTime = task.type === 'pickup' ? task.booking?.pickup_time : task.booking?.return_time;
  const day = date && !Number.isNaN(new Date(date).getTime()) ? israelDayFormatter.format(new Date(date)) : '';
  return { day, time: rawTime ? rawTime.slice(0, 5) : null };
}

function taskLocation(task: Task): string {
  const location = task.type === 'pickup' ? task.booking?.pickup_location : task.booking?.dropoff_location;
  return location && location !== 'לא צוין' ? location : '';
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

const byWhen = (a: Task, b: Task) => {
  const wa = taskWhen(a);
  const wb = taskWhen(b);
  return wa.day.localeCompare(wb.day) || (wa.time ?? '99:99').localeCompare(wb.time ?? '99:99');
};

/**
 * Drivers + their tasks. Used by the admin "נהגים" page (mode 'admin': also
 * the managers section) and by the branch-manager app /driver/manage (mode
 * 'manager'). Three views: the day's board across all drivers (default),
 * tasks per driver, and signed jobs — with one search and a "needs
 * attention" strip above them. Refreshes itself every minute.
 */
export default function DriversBoard({ mode }: { mode: 'admin' | 'manager' }) {
  const isAdmin = mode === 'admin';
  const tasksApi = isAdmin ? '/api/admin/tasks' : '/api/driver/manage/tasks';
  const peopleApi = isAdmin ? '/api/admin/drivers' : '/api/driver/manage/drivers';
  const live = { refreshInterval: REFRESH_MS, revalidateOnFocus: true };
  const { items: people, isLoading, isValidating, mutate } = useApiList<Driver>(peopleApi);
  const { items: tasks, isLoading: tasksLoading, isValidating: tasksValidating, mutate: mutateTasks } = useApiList<Task>(tasksApi, live);
  const { items: signedJobs, mutate: mutateSigned } = useApiList<SignedJob>(isAdmin ? '/api/admin/inspections/signed' : '/api/driver/manage/inspections', live);

  const drivers = useMemo(() => people.filter((person) => person.role !== 'manager'), [people]);
  const managers = useMemo(() => people.filter((person) => person.role === 'manager'), [people]);
  const activeDrivers = useMemo(() => drivers.filter((driver) => driver.active), [drivers]);
  const driverName = useMemo(() => new Map(drivers.map((d) => [d.id, d.name])), [drivers]);
  const signedById = useMemo(() => new Map(signedJobs.map((job) => [job.id, job])), [signedJobs]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const today = israelDate(now);
  const tomorrow = israelDate(now, 1);

  const [view, setView] = useState<View>('board');
  const [boardDate, setBoardDate] = useState(() => israelDate(Date.now()));
  const [filterDate, setFilterDate] = useState('');
  const [query, setQuery] = useState('');
  const [attentionOpen, setAttentionOpen] = useState(true);
  const [attentionAll, setAttentionAll] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPin, setNewDriverPin] = useState('');
  const [addingDriver, setAddingDriver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [taskSearch, setTaskSearch] = useState<Record<string, string>>({});
  const [editingAddress, setEditingAddress] = useState<{ id: string; value: string } | null>(null);
  const [editingWhen, setEditingWhen] = useState<{ id: string; day: string; time: string } | null>(null);

  const toggleExpanded = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const refreshAll = () => { mutate(); mutateTasks(); mutateSigned(); };

  const liveTasks = useMemo(() => tasks.filter((t) => t.status !== 'cancelled'), [tasks]);

  // ---- 3. Needs attention -------------------------------------------------
  const attention = useMemo(() => {
    const clock = israelClockFormatter.format(new Date(now));
    const items: Array<{ task: Task; reason: string }> = [];
    const seen = new Set<string>();
    const add = (task: Task, reason: string) => {
      if (seen.has(task.id)) return;
      seen.add(task.id);
      items.push({ task, reason });
    };
    for (const task of [...liveTasks].sort(byWhen)) {
      const { day, time } = taskWhen(task);
      if (task.status === 'open' && day && (day < today || (day === today && time !== null && time < clock))) add(task, 'עבר המועד ולא בוצעה');
    }
    for (const task of [...liveTasks].sort(byWhen)) {
      const { day } = taskWhen(task);
      if (task.status === 'open' && !task.assigned_driver_id && day && day <= tomorrow) add(task, day === tomorrow ? 'מחר — בלי נהג' : 'בלי נהג');
    }
    for (const task of liveTasks) {
      if (task.inspection?.status === 'awaiting_signature') add(task, 'ממתין לחתימת הלקוח');
    }
    const damageJobs = signedJobs.filter(
      (job) => job.type === 'return' && job.damageCount > 0 && job.signedAt && now - new Date(job.signedAt).getTime() < 3 * 86_400_000
    );
    return { items, damageJobs };
  }, [liveTasks, signedJobs, now, today, tomorrow]);
  const attentionCount = attention.items.length + attention.damageJobs.length;

  // ---- 4. One search over everything --------------------------------------
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const digits = needle.replace(/\D/g, '');
    return tasks
      .filter((t) => {
        const b = t.booking;
        if (!b) return false;
        const plate = bookingLicensePlate(b).replace(/\D/g, '');
        const phone = (b.customer_phone ?? '').replace(/\D/g, '');
        return (
          (b.customer_name ?? '').toLowerCase().includes(needle) ||
          taskLocation(t).toLowerCase().includes(needle) ||
          bookingVehicleName(b).toLowerCase().includes(needle) ||
          (digits.length >= 3 && (plate.includes(digits) || phone.includes(digits))) ||
          (b.id !== undefined && numericOrderReference(b.id) === query.trim())
        );
      })
      .sort((a, b) => byWhen(b, a))
      .slice(0, 60);
  }, [tasks, query]);

  // ---- 1. Day board -------------------------------------------------------
  const boardTasks = useMemo(
    () => liveTasks.filter((t) => taskWhen(t).day === boardDate).sort(byWhen),
    [liveTasks, boardDate]
  );

  // ---- per driver -----------------------------------------------------------
  const tasksByDriver = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    tasks
      .filter((task) => !filterDate || taskWhen(task).day === filterDate)
      .forEach((task) => {
        const key = task.assigned_driver_id ?? 'unassigned';
        const group = grouped.get(key);
        if (group) group.push(task);
        else grouped.set(key, [task]);
      });
    return grouped;
  }, [tasks, filterDate]);

  /** 6. Load per driver: tasks today / tomorrow. */
  const loadByDriver = useMemo(() => {
    const load = new Map<string, { today: number; tomorrow: number }>();
    for (const task of liveTasks) {
      if (!task.assigned_driver_id) continue;
      const { day } = taskWhen(task);
      const entry = load.get(task.assigned_driver_id) ?? { today: 0, tomorrow: 0 };
      if (day === today) entry.today += 1;
      if (day === tomorrow) entry.tomorrow += 1;
      load.set(task.assigned_driver_id, entry);
    }
    return load;
  }, [liveTasks, today, tomorrow]);

  const prepareTasks = (list: Task[], key: string) => {
    const needle = (taskSearch[key] ?? '').trim().toLowerCase();
    const order = { open: 0, done: 1, cancelled: 2 } as const;
    return list
      .filter((t) => !needle || (t.booking?.customer_name ?? '').toLowerCase().includes(needle) || taskLocation(t).toLowerCase().includes(needle))
      .sort((a, b) => order[a.status] - order[b.status] || byWhen(a, b));
  };

  // ---- actions --------------------------------------------------------------
  const patchTask = async (task: Task, body: Record<string, unknown>, failText: string) => {
    const response = await fetch(`${tasksApi}/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      alert(json?.error || failText);
      return false;
    }
    mutateTasks();
    return true;
  };

  const createPerson = async (role: 'driver' | 'manager') => {
    const name = role === 'manager' ? managerName : newDriverName;
    const pin = role === 'manager' ? managerPin : newDriverPin;
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('הקוד חייב להיות 4 ספרות');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(peopleApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin, role }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || 'יצירת הנהג נכשלה');
        return;
      }
      if (role === 'manager') {
        setManagerName('');
        setManagerPin('');
      } else {
        setNewDriverName('');
        setNewDriverPin('');
        setAddingDriver(false);
      }
      mutate((current) => (current ? [json.data, ...current] : [json.data]), { revalidate: false });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (driver: Driver) => {
    const response = await fetch(`${peopleApi}/${driver.id}`, {
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
    const response = await fetch(`${peopleApi}/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    });
    if (!response.ok) { alert('איפוס הקוד נכשל'); return; }
    alert('הקוד עודכן');
  };

  const deleteTask = async (task: Task) => {
    if (!window.confirm('למחוק את המשימה לצמיתות?')) return;
    const response = await fetch(`${tasksApi}/${task.id}`, { method: 'DELETE' });
    if (!response.ok) { alert('המחיקה נכשלה'); return; }
    mutateTasks((current) => (current ?? []).filter((item) => item.id !== task.id), { revalidate: false });
  };

  const cancelTask = async (task: Task) => {
    if (!window.confirm('לבטל את המשימה?')) return;
    await patchTask(task, { status: 'cancelled' }, 'הביטול נכשל');
  };

  const saveWhen = async (task: Task, day: string, time: string) => {
    if (!day) return;
    // No time → midday, so the task stays on the chosen day.
    const scheduledAt = new Date(`${day}T${time || '12:00'}:00`).toISOString();
    if (await patchTask(task, { scheduledAt, scheduledTime: time }, 'עדכון המועד נכשל')) setEditingWhen(null);
  };

  // ---- task card ------------------------------------------------------------
  const smallBtn = 'min-h-11 rounded-xl px-3 text-sm font-bold';
  const renderTask = (task: Task, reason?: string) => {
    const { day, time } = taskWhen(task);
    const location = taskLocation(task);
    const plate = bookingLicensePlate(task.booking);
    const phone = task.booking?.customer_phone?.replace(/[^\d+]/g, '');
    const doc = task.inspection?.status === 'signed' ? signedById.get(task.inspection.id) : undefined;
    const editingThisAddress = editingAddress?.id === task.id;
    const editingThisWhen = editingWhen?.id === task.id;
    return (
      <div key={`${reason ?? ''}${task.id}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {reason && (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {reason}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#0D2B2B]">{task.booking?.customer_name ?? 'ללא שם לקוח'}</p>
            <p className="mt-0.5 text-sm text-gray-600">
              <span className={`font-black ${task.type === 'pickup' ? 'text-[#E8743B]' : 'text-[#2D5F5F]'}`}>{task.type === 'pickup' ? 'מסירה' : 'החזרה'}</span>
              {' · '}
              {day ? dayLabel(day, now) : '—'}
              {' · '}
              <span dir="ltr">{time ?? 'ללא שעה'}</span>
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${STATUS_CLASS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
        </div>

        <p className="mt-2 flex min-w-0 gap-1 text-sm text-gray-600">
          <span className="truncate">{bookingVehicleName(task.booking)}</span>
          {plate !== '—' && <><span className="shrink-0">·</span><span className="shrink-0 font-bold text-gray-800" dir="ltr">{plate}</span></>}
        </p>

        {editingThisAddress ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={editingAddress.value}
              onChange={(event) => setEditingAddress({ id: task.id, value: event.target.value })}
              placeholder="רחוב, מספר, עיר"
              autoFocus
              className="min-h-11 min-w-0 flex-1 basis-56 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
            <button onClick={async () => { if (await patchTask(task, { location: editingAddress.value.trim() }, 'עדכון הכתובת נכשל')) setEditingAddress(null); }} className={`${smallBtn} bg-[#2D5F5F] text-white`}>שמירה</button>
            <button onClick={() => setEditingAddress(null)} className={`${smallBtn} border-2 border-gray-200 text-gray-600`}>ביטול</button>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className={`min-w-0 truncate text-sm ${location ? 'text-gray-700' : 'text-gray-400'}`}>{location || 'לא צוינה כתובת'}</p>
            <button onClick={() => setEditingAddress({ id: task.id, value: location })} className={`${smallBtn} shrink-0 text-[#2D5F5F] hover:bg-[#eef6f6]`}>
              {location ? 'עריכת כתובת' : 'הוספת כתובת'}
            </button>
          </div>
        )}

        {editingThisWhen && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[#eef6f6] p-3">
            <label className="block text-sm font-bold text-gray-600">
              תאריך
              <input type="date" value={editingWhen.day} onChange={(event) => setEditingWhen({ ...editingWhen, day: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border-2 border-gray-200 bg-white px-2 text-base font-normal" />
            </label>
            <label className="block text-sm font-bold text-gray-600">
              שעה
              <input type="time" value={editingWhen.time} onChange={(event) => setEditingWhen({ ...editingWhen, time: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border-2 border-gray-200 bg-white px-2 text-base font-normal" />
            </label>
            <div className="col-span-2 flex gap-2">
              <button onClick={() => saveWhen(task, editingWhen.day, editingWhen.time)} className={`${smallBtn} flex-1 bg-[#2D5F5F] text-white`}>שמירת מועד</button>
              <button onClick={() => setEditingWhen(null)} className={`${smallBtn} border-2 border-gray-200 bg-white text-gray-600`}>ביטול</button>
            </div>
          </div>
        )}

        {task.notes && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-600">הערה: {task.notes}</p>}

        {(doc?.pdfUrl || doc?.videoUrl || phone || (task.status === 'open' && !editingThisWhen)) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {doc?.pdfUrl && (
              <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" className={`${smallBtn} flex items-center gap-1.5 bg-[#2D5F5F] text-white`}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                PDF חתום
              </a>
            )}
            {doc?.videoUrl && (
              <a href={doc.videoUrl} target="_blank" rel="noopener noreferrer" className={`${smallBtn} flex items-center gap-1.5 border-2 border-gray-200 text-gray-700`}>
                <Video className="h-4 w-4" aria-hidden="true" />
                סרטון
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className={`${smallBtn} flex items-center gap-1.5 border-2 border-green-500 bg-green-50 text-green-700`}>
                <Phone className="h-4 w-4" aria-hidden="true" />
                התקשר
              </a>
            )}
            {task.status === 'open' && !editingThisWhen && (
              <button onClick={() => setEditingWhen({ id: task.id, day: day || today, time: time ?? '' })} className={`${smallBtn} flex items-center gap-1.5 border-2 border-[#B8D8D8] text-[#2D5F5F]`}>
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                שינוי מועד
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <label className="flex min-w-0 flex-1 basis-48 items-center gap-2 text-sm font-bold text-gray-600">
            נהג
            <select
              value={task.assigned_driver_id ?? ''}
              onChange={(event) => patchTask(task, { assignedDriverId: event.target.value || null }, 'שיוך הנהג נכשל')}
              aria-label="שינוי נהג למשימה"
              className={`min-h-11 min-w-0 flex-1 rounded-xl border-2 bg-white px-2 text-base font-normal ${task.assigned_driver_id ? 'border-gray-200' : 'border-red-300'}`}
            >
              <option value="">ללא שיוך</option>
              {activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
            </select>
          </label>
          {task.inspection?.status === 'signed' && <span className="text-sm font-bold text-green-700">✓ נחתם</span>}
          {task.inspection?.status === 'awaiting_signature' && <span className="text-sm font-bold text-amber-700">ממתין לחתימה</span>}
          {task.status === 'open' && <button onClick={() => cancelTask(task)} className={`${smallBtn} text-red-600 hover:bg-red-50`}>ביטול משימה</button>}
          {task.status === 'cancelled' && <button onClick={() => deleteTask(task)} className={`${smallBtn} bg-red-50 text-red-700 hover:bg-red-100`}>מחיקה</button>}
        </div>
      </div>
    );
  };

  const renderSignedJob = (job: SignedJob) => (
    <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="font-black text-[#0D2B2B]">
          {job.customerName || 'ללא שם לקוח'}{' '}
          <span className="text-sm font-bold text-gray-500">· {job.type === 'pickup' ? 'מסירה' : 'החזרה'}</span>
        </p>
        <p className="text-sm text-gray-600">
          {job.vehicleName}{job.licensePlate && job.licensePlate !== '—' ? ` · ${job.licensePlate}` : ''}
          {job.driverName ? ` · נהג: ${job.driverName}` : ''}
        </p>
        <p className="text-sm text-gray-500">
          {job.signedAt ? `נחתם ${formatDateTime(job.signedAt)}` : ''}
          {job.address ? ` · ${job.address}` : ''}
          {job.damageCount > 0 ? ` · ${job.damageCount} ${job.type === 'return' ? 'נזקים חדשים' : 'נזקים סומנו'}` : ''}
        </p>
      </div>
      <div className="flex gap-2">
        {job.pdfUrl && <a href={job.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-xl bg-[#2D5F5F] px-4 text-sm font-black text-white">PDF חתום</a>}
        {job.videoUrl && <a href={job.videoUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-black text-gray-700">סרטון</a>}
      </div>
    </div>
  );

  const searchBox = (key: string, placeholder: string) => (
    <div className="relative">
      <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-gray-400" aria-hidden="true" />
      <input
        type="search"
        value={taskSearch[key] ?? ''}
        onChange={(event) => setTaskSearch((prev) => ({ ...prev, [key]: event.target.value }))}
        placeholder={placeholder}
        className="w-full min-h-12 rounded-xl border-2 border-gray-200 bg-white ps-10 pe-3 text-base"
      />
    </div>
  );

  const chip = (active: boolean) =>
    `min-h-11 flex-1 rounded-xl border-2 px-4 text-sm font-black sm:flex-none ${active ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white' : 'border-gray-200 bg-white text-gray-600'}`;

  const loading = isLoading || tasksLoading;
  const boardCounts = {
    total: boardTasks.length,
    open: boardTasks.filter((t) => t.status === 'open').length,
    done: boardTasks.filter((t) => t.status === 'done').length,
    unassigned: boardTasks.filter((t) => !t.assigned_driver_id && t.status === 'open').length,
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8" dir="rtl">
      {/* Header + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-[#0D2B2B]">{isAdmin ? 'נהגים' : 'משימות לנהגים'}</h1>
          <p className="mt-1 text-gray-500">{drivers.length} נהגים · מתעדכן אוטומטית כל דקה</p>
        </div>
        <button onClick={refreshAll} disabled={isValidating || tasksValidating} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#B8D8D8] bg-white px-4 text-sm font-bold text-[#2D5F5F] hover:bg-[#eef6f6] disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${isValidating || tasksValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
          רענון
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute top-1/2 -translate-y-1/2 start-4 h-5 w-5 text-[#2D5F5F]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש: לקוח, לוחית, טלפון, כתובת"
          className="w-full min-h-14 rounded-2xl border-2 border-[#B8D8D8] bg-white ps-12 pe-12 text-base shadow-sm focus:border-[#2D5F5F] focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="ניקוי החיפוש" className="absolute top-1/2 -translate-y-1/2 end-2 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      ) : query.trim() ? (
        <section>
          <h2 className="mb-3 text-lg font-black text-[#0D2B2B]">תוצאות חיפוש ({searchResults.length})</h2>
          <div className="grid gap-3 lg:grid-cols-2">{searchResults.map((t) => renderTask(t))}</div>
          {searchResults.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-gray-400">לא נמצאו משימות</p>}
        </section>
      ) : (
        <>
          {/* Needs attention */}
          {attentionCount > 0 && (
            <section className="mb-5 overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-sm">
              <button onClick={() => setAttentionOpen((o) => !o)} aria-expanded={attentionOpen} className="flex min-h-14 w-full items-center justify-between gap-3 bg-red-50 p-4 text-start">
                <span className="flex items-center gap-2 text-lg font-black text-red-800">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  דורש טיפול ({attentionCount})
                </span>
                <ChevronDown className={`h-5 w-5 text-red-800 transition-transform ${attentionOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {attentionOpen && (
                <div className="grid gap-3 p-4 lg:grid-cols-2">
                  {(attentionAll ? attention.items : attention.items.slice(0, ATTENTION_PREVIEW)).map(({ task, reason }) => renderTask(task, reason))}
                  {(attentionAll || attention.items.length < ATTENTION_PREVIEW ? attention.damageJobs : []).map((job) => (
                    <div key={`dmg-${job.id}`}>
                      <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700">
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        {job.damageCount} נזקים חדשים בהחזרה
                      </p>
                      {renderSignedJob(job)}
                    </div>
                  ))}
                  {!attentionAll && attentionCount > ATTENTION_PREVIEW && (
                    <button onClick={() => setAttentionAll(true)} className="min-h-12 rounded-xl border-2 border-red-200 bg-white text-base font-black text-red-700 lg:col-span-2">
                      הצג הכל ({attentionCount})
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Views */}
          <div className="mb-5 flex gap-1 rounded-2xl bg-[#D6EEF5] p-1" role="tablist">
            {([['board', 'לוח יומי'], ['drivers', 'לפי נהג'], ['signed', `נחתמו (${signedJobs.length})`]] as const).map(([key, text]) => (
              <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`min-h-12 flex-1 rounded-xl text-sm font-black sm:text-base ${view === key ? 'bg-white text-[#0D2B2B] shadow-sm' : 'text-[#2D5F5F]'}`}>
                {text}
              </button>
            ))}
          </div>

          {view === 'board' && (
            <section>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button onClick={() => setBoardDate(today)} className={chip(boardDate === today)}>היום</button>
                <button onClick={() => setBoardDate(tomorrow)} className={chip(boardDate === tomorrow)}>מחר</button>
                <input type="date" value={boardDate} onChange={(event) => event.target.value && setBoardDate(event.target.value)} aria-label="תאריך" className="min-h-11 flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 text-base sm:flex-none" />
              </div>
              <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                {([['משימות', boardCounts.total, 'text-[#0D2B2B]'], ['פתוחות', boardCounts.open, 'text-amber-700'], ['בוצעו', boardCounts.done, 'text-green-700'], ['בלי נהג', boardCounts.unassigned, boardCounts.unassigned ? 'text-red-600' : 'text-gray-400']] as const).map(([text, n, color]) => (
                  <div key={text} className="rounded-2xl bg-white p-3 shadow-sm">
                    <p className={`text-2xl font-black ${color}`}>{n}</p>
                    <p className="text-xs font-bold text-gray-500 sm:text-sm">{text}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {boardTasks.map((t) => (
                  <div key={t.id}>
                    <p className="mb-1 text-sm font-black text-[#2D5F5F]">{t.assigned_driver_id ? driverName.get(t.assigned_driver_id) ?? 'נהג' : 'ללא נהג'}</p>
                    {renderTask(t)}
                  </div>
                ))}
              </div>
              {boardTasks.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-gray-400">אין משימות ל{dayLabel(boardDate, now)}</p>}
            </section>
          )}

          {view === 'drivers' && (
            <section>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button onClick={() => setFilterDate('')} className={chip(filterDate === '')}>הכל</button>
                <button onClick={() => setFilterDate(today)} className={chip(filterDate === today)}>היום</button>
                <button onClick={() => setFilterDate(tomorrow)} className={chip(filterDate === tomorrow)}>מחר</button>
                <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} aria-label="תאריך" className="min-h-11 flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 text-base sm:flex-none" />
              </div>

              <div className="space-y-4">
                {drivers.map((driver) => {
                  const driverTasks = tasksByDriver.get(driver.id) ?? [];
                  const load = loadByDriver.get(driver.id) ?? { today: 0, tomorrow: 0 };
                  const isOpen = Boolean(expanded[driver.id]);
                  const shown = isOpen ? prepareTasks(driverTasks, driver.id) : [];
                  return (
                    <section key={driver.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-[#0D2B2B]">{driver.name}</h3>
                          {!driver.active && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">מושבת</span>}
                          <span className="rounded-full bg-[#eef6f6] px-2.5 py-1 text-xs font-bold text-[#2D5F5F]">היום {load.today} · מחר {load.tomorrow}</span>
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                          {driver.active && (
                            <button onClick={() => setAssigningDriverId(assigningDriverId === driver.id ? null : driver.id)} className="flex min-h-12 flex-[3] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#E8743B] px-3 text-sm font-black text-white hover:bg-[#d4632a] sm:flex-none">
                              <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
                              משימה חדשה
                            </button>
                          )}
                          <button onClick={() => toggleExpanded(driver.id)} aria-expanded={isOpen} className="flex min-h-12 flex-[2] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-gray-200 px-3 text-sm font-black text-gray-700 hover:bg-gray-50 sm:flex-none">
                            משימות ({driverTasks.length})
                            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {assigningDriverId === driver.id && (
                        <div className="border-t border-gray-100">
                          <DriverTaskForm
                            driver={driver}
                            tasksApi={tasksApi}
                            bookingsApi={isAdmin ? '/api/bookings' : '/api/driver/manage/bookings'}
                            onCancel={() => setAssigningDriverId(null)}
                            onCreated={() => { setAssigningDriverId(null); mutateTasks(); setExpanded((prev) => ({ ...prev, [driver.id]: true })); }}
                          />
                        </div>
                      )}

                      {isOpen && (
                        <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 p-4">
                          {searchBox(driver.id, 'חיפוש לפי שם לקוח או כתובת')}
                          <div className="grid gap-3 lg:grid-cols-2">
                            {shown.map((t) => renderTask(t))}
                            {shown.length === 0 && (
                              <p className="py-4 text-center text-sm text-gray-400 lg:col-span-2">
                                {taskSearch[driver.id]?.trim() ? 'לא נמצאו משימות' : 'אין משימות לנהג'}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                            <button onClick={() => toggleActive(driver)} className="min-h-11 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-bold text-gray-600 hover:bg-gray-100">{driver.active ? 'השבתת נהג' : 'הפעלת נהג'}</button>
                            <button onClick={() => resetPin(driver)} className="flex min-h-11 items-center gap-1 rounded-xl bg-[#eef6f6] px-4 text-sm font-bold text-[#2D5F5F] hover:bg-[#d9ecec]"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" />איפוס קוד</button>
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}

                {(tasksByDriver.get('unassigned') ?? []).length > 0 && (() => {
                  const unassigned = tasksByDriver.get('unassigned') ?? [];
                  const isOpen = Boolean(expanded.unassigned);
                  const shown = isOpen ? prepareTasks(unassigned, 'unassigned') : [];
                  return (
                    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                      <button onClick={() => toggleExpanded('unassigned')} aria-expanded={isOpen} className="flex min-h-14 w-full items-center justify-between gap-3 bg-amber-50 p-4 text-start">
                        <span>
                          <span className="block text-lg font-black text-amber-900">משימות שעדיין לא שויכו ({unassigned.length})</span>
                          <span className="block text-sm text-amber-700">בחרו נהג בכל משימה כדי להעביר אותה אליו</span>
                        </span>
                        <ChevronDown className={`h-5 w-5 text-amber-800 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {isOpen && (
                        <div className="space-y-3 p-4">
                          {searchBox('unassigned', 'חיפוש לפי שם לקוח או כתובת')}
                          <div className="grid gap-3 lg:grid-cols-2">{shown.map((t) => renderTask(t))}</div>
                        </div>
                      )}
                    </section>
                  );
                })()}

                {drivers.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-gray-400">אין נהגים עדיין</div>}
              </div>

              {/* People */}
              <div className="mt-6 space-y-4">
                {!addingDriver ? (
                  <button onClick={() => setAddingDriver(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#B8D8D8] bg-white text-base font-black text-[#2D5F5F] hover:bg-[#eef6f6] sm:w-auto sm:px-6">
                    <UserPlus className="h-5 w-5" aria-hidden="true" />
                    הוספת נהג
                  </button>
                ) : (
                  <form onSubmit={(event) => { event.preventDefault(); void createPerson('driver'); }} className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex sm:flex-wrap sm:items-end">
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold text-gray-600">שם הנהג</span>
                      <input value={newDriverName} onChange={(event) => setNewDriverName(event.target.value)} required autoFocus className="min-h-12 w-full rounded-xl border-2 border-gray-200 px-3 text-base sm:w-56" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-bold text-gray-600">קוד כניסה (4 ספרות)</span>
                      <input value={newDriverPin} onChange={(event) => setNewDriverPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} required className="min-h-12 w-full rounded-xl border-2 border-gray-200 px-3 text-base sm:w-36" dir="ltr" />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={creating} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8743B] px-5 text-base font-black text-white hover:bg-[#d4632a] disabled:opacity-50">
                        <UserPlus className="h-5 w-5" aria-hidden="true" />
                        הוספה
                      </button>
                      <button type="button" onClick={() => setAddingDriver(false)} className="min-h-12 rounded-xl border-2 border-gray-200 px-4 text-base font-bold text-gray-600">ביטול</button>
                    </div>
                  </form>
                )}

                {isAdmin && (
                  <section className="rounded-2xl border border-[#B8D8D8] bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-black text-[#0D2B2B]">מנהלים</h2>
                    <p className="mb-3 text-sm text-gray-500">מנהלי סניפים מקצים משימות לנהגים בדף נפרד (smartcar.co.il/manager), בלי גישה לאדמין. נכנסים עם השם וקוד של 4 ספרות.</p>
                    <form onSubmit={(event) => { event.preventDefault(); void createPerson('manager'); }} className="mb-4 flex flex-wrap items-end gap-3">
                      <label className="block">
                        <span className="mb-1 block text-sm font-bold text-gray-600">שם המנהל</span>
                        <input value={managerName} onChange={(event) => setManagerName(event.target.value)} required className="min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-sm font-bold text-gray-600">קוד (4 ספרות)</span>
                        <input value={managerPin} onChange={(event) => setManagerPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} required className="min-h-12 w-32 rounded-xl border-2 border-gray-200 px-3 text-base" dir="ltr" />
                      </label>
                      <button type="submit" disabled={creating} className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2D5F5F] px-4 text-sm font-black text-white disabled:opacity-50">
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        הוספת מנהל
                      </button>
                    </form>
                    {managers.length === 0 ? (
                      <p className="text-sm text-gray-400">אין מנהלים עדיין</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {managers.map((manager) => (
                          <li key={manager.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{manager.name}</span>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${manager.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{manager.active ? 'פעיל' : 'מושבת'}</span>
                            </span>
                            <span className="flex gap-2">
                              <button onClick={() => toggleActive(manager)} className="min-h-11 rounded-xl bg-gray-50 px-4 text-sm font-bold text-gray-700 hover:bg-gray-100">{manager.active ? 'השבתה' : 'הפעלה'}</button>
                              <button onClick={() => resetPin(manager)} className="flex min-h-11 items-center gap-1 rounded-xl bg-[#eef6f6] px-4 text-sm font-bold text-[#2D5F5F] hover:bg-[#d9ecec]"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" />איפוס קוד</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                {error && <p className="text-sm font-bold text-red-600">{error}</p>}
              </div>
            </section>
          )}

          {view === 'signed' && (
            <section className="space-y-3">
              {searchBox('signed', 'חיפוש לפי לקוח, כתובת, רכב או נהג')}
              {(() => {
                const needle = (taskSearch.signed ?? '').trim().toLowerCase();
                const shown = signedJobs.filter((job) =>
                  !needle || [job.customerName, job.address, job.licensePlate, job.driverName, job.vehicleName].some((v) => (v ?? '').toLowerCase().includes(needle))
                );
                return (
                  <>
                    <div className="grid gap-3 lg:grid-cols-2">{shown.map(renderSignedJob)}</div>
                    {shown.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-gray-400">לא נמצאו עבודות</p>}
                  </>
                );
              })()}
            </section>
          )}
        </>
      )}
    </div>
  );
}
