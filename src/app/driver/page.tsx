'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { preload } from 'swr';
import { Search, LogOut, RefreshCw, Plus, Navigation, Phone, Pencil, MapPin, ClipboardList } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import PendingInspections from '@/components/inspection/PendingInspections';

interface TaskRow {
  taskId: string;
  taskStatus: 'open' | 'done' | 'cancelled';
  type: 'pickup' | 'return';
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  location: string;
  navQuery?: string;
  customerPhone?: string;
  time: string | null;
  inspection: { id: string; status: 'awaiting_signature' | 'signed' } | null;
}

function TaskAction({ row }: { row: TaskRow }) {
  const router = useRouter();
  const label = row.type === 'pickup' ? 'בדיקת מסירה' : 'בדיקת החזרה';

  if (!row.inspection) {
    return (
      <button
        onClick={() => router.push(`/driver/inspection/new?bookingId=${row.bookingId}&type=${row.type}`)}
        className="min-h-12 px-4 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black text-sm whitespace-nowrap"
      >
        {label}
      </button>
    );
  }

  const signed = row.inspection.status === 'signed';
  return (
    <button
      onClick={() => router.push(signed ? `/driver/inspection/${row.inspection!.id}` : `/driver/inspection/${row.inspection!.id}/sign`)}
      className={`min-h-12 px-4 rounded-xl font-black text-sm whitespace-nowrap ${
        signed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {signed ? '✓ נחתם' : 'לחתימת הלקוח'}
    </button>
  );
}

function TaskCard({ row, onChanged }: { row: TaskRow; onChanged: () => void }) {
  const hasAddress = Boolean(row.navQuery);
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(hasAddress ? row.location : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const saveAddress = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/driver/tasks/${encodeURIComponent(row.taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: address.trim() }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      onChanged();
    } catch {
      setSaveError('שמירת הכתובת נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-gray-900 truncate">{row.customerName}</p>
          <p className="text-sm text-gray-500 truncate">{row.vehicleName} · <span dir="ltr">{row.licensePlate}</span></p>
          <p className="text-xs text-gray-400 mt-1">
            {hasAddress ? row.location : 'ללא כתובת'} {row.time ? `· ${row.time.slice(0, 5)}` : ''} · #{row.bookingNumber}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <TaskAction row={row} />
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="כתובת ללקוח — רחוב, מספר, עיר"
            autoFocus
            className="w-full min-h-11 rounded-xl border-2 border-gray-200 px-3 text-base"
          />
          <div className="flex gap-2">
            <button type="button" onClick={saveAddress} disabled={saving} className="min-h-11 flex-1 rounded-xl bg-[#2D5F5F] text-sm font-black text-white disabled:opacity-50">
              {saving ? 'שומר…' : 'שמור כתובת'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-xl border-2 border-gray-200 px-4 text-sm font-black text-gray-600">
              ביטול
            </button>
          </div>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {hasAddress ? (
            <>
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(row.navQuery as string)}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#33CCFF] bg-[#eefbff] text-sm font-black text-[#0a7ea4]"
              >
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Waze
              </a>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="עריכת כתובת"
                className="flex min-h-11 w-11 items-center justify-center rounded-xl border-2 border-gray-200 text-gray-500"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-sm font-black text-gray-500"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              הוסף כתובת לוויז
            </button>
          )}
          {row.customerPhone && (
            <a
              href={`tel:${row.customerPhone.replace(/[^\d+]/g, '')}`}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-green-500 bg-green-50 text-sm font-black text-green-700"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              התקשר ללקוח
            </a>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = 'today' | 'tomorrow' | 'search';

export default function DriverTodayPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('today');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data: me } = useSWR<{ role: string; canManage: boolean }>('/api/driver/me', fetcher, { dedupingInterval: 60_000 });

  const dateQuery = tab === 'tomorrow' ? 'date=tomorrow' : 'date=today';
  const url = tab === 'search'
    ? (search ? `/api/driver/today?search=${encodeURIComponent(search)}` : null)
    : `/api/driver/today?${dateQuery}`;

  const { data, isLoading, isValidating, mutate } = useSWR<{
    pickups?: TaskRow[];
    returns?: TaskRow[];
    results?: TaskRow[];
  }>(url, fetcher, { keepPreviousData: true, dedupingInterval: 10_000 });

  const openQuickBooking = () => {
    // Start loading the fleet before navigation. The destination uses the
    // same SWR key, so it reuses this in-flight request instead of waiting
    // for the new page to hydrate before beginning the network round trip.
    void preload('/api/driver/vehicles', fetcher);
    router.push('/driver/quick-booking');
  };

  const logout = async () => {
    await fetch('/api/driver/login', { method: 'DELETE' });
    router.push('/driver/login');
  };

  return (
    <div className="min-h-screen pb-10" dir="rtl">
      <div className="sticky top-0 z-10 bg-[#F5F0E8]/95 backdrop-blur px-4 pt-6 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black text-gray-900">היום שלי</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => mutate()} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="רענון">
              <RefreshCw className={`h-5 w-5 ${isValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <button onClick={logout} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="יציאה">
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {me?.canManage && (
          <button
            onClick={() => router.push('/driver/manage')}
            className="w-full min-h-12 mb-2 flex items-center justify-center gap-2 rounded-xl bg-[#2D5F5F] text-white font-black"
          >
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            משימות לנהגים (מנהל סניף)
          </button>
        )}

        <button
          onClick={openQuickBooking}
          className="w-full min-h-12 mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          משימה חדשה
        </button>

        <div className="flex gap-2 mb-3">
          {(['today', 'tomorrow', 'search'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 flex-1 rounded-xl font-bold text-sm ${
                tab === t ? 'bg-[#2D5F5F] text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t === 'today' ? 'היום' : t === 'tomorrow' ? 'מחר' : 'חיפוש'}
            </button>
          ))}
        </div>

        {tab === 'search' && (
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
              placeholder="שם לקוח / לוחית רישוי / מספר הזמנה"
              className="w-full min-h-12 ps-10 pe-4 rounded-xl border-2 border-gray-200 text-sm"
            />
          </div>
        )}
      </div>

      <PendingInspections />

      <div className="px-4 pt-4 space-y-6">
        {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />}

        {tab === 'search' ? (
          <div className="space-y-3">
            {(data?.results ?? []).map((row) => (
              <TaskCard key={row.taskId} row={row} onChanged={() => mutate()} />
            ))}
            {search && !isLoading && (data?.results ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-10">לא נמצאו משימות</p>
            )}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-black text-gray-500 mb-2">מסירות</h2>
              <div className="space-y-3">
                {(data?.pickups ?? []).map((row) => (
                  <TaskCard key={row.taskId} row={row} onChanged={() => mutate()} />
                ))}
                {!isLoading && (data?.pickups ?? []).length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">אין מסירות</p>
                )}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-black text-gray-500 mb-2">החזרות</h2>
              <div className="space-y-3">
                {(data?.returns ?? []).map((row) => (
                  <TaskCard key={row.taskId} row={row} onChanged={() => mutate()} />
                ))}
                {!isLoading && (data?.returns ?? []).length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">אין החזרות</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
