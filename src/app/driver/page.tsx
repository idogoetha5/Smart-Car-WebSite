'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { preload } from 'swr';
import { Search, LogOut, Plus, Navigation, Phone, Pencil, MapPin, MessageCircle, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import PendingInspections from '@/components/inspection/PendingInspections';
import { BrandBar, BrandHero, brandIconButton } from '@/components/app/Brand';
import PushBell from '@/components/app/PushBell';
import { greeting, israelDate, longDate } from '@/lib/task-schedule';
import { arrivedMessage, onTheWayLink, onTheWayMessage, returnReminderMessage, signedCopyMessage } from '@/lib/driver-on-the-way';

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
  inspection: { id: string; status: 'awaiting_signature' | 'signed'; pdfUrl?: string } | null;
  date?: string | null;
  /** Search: a completed handover still waiting for its return form. */
  awaitingReturn?: boolean;
}

function TaskAction({ row }: { row: TaskRow }) {
  const router = useRouter();
  const base = 'flex min-h-14 flex-1 items-center justify-center rounded-2xl text-base font-black active:scale-[0.98] transition';

  if (row.awaitingReturn) {
    return (
      <button
        onClick={() => router.push(`/driver/inspection/new?bookingId=${row.bookingId}&type=return`)}
        className={`${base} bg-[#E8743B] text-white`}
      >
        התחל בדיקת החזרה
      </button>
    );
  }

  if (!row.inspection) {
    return (
      <button
        onClick={() => router.push(`/driver/inspection/new?bookingId=${row.bookingId}&type=${row.type}`)}
        className={`${base} bg-[#E8743B] text-white`}
      >
        {row.type === 'pickup' ? 'התחל בדיקת מסירה' : 'התחל בדיקת החזרה'}
      </button>
    );
  }

  const signed = row.inspection.status === 'signed';
  return (
    <button
      onClick={() => router.push(signed ? `/driver/inspection/${row.inspection!.id}` : `/driver/inspection/${row.inspection!.id}/sign`)}
      className={`${base} ${signed ? 'bg-green-100 text-green-700' : 'bg-amber-400 text-gray-900'}`}
    >
      {signed ? '✓ נחתם — צפייה בטופס' : 'לחתימת הלקוח'}
    </button>
  );
}

interface SheetItem {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: 'whatsapp' | 'default' | 'done';
}

function ActionSheet({ title, items, onClose, children }: { title: string; items: SheetItem[]; onClose: () => void; children?: ReactNode }) {
  const tones = {
    whatsapp: 'text-[#128C4B]',
    default: 'text-gray-800',
    done: 'text-[#2D5F5F]',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end" dir="rtl" role="dialog" aria-modal="true">
      <button type="button" aria-label="סגירה" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300" />
        <p className="mb-2 truncate text-center text-sm font-bold text-gray-500">{title}</p>
        {children}
        <div className="divide-y divide-gray-100">
          {items.map((it) => {
            const cls = `flex min-h-14 w-full items-center gap-4 px-2 text-start text-base font-bold ${tones[it.tone ?? 'default']}`;
            return it.href ? (
              <a key={it.key} href={it.href} target={it.href.startsWith('tel:') ? undefined : '_blank'} rel="noopener noreferrer" onClick={onClose} className={cls}>
                {it.icon}
                {it.label}
              </a>
            ) : (
              <button key={it.key} type="button" onClick={it.onClick} className={cls}>
                {it.icon}
                {it.label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="mt-3 min-h-14 w-full rounded-2xl bg-gray-100 text-base font-black text-gray-700">
          סגור
        </button>
      </div>
    </div>
  );
}

function TaskCard({ row, onChanged, driverName, isTomorrow = false }: { row: TaskRow; onChanged: () => void; driverName: string; isTomorrow?: boolean }) {
  const hasAddress = Boolean(row.navQuery);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(hasAddress ? row.location : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState(false);

  const awaiting = Boolean(row.awaitingReturn);
  const isDone = row.taskStatus === 'done' && !awaiting;
  const signed = row.inspection?.status === 'signed';
  const time = row.time ? row.time.slice(0, 5) : null;
  const wazeUrl = hasAddress ? `https://waze.com/ul?q=${encodeURIComponent(row.navQuery as string)}&navigate=yes` : null;
  const telUrl = row.customerPhone ? `tel:${row.customerPhone.replace(/[^\d+]/g, '')}` : null;

  const patch = (body: Record<string, string>) =>
    fetch(`/api/driver/tasks/${encodeURIComponent(row.taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const toggleDone = async () => {
    setMarking(true);
    try {
      const res = await patch({ status: isDone ? 'open' : 'done' });
      if (res.ok) {
        setSheet(false);
        onChanged();
      }
    } finally {
      setMarking(false);
    }
  };

  const saveAddress = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await patch({ location: address.trim() });
      if (!res.ok) throw new Error();
      setEditing(false);
      setSheet(false);
      onChanged();
    } catch {
      setSaveError('שמירת הכתובת נכשלה');
    } finally {
      setSaving(false);
    }
  };

  // Build the sheet: only the messages that make sense right now, most relevant first.
  const wa = <MessageCircle className="h-6 w-6 shrink-0" aria-hidden="true" />;
  const items: SheetItem[] = [];
  if (row.customerPhone) {
    const phone = row.customerPhone;
    if (signed && row.inspection?.pdfUrl) {
      const href = onTheWayLink(phone, signedCopyMessage({ customerName: row.customerName, type: row.type, pdfUrl: row.inspection.pdfUrl }));
      if (href) items.push({ key: 'copy', label: 'וואטסאפ: שלח את הטופס החתום', icon: wa, href, tone: 'whatsapp' });
    }
    if (isTomorrow && row.type === 'return' && !isDone && !signed) {
      const href = onTheWayLink(
        phone,
        returnReminderMessage({
          customerName: row.customerName,
          dateLabel: row.date ? new Date(row.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }) : '',
          time,
          address: hasAddress ? row.location : null,
        })
      );
      if (href) items.push({ key: 'remind', label: 'וואטסאפ: תזכורת לאיסוף מחר', icon: wa, href, tone: 'whatsapp' });
    }
    if (!isDone && !signed && !isTomorrow) {
      const onTheWay = onTheWayLink(phone, onTheWayMessage({ customerName: row.customerName, driverName, vehicleName: row.vehicleName, type: row.type }));
      const arrived = onTheWayLink(phone, arrivedMessage({ customerName: row.customerName, driverName, type: row.type }));
      if (onTheWay) items.push({ key: 'otw', label: 'וואטסאפ: אני בדרך', icon: wa, href: onTheWay, tone: 'whatsapp' });
      if (arrived) items.push({ key: 'arr', label: 'וואטסאפ: הגעתי', icon: wa, href: arrived, tone: 'whatsapp' });
    }
  }
  // Address/done edit the driver task — a handover found without one (search) has neither.
  if (row.taskId) items.push({
    key: 'addr',
    label: hasAddress ? 'עריכת כתובת' : 'הוספת כתובת לוויז',
    icon: hasAddress ? <Pencil className="h-6 w-6 shrink-0" aria-hidden="true" /> : <MapPin className="h-6 w-6 shrink-0" aria-hidden="true" />,
    onClick: () => setEditing(true),
  });
  if (!awaiting && row.taskId) items.push({
    key: 'done',
    label: marking ? 'שומר…' : isDone ? 'ביטול סימון "בוצע"' : 'סמן כבוצע',
    icon: <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />,
    onClick: toggleDone,
    tone: 'done',
  });

  const secBtn = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 text-xs font-black active:scale-95 transition';

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${isDone ? 'border-green-200 bg-green-50/60' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-lg font-black leading-tight truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{row.customerName}</p>
        </div>
        {awaiting ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">
            נמסר{row.date ? ` ${new Date(row.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}` : ''}
          </span>
        ) : isDone ? (
          <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm font-black text-green-700">✓ בוצע</span>
        ) : time ? (
          <span className="shrink-0 rounded-full bg-[#2D5F5F]/10 px-3 py-1 text-base font-black text-[#2D5F5F]" dir="ltr">{time}</span>
        ) : null}
      </div>

      <p className="mt-0.5 flex min-w-0 gap-1 text-sm text-gray-500">
        <span className="truncate">{row.vehicleName}</span>
        <span className="shrink-0">·</span>
        <span className="shrink-0 font-bold text-gray-700" dir="ltr">{row.licensePlate}</span>
      </p>

      <p className={`mt-2 flex items-center gap-1.5 text-sm truncate ${hasAddress ? 'text-gray-700' : 'text-gray-400'}`}>
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{hasAddress ? row.location : 'אין כתובת'}</span>
      </p>

      {!isDone && (
        <div className="mt-3 flex">
          <TaskAction row={row} />
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {wazeUrl ? (
          <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className={`${secBtn} border-[#33CCFF] bg-[#eefbff] text-[#0a7ea4]`}>
            <Navigation className="h-5 w-5" aria-hidden="true" />
            ניווט
          </a>
        ) : row.taskId ? (
          <button type="button" onClick={() => { setEditing(true); setSheet(true); }} className={`${secBtn} border-dashed border-gray-300 text-gray-500`}>
            <MapPin className="h-5 w-5" aria-hidden="true" />
            הוסף כתובת
          </button>
        ) : null}
        {telUrl && (
          <a href={telUrl} className={`${secBtn} border-green-500 bg-green-50 text-green-700`}>
            <Phone className="h-5 w-5" aria-hidden="true" />
            חיוג
          </a>
        )}
        <button type="button" onClick={() => setSheet(true)} className={`${secBtn} border-gray-200 bg-white text-gray-600`}>
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          {items.length > 2 ? 'וואטסאפ ועוד' : 'עוד'}
        </button>
      </div>

      {sheet && (
        <ActionSheet title={`${row.customerName} · #${row.bookingNumber}`} items={editing ? [] : items} onClose={() => { setSheet(false); setEditing(false); }}>
          {editing && (
            <div className="space-y-2 pb-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="רחוב, מספר, עיר"
                autoFocus
                className="w-full min-h-14 rounded-2xl border-2 border-gray-200 px-4 text-base"
              />
              <button type="button" onClick={saveAddress} disabled={saving || !address.trim()} className="min-h-14 w-full rounded-2xl bg-[#2D5F5F] text-base font-black text-white disabled:opacity-50">
                {saving ? 'שומר…' : 'שמור כתובת'}
              </button>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </div>
          )}
        </ActionSheet>
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

  const [nowMs] = useState(() => Date.now());
  const { data: me } = useSWR<{ role: string; name?: string }>('/api/driver/me', fetcher, { dedupingInterval: 60_000 });

  const dateQuery = tab === 'tomorrow' ? 'date=tomorrow' : 'date=today';
  const url = tab === 'search'
    ? (search ? `/api/driver/today?search=${encodeURIComponent(search)}` : null)
    : `/api/driver/today?${dateQuery}`;

  const { data, isLoading, mutate } = useSWR<{
    pickups?: TaskRow[];
    returns?: TaskRow[];
    results?: TaskRow[];
  }>(url, fetcher, { keepPreviousData: true, dedupingInterval: 10_000, refreshInterval: 60_000, revalidateOnFocus: true });

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
      <BrandBar label="נהגים">
        <PushBell audience="driver" />
        <button onClick={logout} className={brandIconButton} aria-label="יציאה">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </button>
      </BrandBar>

      <BrandHero>
        <p className="text-sm font-bold text-[#2D5F5F]/80">{longDate(israelDate(nowMs))}</p>
        <h1 className="mb-4 text-2xl font-black text-[#0D2B2B]">{greeting(nowMs)}{me?.name ? `, ${me.name}` : ''}</h1>

        <button
          onClick={openQuickBooking}
          className="w-full min-h-12 mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black shadow-sm"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          משימה חדשה
        </button>

        <div className="flex gap-1 rounded-2xl bg-white/70 p-1">
          {(['today', 'tomorrow', 'search'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 flex-1 rounded-xl font-black text-sm ${
                tab === t ? 'bg-[#2D5F5F] text-white shadow-sm' : 'text-[#2D5F5F]'
              }`}
            >
              {t === 'today' ? 'היום' : t === 'tomorrow' ? 'מחר' : 'חיפוש'}
            </button>
          ))}
        </div>

        {tab === 'search' && (
          <div className="relative mt-3">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
              placeholder="שם לקוח / לוחית רישוי / מספר הזמנה"
              className="w-full min-h-12 ps-10 pe-4 rounded-xl border-2 border-white bg-white text-base"
            />
          </div>
        )}
      </BrandHero>

      <PendingInspections />

      <div className="mx-auto max-w-5xl px-4 pt-4 space-y-6 sm:px-8">
        {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />}

        {tab === 'search' ? (
          <div className="space-y-3">
            {(data?.results ?? []).map((row) => (
              <TaskCard key={row.taskId || `h-${row.bookingId}`} row={row} onChanged={() => mutate()} driverName={me?.name ?? ''} />
            ))}
            {search && !isLoading && (data?.results ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-10">לא נמצאו משימות</p>
            )}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-black text-[#2D5F5F] mb-2">מסירות</h2>
              <div className="space-y-3">
                {(data?.pickups ?? []).map((row) => (
                  <TaskCard key={row.taskId || `h-${row.bookingId}`} row={row} onChanged={() => mutate()} driverName={me?.name ?? ''} isTomorrow={tab === 'tomorrow'} />
                ))}
                {!isLoading && (data?.pickups ?? []).length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">אין מסירות</p>
                )}
              </div>
            </section>
            <section>
              <h2 className="text-sm font-black text-[#2D5F5F] mb-2">החזרות</h2>
              <div className="space-y-3">
                {(data?.returns ?? []).map((row) => (
                  <TaskCard key={row.taskId || `h-${row.bookingId}`} row={row} onChanged={() => mutate()} driverName={me?.name ?? ''} isTomorrow={tab === 'tomorrow'} />
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
