'use client';

import { useMemo, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { useApiList } from '@/lib/swr';
import { numericOrderReference } from '@/lib/order-reference';

interface Driver {
  id: string;
  name: string;
  active: boolean;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  license_plate: string | null;
}

interface BookingOption {
  id: string;
  customer_name: string;
  vehicle: { make: string; model: string } | null;
}

interface Task {
  id: string;
  type: 'pickup' | 'return';
  status: 'open' | 'done' | 'cancelled';
  notes: string | null;
  assigned_driver_id: string | null;
  driver: { id: string; name: string } | null;
  booking: {
    id: string;
    customer_name: string;
    customer_phone: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_location: string;
    dropoff_location: string;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
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
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AdminTasksPage() {
  const [filterDriverId, setFilterDriverId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const query = new URLSearchParams();
  if (filterDriverId) query.set('driverId', filterDriverId);
  if (filterDate) query.set('date', filterDate);
  const { items: tasks, isLoading, isValidating, mutate } = useApiList<Task>(`/api/admin/tasks?${query.toString()}`);
  const { items: drivers } = useApiList<Driver>('/api/admin/drivers');
  const activeDrivers = useMemo(() => drivers.filter((d) => d.active), [drivers]);

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [type, setType] = useState<'pickup' | 'return'>('pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedDriverId, setAssignedDriverId] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const { items: vehicles } = useApiList<Vehicle>(showForm && mode === 'new' ? '/api/driver/vehicles' : null);
  const { items: bookings } = useApiList<BookingOption>(showForm && mode === 'existing' ? '/api/bookings' : null);

  const filteredBookings = useMemo(() => {
    if (!bookingSearch.trim()) return bookings.slice(0, 20);
    const needle = bookingSearch.toLowerCase();
    return bookings
      .filter(
        (b) =>
          b.customer_name?.toLowerCase().includes(needle) ||
          numericOrderReference(b.id) === bookingSearch.trim()
      )
      .slice(0, 20);
  }, [bookings, bookingSearch]);

  const resetForm = () => {
    setMode('new');
    setType('pickup');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setVehicleId('');
    setBookingSearch('');
    setBookingId('');
    setScheduledAt('');
    setLocation('');
    setNotes('');
    setAssignedDriverId('');
    setFormError('');
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (mode === 'existing' && !bookingId) {
      setFormError('יש לבחור הזמנה קיימת');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          bookingId: mode === 'existing' ? bookingId : undefined,
          customerName: mode === 'new' ? customerName : undefined,
          customerPhone: mode === 'new' ? customerPhone : undefined,
          customerEmail: mode === 'new' ? customerEmail : undefined,
          vehicleId: mode === 'new' ? vehicleId : undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          location: location || undefined,
          notes: notes || undefined,
          assignedDriverId: assignedDriverId || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.error || 'יצירת המשימה נכשלה');
        return;
      }
      resetForm();
      setShowForm(false);
      mutate();
    } finally {
      setCreating(false);
    }
  };

  const reassign = async (task: Task, driverId: string) => {
    const res = await fetch(`/api/admin/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedDriverId: driverId || null }),
    });
    if (!res.ok) { alert('שיוך הנהג נכשל'); return; }
    mutate();
  };

  const cancelTask = async (task: Task) => {
    if (!window.confirm('לבטל את המשימה?')) return;
    const res = await fetch(`/api/admin/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!res.ok) { alert('הביטול נכשל'); return; }
    mutate();
  };

  return (
    <div className="p-4 sm:p-8" dir="rtl">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-900">משימות</h1>
          <p className="mt-1 text-gray-500">{tasks.length} משימות</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
            רענון
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] px-4 text-sm font-black text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            משימה חדשה
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={filterDriverId}
          onChange={(e) => setFilterDriverId(e.target.value)}
          className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700"
        >
          <option value="">כל הנהגים</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm"
        />
      </div>

      {showForm && (
        <form onSubmit={createTask} className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('new')} className={`min-h-10 px-4 rounded-lg text-sm font-bold ${mode === 'new' ? 'bg-[#2D5F5F] text-white' : 'bg-gray-100 text-gray-600'}`}>הזמנה חדשה</button>
            <button type="button" onClick={() => setMode('existing')} className={`min-h-10 px-4 rounded-lg text-sm font-bold ${mode === 'existing' ? 'bg-[#2D5F5F] text-white' : 'bg-gray-100 text-gray-600'}`}>הזמנה קיימת</button>
          </div>

          {mode === 'new' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם הלקוח" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="טלפון" dir="ltr" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
              <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="אימייל (לא חובה)" dir="ltr" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm bg-white">
                <option value="">בחר רכב</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.make} {v.model} {v.license_plate ? `— ${v.license_plate}` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <input
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                placeholder="חיפוש לפי שם לקוח / מספר הזמנה"
                className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm mb-2"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredBookings.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setBookingId(b.id)}
                    className={`w-full text-right min-h-10 rounded-lg px-3 text-sm ${bookingId === b.id ? 'bg-orange-50 border-2 border-[#E8743B]' : 'bg-gray-50 border-2 border-transparent'}`}
                  >
                    {b.customer_name} — {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : ''} — #{numericOrderReference(b.id)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as 'pickup' | 'return')} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm bg-white">
              <option value="pickup">קבלה</option>
              <option value="return">החזרה</option>
            </select>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="כתובת / סניף" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
            <select value={assignedDriverId} onChange={(e) => setAssignedDriverId(e.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm bg-white">
              <option value="">ללא שיוך</option>
              {activeDrivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות" rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />

          {formError && <p className="text-red-600 text-sm">{formError}</p>}

          <button type="submit" disabled={creating} className="min-h-11 px-5 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black text-sm disabled:opacity-50">
            {creating ? 'יוצר...' : 'יצירת משימה'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="p-4 font-semibold">לקוח</th>
                <th className="p-4 font-semibold">רכב</th>
                <th className="p-4 font-semibold">סוג</th>
                <th className="p-4 font-semibold">מועד</th>
                <th className="p-4 font-semibold">נהג</th>
                <th className="p-4 font-semibold">סטטוס</th>
                <th className="p-4 font-semibold">נחתם?</th>
                <th className="p-4 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="p-4 font-medium text-gray-900">{task.booking?.customer_name ?? '—'}</td>
                  <td className="p-4 text-gray-600">{task.booking?.vehicle ? `${task.booking.vehicle.make} ${task.booking.vehicle.model}` : '—'}</td>
                  <td className="p-4">{task.type === 'pickup' ? 'קבלה' : 'החזרה'}</td>
                  <td className="p-4 text-xs text-gray-500">{formatDateTime(task.type === 'pickup' ? task.booking?.pickup_date : task.booking?.dropoff_date)}</td>
                  <td className="p-4">
                    <select
                      defaultValue={task.assigned_driver_id ?? ''}
                      onChange={(e) => reassign(task, e.target.value)}
                      className="min-h-9 rounded-lg border border-gray-200 px-2 text-xs bg-white"
                    >
                      <option value="">ללא שיוך</option>
                      {activeDrivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
                  </td>
                  <td className="p-4">
                    {task.inspection?.status === 'signed' ? (
                      <span className="text-green-600 font-bold text-xs">✓ נחתם</span>
                    ) : task.inspection ? (
                      <span className="text-amber-600 font-bold text-xs">ממתין</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    {task.status !== 'cancelled' && task.status !== 'done' && (
                      <button onClick={() => cancelTask(task)} className="text-xs font-bold text-red-500 hover:text-red-700">ביטול</button>
                    )}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">אין משימות</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
