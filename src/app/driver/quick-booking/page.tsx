'use client';

import { useEffect, useState } from 'react';
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

interface HandoverOption {
  inspectionId: string;
  bookingId: string | null;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  signedAt: string | null;
  marks: unknown[];
}

/** Return: find the customer's signed handover and continue on that same rental. */
function ReturnPicker({ onNotFound }: { onNotFound: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<HandoverOption[]>([]);
  const [searching, setSearching] = useState(false);
  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/driver/inspections/handover?search=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((json) => setResults(json?.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const shown = query.length >= 2 ? results : [];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <label className="block font-black text-gray-800 mb-1" htmlFor="return-search">של איזה לקוח ההחזרה?</label>
      <p className="mb-3 text-sm text-gray-500">בחר את הלקוח — הנזקים מהמסירה יופיעו באפור, ותסמן רק נזקים חדשים.</p>
      <div className="relative mb-3">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-5 w-5 text-gray-400" aria-hidden="true" />
        <input
          id="return-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="שם הלקוח או לוחית רישוי"
          autoFocus
          className="w-full min-h-14 ps-11 pe-3 rounded-xl border-2 border-gray-200 text-base"
        />
      </div>
      <div className="space-y-2">
        {shown.map((h) => (
          <button
            key={h.inspectionId}
            type="button"
            disabled={!h.bookingId}
            onClick={() => router.push(`/driver/inspection/new?bookingId=${encodeURIComponent(h.bookingId ?? '')}&type=return`)}
            className="w-full min-h-16 rounded-xl border-2 border-gray-200 px-4 py-2 text-right active:border-[#E8743B] active:bg-orange-50 disabled:opacity-40"
          >
            <span className="block text-base font-black text-gray-900">{h.customerName}</span>
            <span className="block text-sm text-gray-500">
              {h.vehicleName}
              {h.licensePlate && h.licensePlate !== '—' ? <> · <span dir="ltr">{h.licensePlate}</span></> : null}
              {h.signedAt ? ` · נמסר ${new Date(h.signedAt).toLocaleDateString('he-IL')}` : ''}
              {h.marks.length ? ` · ${h.marks.length} נזקים` : ''}
            </span>
          </button>
        ))}
        {searching && <p className="py-3 text-center text-sm text-gray-400">מחפש…</p>}
        {!searching && query.length >= 2 && shown.length === 0 && (
          <p className="py-3 text-center text-sm text-gray-400">לא נמצאה מסירה חתומה ללקוח הזה</p>
        )}
      </div>
      <button type="button" onClick={onNotFound} className="mt-3 min-h-12 w-full rounded-xl border-2 border-dashed border-gray-300 text-base font-bold text-gray-600">
        לא מוצא? הזנת פרטים ידנית
      </button>
    </div>
  );
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
  const [customLicensePlate, setCustomLicensePlate] = useState('');
  const [type, setType] = useState<'pickup' | 'return' | null>(null);
  const [manualReturn, setManualReturn] = useState(false);
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

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  // Every job needs a licence plate: a fleet car without one in the system asks for it.
  const fleetPlateMissing = vehicleMode === 'fleet' && Boolean(selectedVehicle) && !selectedVehicle?.license_plate?.trim();
  const hasVehicle = vehicleMode === 'fleet'
    ? Boolean(vehicleId) && (!fleetPlateMissing || Boolean(customLicensePlate.trim()))
    : Boolean(customLicensePlate.trim());
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
          customLicensePlate: vehicleMode === 'custom' || fleetPlateMissing ? customLicensePlate : undefined,
          type,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'לא הצלחנו ליצור את המשימה. נסו שוב.');
      router.push(`/driver/inspection/new?bookingId=${json.bookingId}&type=${type}`);
    } catch (err) {
      setError((err as Error)?.message || 'לא הצלחנו ליצור את המשימה. בדקו את הפרטים ונסו שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900 mb-1">בדיקת רכב חדשה</h1>
      <p className="text-gray-500 text-base mb-6">יצירת בדיקת מסירה או החזרה והחתמת הלקוח</p>

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="block font-black text-gray-800 mb-3">בחרו את סוג הבדיקה</span>
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
              onClick={() => { setType('return'); setManualReturn(false); }}
              className={`min-h-14 rounded-xl border-2 font-black ${type === 'return' ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]' : 'border-gray-200 text-gray-600'}`}
            >
              בדיקת החזרה
            </button>
          </div>
        </div>

        {type === 'return' && !manualReturn && <ReturnPicker onNotFound={() => setManualReturn(true)} />}

        {(type === 'pickup' || (type === 'return' && manualReturn)) && (
        <>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">שם הלקוח</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">טלפון</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              type="tel"
              dir="ltr"
              className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">אימייל הלקוח (חובה)</label>
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
            <label className="block text-sm font-bold text-gray-600 mb-1">כתובת (לוויז, לא חובה)</label>
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
            <button type="button" onClick={() => setVehicleMode('fleet')} className={`min-h-12 rounded-xl border-2 text-base font-black ${vehicleMode === 'fleet' ? 'border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F]' : 'border-gray-200 text-gray-600'}`}>
              רכב מהצי
            </button>
            <button type="button" onClick={() => setVehicleMode('custom')} className={`min-h-12 rounded-xl border-2 text-base font-black ${vehicleMode === 'custom' ? 'border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F]' : 'border-gray-200 text-gray-600'}`}>
              רכב שאינו ברשימה
            </button>
          </div>
          {vehicleMode === 'fleet' ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} placeholder="חיפוש לפי דגם / לוחית רישוי" className="w-full min-h-12 ps-10 pe-3 rounded-xl border-2 border-gray-200 text-base" />
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
              {fleetPlateMissing && (
                <label className="mt-3 block rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                  <span className="block text-sm font-bold text-amber-900 mb-1">מספר הרישוי של הרכב חסר במערכת. הזינו אותו כדי להמשיך.</span>
                  <input value={customLicensePlate} onChange={(e) => setCustomLicensePlate(e.target.value)} inputMode="numeric" dir="ltr" placeholder="12-345-67" required className="w-full min-h-12 rounded-xl border-2 border-gray-200 bg-white px-3 text-base" />
                </label>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm font-bold text-gray-600 mb-1">מספר רישוי</span>
                <input value={customLicensePlate} onChange={(e) => setCustomLicensePlate(e.target.value)} inputMode="numeric" dir="ltr" placeholder="12-345-67" required className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base" />
              </label>
              <label className="block">
                <span className="block text-sm font-bold text-gray-600 mb-1">שם הרכב (לא חובה)</span>
                <input value={customVehicleName} onChange={(e) => setCustomVehicleName(e.target.value)} placeholder="לדוגמה: טויוטה קורולה לבנה" className="w-full min-h-12 rounded-xl border-2 border-gray-200 px-3 text-base" />
              </label>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full min-h-14 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 text-white font-black text-lg"
        >
          {submitting ? 'יוצר את הבדיקה…' : 'המשך לפרטי הבדיקה'}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
