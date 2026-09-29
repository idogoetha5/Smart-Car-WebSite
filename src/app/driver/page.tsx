'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Search, LogOut, RefreshCw, Plus } from 'lucide-react';
import { fetcher } from '@/lib/swr';

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
  time: string | null;
  inspection: { id: string; status: 'awaiting_signature' | 'signed' } | null;
}

function TaskAction({ row }: { row: TaskRow }) {
  const router = useRouter();
  const label = row.type === 'pickup' ? 'בדיקת קבלה' : 'בדיקת החזרה';

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
      onClick={() => router.push(`/driver/inspection/${row.inspection!.id}`)}
      className={`min-h-12 px-4 rounded-xl font-black text-sm whitespace-nowrap ${
        signed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {signed ? '✓ נחתם' : 'ממתין לחתימה'}
    </button>
  );
}

function TaskCard({ row }: { row: TaskRow }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-gray-900 truncate">{row.customerName}</p>
          <p className="text-sm text-gray-500 truncate">{row.vehicleName} · <span dir="ltr">{row.licensePlate}</span></p>
          <p className="text-xs text-gray-400 mt-1">
            {row.location} {row.time ? `· ${row.time.slice(0, 5)}` : ''} · #{row.bookingNumber}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <TaskAction row={row} />
        </div>
      </div>
    </div>
  );
}

type Tab = 'today' | 'tomorrow' | 'search';

export default function DriverTodayPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('today');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const dateQuery = tab === 'tomorrow' ? 'date=tomorrow' : 'date=today';
  const url = tab === 'search'
    ? (search ? `/api/driver/today?search=${encodeURIComponent(search)}` : null)
    : `/api/driver/today?${dateQuery}`;

  const { data, isLoading, isValidating, mutate } = useSWR<{
    pickups?: TaskRow[];
    returns?: TaskRow[];
    results?: TaskRow[];
  }>(url, fetcher);

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

        <button
          onClick={() => router.push('/driver/quick-booking')}
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

      <div className="px-4 pt-4 space-y-6">
        {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />}

        {tab === 'search' ? (
          <div className="space-y-3">
            {(data?.results ?? []).map((row) => (
              <TaskCard key={row.taskId} row={row} />
            ))}
            {search && !isLoading && (data?.results ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-10">לא נמצאו משימות</p>
            )}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-black text-gray-500 mb-2">קבלות</h2>
              <div className="space-y-3">
                {(data?.pickups ?? []).map((row) => (
                  <TaskCard key={row.taskId} row={row} />
                ))}
                {!isLoading && (data?.pickups ?? []).length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">אין קבלות</p>
                )}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-black text-gray-500 mb-2">החזרות</h2>
              <div className="space-y-3">
                {(data?.returns ?? []).map((row) => (
                  <TaskCard key={row.taskId} row={row} />
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
