'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Search } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { isValidEmail } from '@/lib/email';

interface VehicleOption {
  id: string;
  make: string;
  model: string;
  license_plate: string | null;
  price_per_day: number;
}

export default function DriverQuickBookingPage() {
  const router = useRouter();
  const { data } = useSWR<{ data: VehicleOption[] }>('/api/driver/vehicles', fetcher, {
    dedupingInterval: 5 * 60_000,
    revalidateOnFocus: false,
  });
  const vehicles = data?.data ?? [];

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [location, setLocation] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleMode, setVehicleMode] = useState<'fleet' | 'custom'>('fleet');
  const [customVehicleName, setCustomVehicleName] = useState('');
  const [type, setType] = useState<'pickup' | 'return' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const filteredVehicles = vehicleSearch
    ? vehicles.filter((v) => {
        const needle = vehicleSearch.toLowerCase();
        return (
          v.make.toLowerCase().includes(needle) ||
          v.model.toLowerCase().includes(needle) ||
          (v.license_plate ?? '').toLowerCase().includes(needle.replace(/[\s-]/g, ''))
        );
      })
    : vehicles;

  const hasVehicle = vehicleMode === 'fleet'
    ? Boolean(vehicleId)
    : Boolean(customVehicleName.trim());
  const canSubmit = customerName.trim() !== '' && customerPhone.trim() !== '' && customerEmail.trim() !== '' && hasVehicle && type && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!isValidEmail(customerEmail)) {
      setError('יש להזין כתובת אימייל תקינה של הלקוח');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/driver/quick-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          location: location.trim() || undefined,
          vehicleId: vehicleMode === 'fleet' ? vehicleId : undefined,
          customVehicleName: vehicleMode === 'custom' ? customVehicleName : undefined,
          type,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'יצירת ההזמנה נכשלה');
      router.push(`/driver/inspection/new?bookingId=${json.bookingId}&type=${type}`);
    } catch (err) {
      setError((err as Error)?.message || 'משהו השתבש. נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900 mb-1">משימה חדשה</h1>
      <p className="text-gray-500 text-sm mb-6">להזמנה שעדיין לא קיימת במערכת</p>

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">שם הלקוח</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">טלפון</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              type="tel"
              dir="ltr"
              className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">אימייל הלקוח (חובה)</label>
            <input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              type="email"
              required
              dir="ltr"
              className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">כתובת (לוויז, לא חובה)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="רחוב, מספר, עיר"
              className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="block font-black text-gray-800 mb-3">רכב</label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setVehicleMode('fleet')} className={`min-h-11 rounded-xl border-2 text-sm font-black ${vehicleMode === 'fleet' ? 'border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F]' : 'border-gray-200 text-gray-600'}`}>
              רכב מהצי
            </button>
            <button type="button" onClick={() => setVehicleMode('custom')} className={`min-h-11 rounded-xl border-2 text-sm font-black ${vehicleMode === 'custom' ? 'border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F]' : 'border-gray-200 text-gray-600'}`}>
              רכב שלא ברשימה
            </button>
          </div>
          {vehicleMode === 'fleet' ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} placeholder="חיפוש לפי דגם / לוחית רישוי" className="w-full min-h-11 ps-10 pe-3 rounded-xl border-2 border-gray-200 text-sm" />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {filteredVehicles.map((v) => (
                  <button key={v.id} type="button" onClick={() => setVehicleId(v.id)} className={`w-full text-right min-h-14 rounded-xl border-2 px-3 flex items-center justify-between ${vehicleId === v.id ? 'border-[#E8743B] bg-orange-50' : 'border-gray-200'}`}>
                    <span className="font-bold text-gray-800">{v.make} {v.model}</span>
                    <span className="text-sm text-gray-500" dir="ltr">{v.license_plate ?? '—'}</span>
                  </button>
                ))}
                {filteredVehicles.length === 0 && <p className="text-center text-gray-400 text-sm py-4">לא נמצאו רכבים</p>}
              </div>
            </>
          ) : (
            <input value={customVehicleName} onChange={(e) => setCustomVehicleName(e.target.value)} placeholder="כתוב את שם הרכב" className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base" />
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="block font-black text-gray-800 mb-3">סוג בדיקה</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('pickup')}
              className={`min-h-14 rounded-xl border-2 font-black ${type === 'pickup' ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]' : 'border-gray-200 text-gray-600'}`}
            >
              בדיקת מסירה
            </button>
            <button
              type="button"
              onClick={() => setType('return')}
              className={`min-h-14 rounded-xl border-2 font-black ${type === 'return' ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]' : 'border-gray-200 text-gray-600'}`}
            >
              בדיקת החזרה
            </button>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full min-h-14 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 text-white font-black text-lg"
        >
          {submitting ? 'יוצר הזמנה...' : 'המשך לבדיקה'}
        </button>
      </div>
    </div>
  );
}
