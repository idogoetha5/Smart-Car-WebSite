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
  vehicle: { make: string; model: string } | null;
}

interface DriverTaskFormProps {
  driver: { id: string; name: string };
  onCancel: () => void;
  onCreated: () => void;
}

export default function DriverTaskForm({ driver, onCancel, onCreated }: DriverTaskFormProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [vehicleMode, setVehicleMode] = useState<'fleet' | 'custom'>('fleet');
  const [type, setType] = useState<'pickup' | 'return'>('pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [customVehicleName, setCustomVehicleName] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { items: vehicles } = useApiList<Vehicle>(mode === 'new' && vehicleMode === 'fleet' ? '/api/driver/vehicles' : null);
  const { items: bookings } = useApiList<BookingOption>(mode === 'existing' ? '/api/bookings' : null);

  const filteredBookings = useMemo(() => {
    if (!bookingSearch.trim()) return bookings.slice(0, 20);
    const needle = bookingSearch.toLowerCase();
    return bookings
      .filter((booking) => booking.customer_name?.toLowerCase().includes(needle) || numericOrderReference(booking.id) === bookingSearch.trim())
      .slice(0, 20);
  }, [bookings, bookingSearch]);

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'existing' && !bookingId) {
      setError('יש לבחור הזמנה קיימת');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/tasks', {
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
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          location: location || undefined,
          notes: notes || undefined,
          assignedDriverId: driver.id,
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

  return (
    <form onSubmit={createTask} className="space-y-4 border-t border-orange-100 bg-orange-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-gray-900">משימה חדשה עבור {driver.name}</h3>
          <p className="text-xs text-gray-500">המשימה תשויך אוטומטית לנהג הזה</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('new')} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${mode === 'new' ? 'bg-[#2D5F5F] text-white' : 'bg-white text-gray-600'}`}>הזמנה חדשה</button>
          <button type="button" onClick={() => setMode('existing')} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${mode === 'existing' ? 'bg-[#2D5F5F] text-white' : 'bg-white text-gray-600'}`}>הזמנה קיימת</button>
        </div>
      </div>

      {mode === 'new' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="שם הלקוח" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" required />
            <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="טלפון" dir="ltr" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" required />
            <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="אימייל הלקוח (חובה)" dir="ltr" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" required />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => setVehicleMode('fleet')} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${vehicleMode === 'fleet' ? 'bg-[#2D5F5F] text-white' : 'bg-gray-100 text-gray-600'}`}>רכב מהצי</button>
              <button type="button" onClick={() => setVehicleMode('custom')} className={`min-h-9 rounded-lg px-3 text-xs font-bold ${vehicleMode === 'custom' ? 'bg-[#2D5F5F] text-white' : 'bg-gray-100 text-gray-600'}`}>רכב שלא ברשימה</button>
            </div>
            {vehicleMode === 'fleet' ? (
              <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" required>
                <option value="">בחר רכב</option>
                {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} {vehicle.license_plate ? `— ${vehicle.license_plate}` : ''}</option>)}
              </select>
            ) : (
              <input value={customVehicleName} onChange={(event) => setCustomVehicleName(event.target.value)} placeholder="שם הרכב, לדוגמה: טויוטה קורולה לבנה" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" required />
            )}
          </div>
        </div>
      ) : (
        <div>
          <input value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="חיפוש לפי שם לקוח / מספר הזמנה" className="mb-2 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {filteredBookings.map((booking) => (
              <button type="button" key={booking.id} onClick={() => setBookingId(booking.id)} className={`min-h-10 w-full rounded-lg border-2 px-3 text-right text-sm ${bookingId === booking.id ? 'border-[#E8743B] bg-orange-50' : 'border-transparent bg-white'}`}>
                {booking.customer_name} — {bookingVehicleName(booking)} — #{numericOrderReference(booking.id)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select value={type} onChange={(event) => setType(event.target.value as 'pickup' | 'return')} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="pickup">מסירה</option><option value="return">החזרה</option></select>
        <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="כתובת ללקוח — לוויז (לא חובה)" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm" />
      </div>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="הערות" rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={creating} className="min-h-11 rounded-xl bg-[#E8743B] px-5 text-sm font-black text-white hover:bg-[#d4632a] disabled:opacity-50">{creating ? 'יוצר...' : `הקצאה ל${driver.name}`}</button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-600 hover:bg-gray-50">ביטול</button>
      </div>
    </form>
  );
}
