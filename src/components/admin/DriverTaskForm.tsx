'use client';

import { useMemo, useState } from 'react';
import { numericOrderReference } from '@/lib/order-reference';
import { useApiList } from '@/lib/swr';
import { bookingVehicleName } from '@/lib/booking-vehicle';
import { DEFAULT_REASON, SERVICE_KINDS, SERVICE_REASONS, type ServiceKind, type ServiceReason } from '@/lib/service-task';

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
  /** Pre-chosen driver (from a driver's row). Without it the form offers a driver picker, where "no driver yet" is allowed. */
  driver?: { id: string; name: string } | null;
  /** Drivers to pick from when `driver` isn't given. */
  drivers?: Array<{ id: string; name: string }>;
  /** YYYY-MM-DD to start on (e.g. the day clicked in the calendar). */
  defaultDate?: string;
  /** Inside a sheet/dialog that already has its own title: no heading or tinted frame. */
  embedded?: boolean;
  /** Open on this kind of task (e.g. 'wash' from a car's card). */
  defaultType?: 'pickup' | 'return' | 'service' | 'wash';
  /** Pre-select this fleet car (garage / wash from the vehicles page). */
  defaultVehicleId?: string;
  /**
   * "משימה להיום": a job for the next hours. Opens on "עכשיו", is marked
   * urgent, and asks who gets it — one driver, or the first to tap "אני לוקח".
   * A regular "משימה חדשה" has no urgent options at all.
   */
  todayTask?: boolean;
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

/** Date (YYYY-MM-DD) and time (HH:MM, rounded up to 5 minutes) `minutes` from now, device time. */
function localDateTimeIn(minutes: number): { date: string; time: string } {
  const at = new Date();
  at.setMinutes(at.getMinutes() + minutes);
  at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time: `${pad(at.getHours())}:${pad(at.getMinutes())}` };
}

type TaskKind = 'pickup' | 'return' | 'service' | 'wash';
const TYPE_LABELS: Record<TaskKind, string> = { pickup: 'מסירה', return: 'החזרה', service: 'טיפול ברכב', wash: 'שטיפה' };

type WhenPreset = 'now' | '1h' | '2h' | 'today' | 'tomorrow';
/** "משימה להיום": how soon. */
const TODAY_PRESETS: Array<{ key: WhenPreset; text: string }> = [
  { key: 'now', text: 'עכשיו' },
  { key: '1h', text: 'תוך שעה' },
  { key: '2h', text: 'תוך שעתיים' },
  { key: 'today', text: 'במהלך היום' },
];
/** Regular "משימה חדשה": quick day picks, then any date. */
const DAY_PRESETS: Array<{ key: WhenPreset; text: string }> = [
  { key: 'today', text: 'היום' },
  { key: 'tomorrow', text: 'מחר' },
];

const field = 'min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-base transition focus:border-[#2D5F5F] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10';
const label = 'mb-1.5 block text-sm font-bold text-gray-700';

export default function DriverTaskForm({
  driver: fixedDriver = null,
  drivers = [],
  defaultDate,
  embedded = false,
  defaultType = 'pickup',
  defaultVehicleId = '',
  todayTask = false,
  onCancel,
  onCreated,
  tasksApi = '/api/admin/tasks',
  bookingsApi = '/api/bookings',
}: DriverTaskFormProps) {
  const [mode, setMode] = useState<'new' | 'existing'>(defaultType === 'return' ? 'existing' : 'new');
  const [vehicleMode, setVehicleMode] = useState<'fleet' | 'custom'>('fleet');
  const [type, setType] = useState<'pickup' | 'return' | 'service' | 'wash'>(defaultType);
  const [urgentTo, setUrgentTo] = useState<'driver' | 'first'>('driver');
  const [serviceKind, setServiceKind] = useState<ServiceKind>('garage');
  const [serviceReason, setServiceReason] = useState<ServiceReason>('maintenance');
  const [servicePlace, setServicePlace] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [customVehicleName, setCustomVehicleName] = useState('');
  const [customLicensePlate, setCustomLicensePlate] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [date, setDate] = useState(() => defaultDate || localDateString(0));
  const [pickedDriverId, setPickedDriverId] = useState('');
  const driver = fixedDriver ?? drivers.find((d) => d.id === pickedDriverId) ?? null;
  const [time, setTime] = useState(() => (todayTask ? localDateTimeIn(0).time : ''));
  const urgent = todayTask;
  // "משימה חדשה" = handovers and returns; "שטיפה" and "טיפול ברכב" open on their own
  // and stay that kind; "משימה להיום" can be any of the four.
  const typeChoices: TaskKind[] = todayTask
    ? ['pickup', 'return', 'wash', 'service']
    : defaultType === 'wash' || defaultType === 'service'
      ? []
      : ['pickup', 'return'];
  const [preset, setPreset] = useState<WhenPreset | null>(todayTask ? 'now' : defaultDate && defaultDate !== localDateString(0) ? null : 'today');

  /** "עכשיו" / "תוך שעה" / "תוך שעתיים" set today + a time; "היום" / "מחר" just the day. */
  const applyPreset = (key: WhenPreset) => {
    setPreset(key);
    if (key === 'today' || key === 'tomorrow') {
      setDate(localDateString(key === 'today' ? 0 : 1));
      setTime('');
      return;
    }
    const at = localDateTimeIn(key === 'now' ? 0 : key === '1h' ? 60 : 120);
    setDate(at.date);
    setTime(at.time);
  };

  const presetChip = (active: boolean) => {
    return `min-h-11 rounded-full px-4 text-sm font-black transition ${
      active ? 'bg-[#2D5F5F] text-white shadow-sm' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'
    }`;
  };
  const [planReturn, setPlanReturn] = useState(false);
  const [returnDate, setReturnDate] = useState(() => {
    const base = new Date(`${defaultDate || localDateString(0)}T12:00:00`);
    base.setDate(base.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
  });
  const [returnTime, setReturnTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { items: vehicles } = useApiList<Vehicle>(
    mode === 'new' && vehicleMode === 'fleet' ? (type === 'service' || type === 'wash' ? '/api/driver/vehicles?all=1' : '/api/driver/vehicles') : null
  );
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
    const broadcast = urgent && urgentTo === 'first';
    if (urgent && urgentTo === 'driver' && !driver) return setError('יש לבחור נהג, או לבחור "לראשון שלוקח"');
    if (type === 'service' || type === 'wash') {
      if (!date) return setError('יש לבחור תאריך');
      if (type === 'wash' && !driver && !broadcast) return setError('יש לבחור נהג לשטיפה');
      if (vehicleMode === 'fleet' && !vehicleId) return setError('יש לבחור רכב');
      if (vehicleMode === 'custom' && !customLicensePlate.trim() && !customVehicleName.trim()) return setError('יש לכתוב מספר רישוי או שם רכב');
      setCreating(true);
      try {
        const response = await fetch(tasksApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'service',
            serviceKind: type === 'wash' ? 'wash' : serviceKind,
            serviceReason: type === 'wash' ? 'wash' : serviceReason,
            servicePlace: servicePlace.trim() || undefined,
            vehicleId: vehicleMode === 'fleet' ? vehicleId : undefined,
            customVehicleName: vehicleMode === 'custom' ? customVehicleName : undefined,
            customLicensePlate: vehicleMode === 'custom' || fleetPlateMissing ? customLicensePlate : undefined,
            scheduledAt: new Date(`${date}T${time || '12:00'}:00`).toISOString(),
            scheduledTime: time || undefined,
            location: location || undefined,
            notes: notes || undefined,
            assignedDriverId: broadcast ? null : driver?.id ?? null,
            urgent: urgent || undefined,
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return setError(json?.error || 'יצירת המשימה נכשלה');
        onCreated();
      } finally {
        setCreating(false);
      }
      return;
    }
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
          assignedDriverId: broadcast ? null : driver?.id ?? null,
          urgent: urgent || undefined,
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

  const chooseType = (next: 'pickup' | 'return' | 'service' | 'wash') => {
    setType(next);
    if (next === 'service' || next === 'wash') {
      setMode('new');
      return;
    }
    // A return belongs to the rental where the car was handed over, so the
    // driver sees the handover damage in grey. Default to picking that booking.
    setMode(next === 'return' ? 'existing' : 'new');
  };

  const tab = (active: boolean) =>
    `min-h-11 flex-1 rounded-xl text-base font-black transition ${active ? 'bg-white text-[#0D2B2B] shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`;

  const vehicleBlock = (
    <>
              <span className={label}>רכב</span>
              <div className="mb-2 flex gap-1 rounded-2xl bg-gray-100 p-1">
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
            
    </>
  );

  const chip = (active: boolean) =>
    `min-h-11 rounded-full px-4 text-sm font-black transition ${active ? 'bg-[#5B5BD6] text-white shadow-sm' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'}`;


  return (
    <form onSubmit={createTask} className={embedded ? 'space-y-5' : 'space-y-5 border-t border-orange-100 bg-orange-50/40 p-4 sm:p-6'}>
      {!embedded && (
        <div>
          <h3 className="text-lg font-black text-gray-900">{fixedDriver ? `משימה חדשה עבור ${fixedDriver.name}` : 'משימה חדשה'}</h3>
          <p className="text-sm text-gray-500">המשימה תופיע אצל הנהג ביום שנבחר, והוא יקבל התראה לטלפון</p>
        </div>
      )}

      {todayTask && (
        <div>
          <span className={label}>למי לשלוח?</span>
          <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
            <button type="button" onClick={() => setUrgentTo('driver')} className={tab(urgentTo === 'driver')}>{fixedDriver ? fixedDriver.name : 'לנהג מסוים'}</button>
            <button type="button" onClick={() => setUrgentTo('first')} className={tab(urgentTo === 'first')}>לראשון שלוקח</button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {urgentTo === 'first'
              ? 'כל הנהגים יקבלו התראה. הראשון שילחץ "אני לוקח" יקבל את המשימה.'
              : 'הנהג יקבל התראה מיד, והמשימה תופיע אצלו ראשונה.'}
          </p>
        </div>
      )}

      {!fixedDriver && !(urgent && urgentTo === 'first') && (
        <label className="block">
          <span className={label}>{type === 'wash' ? 'איזה נהג?' : 'נהג'}</span>
          <select value={pickedDriverId} onChange={(event) => setPickedDriverId(event.target.value)} className={field}>
            <option value="">{type === 'wash' || todayTask ? 'בחרו נהג' : 'עוד לא — אשייך נהג אחר כך'}</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}

      {typeChoices.length > 1 && (
        <div>
          <span className={label}>סוג משימה</span>
          <div className={`grid gap-1 rounded-2xl bg-gray-100 p-1 ${typeChoices.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            {typeChoices.map((t) => (
              <button key={t} type="button" onClick={() => chooseType(t)} className={tab(type === t)}>{TYPE_LABELS[t]}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className={label}>מתי</span>
        <div className="mb-2 flex flex-wrap gap-2">
          {(todayTask ? TODAY_PRESETS : DAY_PRESETS).map(({ key, text }) => (
            <button key={key} type="button" onClick={() => applyPreset(key)} className={presetChip(preset === key)}>
              {text}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {!todayTask && (
            <label className="block">
              <span className={label}>תאריך</span>
              <input type="date" value={date} min={localDateString(0)} onChange={(event) => { setDate(event.target.value); setPreset(null); }} className={field} required />
            </label>
          )}
          <label className="block">
            <span className={label}>{todayTask ? 'שעה' : 'שעה (לא חובה)'}</span>
            <input type="time" value={time} onChange={(event) => { setTime(event.target.value); setPreset(null); }} className={field} />
          </label>
        </div>
      </div>

      {type === 'service' && (
        <div className="space-y-5 rounded-3xl bg-indigo-50/50 p-4 ring-1 ring-indigo-100">
          <div>
            <span className={label}>לאן הרכב נוסע?</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SERVICE_KINDS) as ServiceKind[]).filter((k) => k !== 'wash').map((k) => (
                <button key={k} type="button" onClick={() => { setServiceKind(k); setServiceReason(DEFAULT_REASON[k]); }} className={chip(serviceKind === k)}>{SERVICE_KINDS[k]}</button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>סיבה</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SERVICE_REASONS) as ServiceReason[]).filter((r) => r !== 'wash').map((r) => (
                <button key={r} type="button" onClick={() => setServiceReason(r)} className={chip(serviceReason === r)}>{SERVICE_REASONS[r]}</button>
              ))}
            </div>
          </div>
          <label className="block"><span className={label}>מה צריך לעשות? (לא חובה)</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="לדוגמה: נורית מנוע דולקת, רעש בבלמים" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base focus:border-[#2D5F5F] focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10" />
          </label>
          <label className="block"><span className={label}>שם המקום (לא חובה)</span>
            <input value={servicePlace} onChange={(event) => setServicePlace(event.target.value)} placeholder="לדוגמה: מוסך יוסי" className={field} />
          </label>
          <div>{vehicleBlock}</div>
        </div>
      )}

      {type === 'wash' && (
        <div className="space-y-4 rounded-3xl bg-sky-50/60 p-4 ring-1 ring-sky-100">
          <div>{vehicleBlock}</div>
          <label className="block"><span className={label}>איפה? (לא חובה)</span>
            <input value={servicePlace} onChange={(event) => setServicePlace(event.target.value)} placeholder="לדוגמה: שטיפת הדר, או בסניף" className={field} />
          </label>
          <label className="block"><span className={label}>הערות (לא חובה)</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="לדוגמה: גם ניקוי פנים" className={field} />
          </label>
        </div>
      )}

      {type !== 'service' && type !== 'wash' && (
      <div>
        <span className={label}>{type === 'return' ? 'של איזה לקוח ההחזרה?' : 'הלקוח'}</span>
        <div className="mb-3 flex gap-1 rounded-2xl bg-gray-100 p-1">
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
                <button type="button" key={booking.id} onClick={() => setBookingId(booking.id)} className={`min-h-14 w-full rounded-2xl border px-4 py-2.5 text-right text-base transition ${bookingId === booking.id ? 'border-[#2D5F5F] bg-[#eef6f6] ring-2 ring-[#2D5F5F]/15' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
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
            <div className="sm:col-span-2">{vehicleBlock}</div>
          </div>
        )}
      </div>
      )}

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
              <p className="col-span-2 text-sm text-gray-600">{driver ? `משימת ההחזרה תשויך ל${driver.name}.` : 'משימת ההחזרה תיפתח בלי נהג.'} אפשר להעביר אותה לנהג אחר אחר כך.</p>
            </div>
          )}
        </div>
      )}

      <label className="block"><span className={label}>{type === 'service' || type === 'wash' ? 'כתובת המקום — לוויז (לא חובה)' : 'כתובת ללקוח — לוויז (לא חובה)'}</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="רחוב, מספר, עיר" className={field} />
      </label>
      {type !== 'service' && type !== 'wash' && <label className="block"><span className={label}>הערות לנהג (לא חובה)</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-base focus:border-[#2D5F5F] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10" />
      </label>}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={creating} className="min-h-14 flex-[2] rounded-2xl bg-[#E8743B] text-base font-black text-white shadow-sm shadow-orange-200 transition hover:bg-[#d4632a] disabled:opacity-50">{creating ? 'שולח…' : urgent && urgentTo === 'first' ? 'שליחה לכל הנהגים' : type === 'wash' && driver ? `שליחה לשטיפה עם ${driver.name}` : driver ? `שליחה ל${driver.name}` : 'יצירת משימה'}</button>
        <button type="button" onClick={onCancel} className="min-h-14 flex-1 rounded-2xl bg-gray-100 text-base font-bold text-gray-600 hover:bg-gray-200">ביטול</button>
      </div>
    </form>
  );
}
