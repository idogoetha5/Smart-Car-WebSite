'use client';

import { useMemo, useState } from 'react';
import { numericOrderReference } from '@/lib/order-reference';
import { useApiList } from '@/lib/swr';
import { bookingVehicleName } from '@/lib/booking-vehicle';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  license_plate: string | null;
}

interface BookingOption {
  id: string;
  customer_name: string;
  custom_vehicle_name: string | null;
    custom_license_plate?: string | null;
  vehicle: { make: string; model: string } | null;
}

interface DriverTaskFormProps {
  driver: { id: string; name: string };
  onCancel: () => void;
  onCreated: () => void;
  /** Admin: '/api/admin/tasks'. Branch managers: '/api/driver/manage/tasks'. */
  tasksApi?: string;
  /** Admin: '/api/bookings'. Branch managers: '/api/driver/manage/bookings'. */
  bookingsApi?: string;
}

/** YYYY-MM-DD for today + offset days, in the device's (Israel) local time. */
function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const field = 'min-h-12 w-full rounded-xl border-2 border-gray-200 bg-white px-3 text-base';
const label = 'mb-1 block text-sm font-bold text-gray-600';

export default function DriverTaskForm({
  driver,
  onCancel,
  onCreated,
  tasksApi = '/api/admin/tasks',
  bookingsApi = '/api/bookings',
}: DriverTaskFormProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [vehicleMode, setVehicleMode] = useState<'fleet' | 'custom'>('fleet');
  const [type, setType] = useState<'pickup' | 'return'>('pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [customVehicleName, setCustomVehicleName] = useState('');
  const [customLicensePlate, setCustomLicensePlate] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [date, setDate] = useState(() => localDateString(0));
  const [time, setTime] = useState('');
  const [planReturn, setPlanReturn] = useState(false);
  const [returnDate, setReturnDate] = useState(() => localDateString(1));
  const [returnTime, setReturnTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { items: vehicles } = useApiList<Vehicle>(mode === 'new' && vehicleMode === 'fleet' ? '/api/driver/vehicles' : null);
  const { items: bookings } = useApiList<BookingOption>(mode === 'existing' ? bookingsApi : null);

  const filteredBookings = useMemo(() => {
    if (!bookingSearch.trim()) return bookings.slice(0, 20);
    const needle = bookingSearch.toLowerCase();
    return bookings
      .filter((booking) => booking.customer_name?.toLowerCase().includes(needle) || numericOrderReference(booking.id) === bookingSearch.trim())
      .slice(0, 20);
  }, [bookings, bookingSearch]);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  // A fleet car without a plate in the system offers a plate field (optional here —
  // managers may not know it yet; the driver app asks for it).
  const fleetPlateMissing = vehicleMode === 'fleet' && Boolean(selectedVehicle) && !selectedVehicle?.license_plate?.trim();

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'existing' && !bookingId) {
      setError(type === 'return' ? 'יש לבחור את ההזמנה של הלקוח (המסירה)' : 'יש לבחור הזמנה קיימת');
      return;
    }
    if (!date) {
      setError('יש לבחור תאריך');
      return;
    }
    if (mode === 'new' && vehicleMode === 'custom' && !customLicensePlate.trim() && !customVehicleName.trim()) {
      setError('יש לכתוב מספר רישוי או שם רכב');
      return;
    }
    // No time → midday, so the task still lands on the right day for the driver.
    const scheduledAt = new Date(`${date}T${time || '12:00'}:00`).toISOString();
    const withReturn = type === 'pickup' && planReturn && Boolean(returnDate);
    if (withReturn && returnDate < date) {
      setError('תאריך ההחזרה לא יכול להיות לפני המסירה');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(tasksApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          bookingId: mode === 'existing' ? bookingId : undefined,
          customerName: mode === 'new' ? customerName : undefined,
          customerPhone: mode === 'new' ? customerPhone : undefined,
          customerEmail: mode === 'new' ? customerEmail : undefined,
          vehicleId: mode === 'new' && vehicleMode === 'fleet' ? vehicleId : undefined,
          customVehicleName: mode === 'new' && vehicleMode === 'custom' ? customVehicleName : undefined,
          customLicensePlate: mode === 'new' && (vehicleMode === 'custom' || fleetPlateMissing) ? customLicensePlate : undefined,
          scheduledAt,
          scheduledTime: time || undefined,
          location: location || undefined,
          notes: notes || undefined,
          assignedDriverId: driver.id,
          returnAt: withReturn ? new Date(`${returnDate}T${returnTime || '12:00'}:00`).toISOString() : undefined,
          returnTime: withReturn && returnTime ? returnTime : undefined,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.error || 'יצירת המשימה נכשלה');
        return;
      }
      onCreated();
    } finally {
      setCreating(false);
    }
  };

  const chooseType = (next: 'pickup' | 'return') => {
    setType(next);
    // A return belongs to the rental where the car was handed over, so the
    // driver sees the handover damage in grey. Default to picking that booking.
    setMode(next === 'return' ? 'existing' : 'new');
  };

  const tab = (active: boolean) =>
    `min-h-12 flex-1 rounded-xl border-2 text-base font-black ${active ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white' : 'border-gray-200 bg-white text-gray-600'}`;

  return (
    <form onSubmit={createTask} className="space-y-5 border-t border-orange-100 bg-orange-50/40 p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">משימה חדשה עבור {driver.name}</h3>
        <p className="text-sm text-gray-500">המשימה תופיע אצל הנהג ביום שנבחר (וגם יום לפני, בלשונית &quot;מחר&quot;)</p>
      </div>

      <div>
        <span className={label}>סוג משימה</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => chooseType('pickup')} className={tab(type === 'pickup')}>מסירה</button>
          <button type="button" onClick={() => chooseType('return')} className={tab(type === 'return')}>החזרה</button>
        </div>
      </div>

      <div>
        <span className={label}>מתי</span>
        <div className="mb-2 flex gap-2">
          <button type="button" onClick={() => setDate(localDateString(0))} className={tab(date === localDateString(0))}>היום</button>
          <button type="button" onClick={() => setDate(localDateString(1))} className={tab(date === localDateString(1))}>מחר</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>תאריך</span>
            <input type="date" value={date} min={localDateString(0)} onChange={(event) => setDate(event.target.value)} className={field} required />
          </label>
          <label className="block">
            <span className={label}>שעה (לא חובה)</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={field} />
          </label>
        </div>
      </div>

      <div>
        <span className={label}>{type === 'return' ? 'של איזה לקוח ההחזרה?' : 'הלקוח'}</span>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setMode('existing')} className={tab(mode === 'existing')}>{type === 'return' ? 'לקוח קיים' : 'הזמנה קיימת'}</button>
          <button type="button" onClick={() => setMode('new')} className={tab(mode === 'new')}>לקוח חדש</button>
        </div>

        {mode === 'existing' ? (
          <div>
            {type === 'return' && (
              <p className="mb-2 text-sm text-[#2D5F5F]">בחר את ההזמנה שבה הרכב נמסר — כך הנהג יראה באפור את הנזקים שסומנו במסירה.</p>
            )}
            <input value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="חיפוש לפי שם לקוח / מספר הזמנה" className={`${field} mb-2`} />
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {filteredBookings.map((booking) => (
                <button type="button" key={booking.id} onClick={() => setBookingId(booking.id)} className={`min-h-14 w-full rounded-xl border-2 px-3 py-2 text-right text-base ${bookingId === booking.id ? 'border-[#E8743B] bg-orange-50' : 'border-gray-200 bg-white'}`}>
                  <span className="block font-bold text-gray-900">{booking.customer_name}</span>
                  <span className="block text-sm text-gray-500">{bookingVehicleName(booking)} · #{numericOrderReference(booking.id)}</span>
                </button>
              ))}
              {filteredBookings.length === 0 && <p className="py-4 text-center text-sm text-gray-400">לא נמצאו הזמנות</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={label}>שם הלקוח</span>
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={field} required />
            </label>
            <label className="block"><span className={label}>טלפון</span>
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} type="tel" dir="ltr" className={field} required />
            </label>
            <label className="block"><span className={label}>אימייל הלקוח</span>
              <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} dir="ltr" className={field} required />
            </label>
            <div className="sm:col-span-2">
              <span className={label}>רכב</span>
              <div className="mb-2 flex gap-2">
                <button type="button" onClick={() => setVehicleMode('fleet')} className={tab(vehicleMode === 'fleet')}>רכב מהצי</button>
                <button type="button" onClick={() => setVehicleMode('custom')} className={tab(vehicleMode === 'custom')}>לא ברשימה</button>
              </div>
              {vehicleMode === 'fleet' ? (
                <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={field} required>
                  <option value="">בחר רכב</option>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} {vehicle.license_plate ? `— ${vehicle.license_plate}` : ''}</option>)}
                </select>
              ) : null}
              {vehicleMode === 'fleet' && fleetPlateMissing && (
                <label className="mt-3 block rounded-xl border-2 border-amber-300 bg-amber-50 p-3"><span className={label}>לרכב הזה אין מספר רישוי במערכת (לא חובה)</span>
                  <input value={customLicensePlate} onChange={(event) => setCustomLicensePlate(event.target.value)} inputMode="numeric" dir="ltr" placeholder="12-345-67" className={field} />
                </label>
              )}
              {vehicleMode === 'custom' ? (
                <div className="space-y-3">
                  <label className="block"><span className={label}>מספר רישוי (לא חובה)</span>
                    <input value={customLicensePlate} onChange={(event) => setCustomLicensePlate(event.target.value)} inputMode="numeric" dir="ltr" placeholder="12-345-67" className={field} />
                  </label>
                  <label className="block"><span className={label}>שם הרכב</span>
                    <input value={customVehicleName} onChange={(event) => setCustomVehicleName(event.target.value)} placeholder="לדוגמה: טויוטה קורולה לבנה" className={field} />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {type === 'pickup' && (
        <div className={`rounded-2xl border-2 p-3 ${planReturn ? 'border-[#2D5F5F] bg-[#eef6f6]' : 'border-gray-200 bg-white'}`}>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-bold text-gray-800">
            <input type="checkbox" checked={planReturn} onChange={(event) => setPlanReturn(event.target.checked)} className="h-6 w-6 shrink-0 accent-[#2D5F5F]" />
            ליצור גם משימת החזרה
          </label>
          {planReturn && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>תאריך החזרה</span>
                <input type="date" value={returnDate} min={date} onChange={(event) => setReturnDate(event.target.value)} className={field} required />
              </label>
              <label className="block">
                <span className={label}>שעה (לא חובה)</span>
                <input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} className={field} />
              </label>
              <p className="col-span-2 text-sm text-gray-600">משימת ההחזרה תשויך ל{driver.name}. אפשר להעביר אותה לנהג אחר אחר כך.</p>
            </div>
          )}
        </div>
      )}

      <label className="block"><span className={label}>כתובת ללקוח — לוויז (לא חובה)</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="רחוב, מספר, עיר" className={field} />
      </label>
      <label className="block"><span className={label}>הערות לנהג (לא חובה)</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-base" />
      </label>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={creating} className="min-h-14 flex-[2] rounded-xl bg-[#E8743B] text-base font-black text-white disabled:opacity-50">{creating ? 'יוצר...' : `הקצאה ל${driver.name}`}</button>
        <button type="button" onClick={onCancel} className="min-h-14 flex-1 rounded-xl border-2 border-gray-200 bg-white text-base font-bold text-gray-600">ביטול</button>
      </div>
    </form>
  );
}
