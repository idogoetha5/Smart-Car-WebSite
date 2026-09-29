'use client';

import { useState } from 'react';
import { RefreshCw, UserPlus, KeyRound } from 'lucide-react';
import { useApiList } from '@/lib/swr';

interface Driver {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export default function AdminDriversPage() {
  const { items: drivers, isLoading, isValidating, mutate } = useApiList<Driver>('/api/admin/drivers');

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const createDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(pin)) {
      setError('הקוד חייב להיות בין 4 ל-6 ספרות');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'יצירת הנהג נכשלה');
        return;
      }
      setName('');
      setPin('');
      mutate((curr) => (curr ? [json.data, ...curr] : [json.data]), { revalidate: false });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (driver: Driver) => {
    const res = await fetch(`/api/admin/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !driver.active }),
    });
    if (!res.ok) { alert('העדכון נכשל'); return; }
    mutate((curr) => (curr ?? []).map((d) => (d.id === driver.id ? { ...d, active: !driver.active } : d)), { revalidate: false });
  };

  const resetPin = async (driver: Driver) => {
    const newPin = window.prompt(`קוד חדש עבור ${driver.name} (4–6 ספרות)`);
    if (!newPin) return;
    if (!/^\d{4,6}$/.test(newPin)) { alert('הקוד חייב להיות בין 4 ל-6 ספרות'); return; }
    const res = await fetch(`/api/admin/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    });
    if (!res.ok) { alert('איפוס הקוד נכשל'); return; }
    alert('הקוד עודכן');
  };

  return (
    <div className="p-4 sm:p-8" dir="rtl">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">נהגים</h1>
          <p className="mt-1 text-gray-500">{drivers.length} נהגים</p>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isValidating}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
          רענון
        </button>
      </div>

      <form onSubmit={createDriver} className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">שם הנהג</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">קוד (4–6 ספרות)</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            required
            className="min-h-11 w-32 rounded-xl border border-gray-200 px-3 text-sm" dir="ltr"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] px-4 text-sm font-black text-white disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          הוספת נהג
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="p-4 font-semibold">שם</th>
                <th className="p-4 font-semibold">סטטוס</th>
                <th className="p-4 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="p-4 font-bold text-gray-900">{driver.name}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${driver.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {driver.active ? 'פעיל' : 'מושבת'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(driver)}
                        className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      >
                        {driver.active ? 'השבתה' : 'הפעלה'}
                      </button>
                      <button
                        onClick={() => resetPin(driver)}
                        className="flex items-center gap-1 rounded-lg bg-[#eef6f6] px-3 py-1.5 text-xs font-bold text-[#2D5F5F] hover:bg-[#d9ecec]"
                      >
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        איפוס קוד
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400">אין נהגים עדיין</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
