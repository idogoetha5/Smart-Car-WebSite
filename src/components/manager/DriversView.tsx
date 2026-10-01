'use client';

import { useMemo, useState } from 'react';
import { Bell, BellOff, KeyRound, Plus, UserPlus, Users, UserX } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/AppToast';
import { byWhen, taskWhen } from '@/lib/task-schedule';
import { useManager } from './ManagerData';
import TaskRow, { TaskList } from './TaskRow';
import type { ManagerDriver } from './types';

const field = 'min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 text-base focus:border-[#2D5F5F] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2D5F5F]/10';

/** The team: one card per driver (load today/tomorrow, notifications), tap for their tasks and settings. */
export default function DriversView() {
  const { drivers, liveTasks, today, tomorrow, peopleApi, mutatePeople, openNewTask, loading } = useManager();
  const toast = useToast();
  const [openId, setOpenId] = useState<string | 'unassigned' | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);

  const upcoming = useMemo(() => liveTasks.filter((t) => taskWhen(t).day >= today || t.status === 'open'), [liveTasks, today]);
  const load = (id: string | null) => {
    const mine = upcoming.filter((t) => t.assigned_driver_id === id);
    return {
      today: mine.filter((t) => taskWhen(t).day === today).length,
      tomorrow: mine.filter((t) => taskWhen(t).day === tomorrow).length,
      list: [...mine].sort(byWhen),
    };
  };
  const unassigned = load(null).list.filter((t) => t.status === 'open');
  const open = openId && openId !== 'unassigned' ? drivers.find((d) => d.id === openId) ?? null : null;
  const sorted = [...drivers].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'he'));

  const addDriver = async () => {
    if (!name.trim() || !/^\d{4}$/.test(pin)) {
      toast('שם וקוד של 4 ספרות', false);
      return;
    }
    setBusy(true);
    const res = await fetch(peopleApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), pin, role: 'driver' }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(json?.error || 'ההוספה נכשלה', false);
    toast(`${name.trim()} נוסף לצוות`);
    setName('');
    setPin('');
    setAdding(false);
    void mutatePeople();
  };

  const update = async (driver: ManagerDriver, body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const res = await fetch(`${peopleApi}/${driver.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return toast('העדכון נכשל', false);
    toast(ok);
    void mutatePeople();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0D2B2B]">נהגים</h1>
          <p className="mt-1 text-sm text-slate-500">{drivers.filter((d) => d.active).length} נהגים פעילים · עומס עבודה והתראות</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#2D5F5F] shadow-sm hover:bg-[#eef6f6]">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          הוספת נהג
        </button>
      </div>

      {unassigned.length > 0 && (
        <button onClick={() => setOpenId('unassigned')} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-start transition hover:bg-amber-100/60">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-amber-700"><UserX className="h-5 w-5" aria-hidden="true" /></span>
          <span className="flex-1">
            <span className="block text-base font-black text-amber-900">{unassigned.length} משימות בלי נהג</span>
            <span className="block text-sm text-amber-800">לחצו כדי לשייך</span>
          </span>
        </button>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white" />)}</div>
      ) : sorted.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((d) => {
            const l = load(d.id);
            return (
              <button
                key={d.id}
                onClick={() => { setOpenId(d.id); setNewPin(''); }}
                className={`flex min-h-28 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${d.active ? '' : 'opacity-60'}`}
              >
                <Avatar name={d.name} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-base font-black text-[#0D2B2B]">{d.name}</span>
                    {d.pushEnabled !== undefined && (d.pushEnabled
                      ? <Bell className="h-4 w-4 shrink-0 text-green-600" aria-label="התראות פעילות" />
                      : <BellOff className="h-4 w-4 shrink-0 text-gray-300" aria-label="התראות כבויות" />)}
                  </span>
                  {d.active ? (
                    <span className="mt-1 flex gap-1.5 text-xs font-bold">
                      <span className="rounded-full bg-[#eef6f6] px-2 py-0.5 text-[#2D5F5F]">היום {l.today}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">מחר {l.tomorrow}</span>
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs font-bold text-gray-400">מושבת</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Users} title="אין נהגים עדיין" action={<button onClick={() => setAdding(true)} className="min-h-12 rounded-2xl bg-[#2D5F5F] px-6 font-black text-white">הוספת נהג</button>} />
      )}

      {/* Driver sheet */}
      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        variant="drawer"
        title={open && (
          <span className="flex items-center gap-3">
            <Avatar name={open.name} />
            <span>
              {open.name}
              <span className="block text-xs font-bold text-gray-400">{open.active ? (open.pushEnabled ? 'התראות פעילות' : 'התראות כבויות') : 'מושבת'}</span>
            </span>
          </span>
        )}
      >
        {open && (
          <div className="space-y-5">
            {open.active && (
              <button onClick={() => { setOpenId(null); openNewTask({ driverId: open.id }); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E8743B] text-base font-black text-white">
                <Plus className="h-5 w-5" aria-hidden="true" />
                משימה חדשה ל{open.name}
              </button>
            )}
            <section>
              <h3 className="mb-2 text-sm font-black text-[#0D2B2B]">משימות קרובות</h3>
              {load(open.id).list.length ? (
                <TaskList>{load(open.id).list.slice(0, 30).map((t) => <TaskRow key={t.id} task={t} showDay />)}</TaskList>
              ) : (
                <p className="rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-500">אין משימות פתוחות</p>
              )}
            </section>
            <section className="rounded-3xl bg-gray-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-[#0D2B2B]"><KeyRound className="h-4 w-4" aria-hidden="true" />קוד כניסה חדש</h3>
              <div className="flex gap-2">
                <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="4 ספרות" dir="ltr" className={field} />
                <button
                  disabled={busy || newPin.length !== 4}
                  onClick={() => update(open, { pin: newPin }, 'הקוד עודכן').then(() => setNewPin(''))}
                  className="min-h-12 shrink-0 rounded-2xl bg-[#2D5F5F] px-5 text-sm font-black text-white disabled:opacity-40"
                >
                  שמירה
                </button>
              </div>
            </section>
            <button
              disabled={busy}
              onClick={() => update(open, { active: !open.active }, open.active ? `${open.name} הושבת` : `${open.name} הופעל`)}
              className={`min-h-12 w-full rounded-2xl text-sm font-black ${open.active ? 'text-red-600 hover:bg-red-50' : 'bg-[#eef6f6] text-[#2D5F5F]'}`}
            >
              {open.active ? 'השבתת הנהג' : 'הפעלת הנהג מחדש'}
            </button>
          </div>
        )}
      </Sheet>

      {/* Unassigned sheet */}
      <Sheet open={openId === 'unassigned'} onClose={() => setOpenId(null)} variant="drawer" title="משימות בלי נהג">
        <TaskList>{unassigned.map((t) => <TaskRow key={t.id} task={t} showDay />)}</TaskList>
      </Sheet>

      {/* Add driver */}
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="נהג חדש"
        footer={
          <button disabled={busy} onClick={addDriver} className="min-h-14 w-full rounded-2xl bg-[#E8743B] text-base font-black text-white disabled:opacity-50">
            {busy ? 'מוסיף…' : 'הוספה לצוות'}
          </button>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">שם</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">קוד כניסה (4 ספרות)</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" dir="ltr" className={field} />
          </label>
          <p className="text-sm text-gray-500">הנהג ייכנס לאפליקציה עם השם והקוד, בכתובת smartcar.co.il/driver.</p>
        </div>
      </Sheet>
    </div>
  );
}
