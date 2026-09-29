'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete } from 'lucide-react';

interface DriverOption {
  id: string;
  name: string;
}

export default function DriverLoginPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DriverOption | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/driver/login')
      .then((res) => res.json())
      .then((json) => setDrivers(json.data ?? []))
      .catch(() => setError('טעינת רשימת הנהגים נכשלה'))
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
      router.push('/driver');
      router.refresh();
    } catch {
      setError('החיבור נכשל, נסו שוב');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const tapDigit = (d: string) => {
    if (submitting || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length >= 4) {
      // Auto-submit once a plausible PIN length is reached; a wrong PIN
      // just clears back to empty via the error path above.
      if (next.length === 6) submit(next);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" aria-busy="true" />;
  }

  if (!selected) {
    return (
      <div className="min-h-screen px-4 py-10" dir="rtl">
        <h1 className="text-2xl font-black text-gray-900 text-center mb-1">SmartCar נהגים</h1>
        <p className="text-gray-500 text-center mb-8">בחרו את שמכם</p>
        {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          {drivers.map((driver) => (
            <button
              key={driver.id}
              onClick={() => setSelected(driver)}
              className="min-h-20 rounded-2xl border-2 border-gray-200 bg-white font-black text-lg text-gray-800 hover:border-[#2D5F5F] transition-colors"
            >
              {driver.name}
            </button>
          ))}
        </div>
        {drivers.length === 0 && (
          <p className="text-center text-gray-400 mt-8">אין נהגים פעילים. פנו למשרד.</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 flex flex-col items-center" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900 mb-1">שלום, {selected.name}</h1>
      <button onClick={() => { setSelected(null); setPin(''); setError(''); }} className="text-sm text-[#2D5F5F] font-bold mb-6">
        לא אני? חזרה
      </button>

      <div className="flex gap-3 mb-6" dir="ltr" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'bg-[#2D5F5F] border-[#2D5F5F]' : 'border-gray-300'}`}
          />
        ))}
      </div>

      {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-3 max-w-xs w-full">
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
          disabled={submitting || pin.length < 4}
          onClick={() => submit(pin)}
          className="min-h-16 rounded-2xl bg-[#E8743B] disabled:opacity-30 text-white font-black"
        >
          כניסה
        </button>
      </div>
    </div>
  );
}
