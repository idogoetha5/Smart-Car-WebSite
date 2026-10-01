'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/AppToast';
import { useManager } from './ManagerData';

const field = 'min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-base focus:border-[#2D5F5F] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10';

/** Admin only: branch managers (they use smartcar.co.il/manager with a name + 4-digit code). */
export default function ManagersSection() {
  const { managers, peopleApi, mutatePeople } = useManager();
  const toast = useToast();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');

  const send = async (url: string, method: string, body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(json?.error || 'הפעולה נכשלה', false);
      return false;
    }
    toast(ok);
    void mutatePeople();
    return true;
  };

  return (
    <section className="mt-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-black text-[#0D2B2B]"><ShieldCheck className="h-5 w-5 text-[#2D5F5F]" aria-hidden="true" />מנהלי סניפים</h2>
      <p className="mb-4 text-sm text-gray-500">נכנסים ב־smartcar.co.il/manager עם השם וקוד של 4 ספרות, בלי גישה לאדמין.</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !/^\d{4}$/.test(pin)) return toast('שם וקוד של 4 ספרות', false);
          if (await send(peopleApi, 'POST', { name: name.trim(), pin, role: 'manager' }, `${name.trim()} נוסף כמנהל`)) {
            setName('');
            setPin('');
          }
        }}
        className="mb-5 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המנהל" className={field} />
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="קוד" inputMode="numeric" dir="ltr" className={field} />
        <button disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#2D5F5F] px-5 text-sm font-black text-white disabled:opacity-50">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          הוספה
        </button>
      </form>

      {managers.length === 0 ? (
        <p className="text-sm text-gray-400">אין מנהלים עדיין</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {managers.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={m.name} />
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-[#0D2B2B]">{m.name}</span>
                  <span className={`text-xs font-bold ${m.active ? 'text-green-700' : 'text-gray-400'}`}>{m.active ? 'פעיל' : 'מושבת'}</span>
                </span>
                <button onClick={() => { setPinFor(pinFor === m.id ? null : m.id); setNewPin(''); }} className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-[#2D5F5F] hover:bg-[#eef6f6]">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  קוד חדש
                </button>
                <button
                  disabled={busy}
                  onClick={() => send(`${peopleApi}/${m.id}`, 'PATCH', { active: !m.active }, m.active ? `${m.name} הושבת` : `${m.name} הופעל`)}
                  className={`min-h-11 rounded-full px-4 text-sm font-bold ${m.active ? 'text-red-600 hover:bg-red-50' : 'bg-[#eef6f6] text-[#2D5F5F]'}`}
                >
                  {m.active ? 'השבתה' : 'הפעלה'}
                </button>
              </div>
              {pinFor === m.id && (
                <div className="mt-3 flex gap-2">
                  <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 ספרות" inputMode="numeric" dir="ltr" className={field} />
                  <button
                    disabled={busy || newPin.length !== 4}
                    onClick={async () => { if (await send(`${peopleApi}/${m.id}`, 'PATCH', { pin: newPin }, 'הקוד עודכן')) setPinFor(null); }}
                    className="min-h-12 shrink-0 rounded-2xl bg-[#2D5F5F] px-5 text-sm font-black text-white disabled:opacity-40"
                  >
                    שמירה
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
