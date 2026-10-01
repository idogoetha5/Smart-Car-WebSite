'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete } from 'lucide-react';

/** Driver PINs are exactly 4 digits. */
const PIN_LENGTH = 4;

interface DriverOption {
  id: string;
  name: string;
}

/** Branch-manager login: same name + 4-digit PIN as drivers, but lists managers only. */
export default function ManagerLoginPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DriverOption | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/driver/login?role=manager')
      .then((res) => res.json())
      .then((json) => setDrivers(json.data ?? []))
      .catch(() => setError('טעינת רשימת המנהלים נכשלה'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (fullPin: string) => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selected.id, pin: fullPin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'קוד שגוי');
        setPin('');
        return;
      }
      router.push('/driver/manage');
      router.refresh();
    } catch {
      setError('החיבור נכשל, נסו שוב');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const tapDigit = (d: string) => {
    if (submitting || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError('');
    // Auto-submit on the 4th digit; a wrong PIN clears back to empty.
    if (next.length === PIN_LENGTH) submit(next);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" aria-busy="true" />;
  }

  if (!selected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8F8] px-4 py-10" dir="rtl">
        <main className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-10">
        <div className="mb-7 flex flex-col items-center gap-2">
          <Image src="/images/logo.png" alt="SmartCar" width={160} height={72} className="h-14 w-auto object-contain" priority />
          <span className="rounded-full bg-[#eef6f6] px-3 py-1 text-sm font-black text-[#2D5F5F]">מנהלים</span>
        </div>
        <h1 className="mb-1 text-center text-3xl font-extrabold tracking-tight text-[#0D2B2B]">כניסה למנהלים</h1>
        <p className="mb-8 text-center text-slate-500">בחרו את שמכם כדי להמשיך</p>
        {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          {drivers.map((driver) => (
            <button
              key={driver.id}
              onClick={() => setSelected(driver)}
              className="min-h-20 rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#2D5F5F] hover:shadow-md active:border-[#E8743B]"
            >
              {driver.name}
            </button>
          ))}
        </div>
        {drivers.length === 0 && (
          <p className="text-center text-gray-400 mt-8">אין מנהלים פעילים. פנו למשרד.</p>
        )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F8F8] px-4 py-10" dir="rtl">
      <main className="flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-9">
      <Image src="/images/logo.png" alt="SmartCar" width={128} height={58} className="mb-4 h-11 w-auto object-contain" priority />
      <h1 className="text-2xl font-black text-[#0D2B2B] mb-1">שלום, {selected.name}</h1>
      <button onClick={() => { setSelected(null); setPin(''); setError(''); }} className="text-sm text-[#2D5F5F] font-bold mb-6">
        לא אני? חזרה
      </button>

      <div className="flex gap-3 mb-6" dir="ltr" aria-live="polite">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'bg-[#2D5F5F] border-[#2D5F5F]' : 'border-gray-300'}`}
          />
        ))}
      </div>

      {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

      {/* Phone-style keypad: 1-2-3 left to right even though the page is RTL. */}
      <div className="grid w-full max-w-xs grid-cols-3 gap-3" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            disabled={submitting}
            onClick={() => tapDigit(d)}
            className="min-h-16 rounded-2xl bg-white border-2 border-gray-200 text-2xl font-black text-gray-800 active:bg-gray-100"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          disabled={submitting || pin.length === 0}
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="min-h-16 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30"
        >
          <Delete className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => tapDigit('0')}
          className="min-h-16 rounded-2xl bg-white border-2 border-gray-200 text-2xl font-black text-gray-800 active:bg-gray-100"
        >
          0
        </button>
        <button
          type="button"
          disabled={submitting || pin.length < PIN_LENGTH}
          onClick={() => submit(pin)}
          className="min-h-16 rounded-2xl bg-[#E8743B] disabled:opacity-30 text-white font-black"
        >
          כניסה
        </button>
      </div>
      </main>
    </div>
  );
}
