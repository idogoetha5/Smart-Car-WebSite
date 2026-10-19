'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useApiList } from '@/lib/swr';
import { useParams } from 'next/navigation';
import { Search, Trash2, RefreshCw, SlidersHorizontal, ChevronLeft, Phone, MessageCircle } from 'lucide-react';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import AdminSheet from '@/components/admin/AdminSheet';
import BookingDetails from '@/components/admin/BookingDetails';
import { useToast } from '@/components/ui/AppToast';
import { approvalResultMessage, filterAdminBookings, isOfficeBooking, type AdminBooking, type BookingFilters } from '@/lib/admin-bookings';
import { numericOrderReference } from '@/lib/order-reference';
import { useBookingContext } from '@/lib/use-booking-context';

function formatDate(val?: string) {
  if (!val) return 'לא צוין';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'לא צוין';
  return d.toLocaleDateString('he-IL');
}

function formatDateTime(val?: string) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatPrice(price?: number) {
  if (!price || isNaN(price)) return '—';
  return `₪${price.toLocaleString()}`;
}


function waLink(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  const normalized = digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

 
export default function AdminBookingsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchCar, setSearchCar] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateField, setDateField] = useState<BookingFilters['dateField']>('pickup_date');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ id: string; name: string; status: string } | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const actionInFlight = useRef(false);
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    items: bookings,
    isLoading: loading,
    isValidating: refreshing,
    error: loadError,
    mutate: mutateBookings,
  } = useApiList<AdminBooking>('/api/bookings', { refreshInterval: 30_000, revalidateOnFocus: true });
  const context = useMemo(() => ({ query: searchCustomer, car: searchCar, status: statusFilter, dateField, from: dateFrom, to: dateTo }), [searchCustomer, searchCar, statusFilter, dateField, dateFrom, dateTo]);
  const restoreContext = useCallback((saved: BookingFilters) => {
    setSearchCustomer(saved.query); setSearchCar(saved.car); setStatusFilter(saved.status);
    setDateField(saved.dateField); setDateFrom(saved.from); setDateTo(saved.to);
    const booking = new URLSearchParams(window.location.search).get('booking');
    if (booking && /^[A-Za-z0-9_-]{1,150}$/.test(booking)) setSelectedId(booking);
  }, []);
  useBookingContext(context, restoreContext, loading);
  useEffect(() => {
    const onPop = () => setSelectedId(new URLSearchParams(window.location.search).get('booking'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openBooking = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('booking', id);
    window.history.pushState(null, '', url);
  };
  const closeBooking = () => {
    setSelectedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('booking');
    window.history.replaceState(null, '', url);
  };

  const filtered = useMemo(() => {
    return filterAdminBookings(bookings, { query: searchCustomer, car: searchCar, status: statusFilter, dateField, from: dateFrom, to: dateTo });
  }, [bookings, searchCustomer, searchCar, statusFilter, dateField, dateFrom, dateTo]);
  const officeBookings = bookings.filter(isOfficeBooking);
  const selectedBooking = bookings.find(b => b.id === selectedId);

  const handleStatusChange = (id: string, status: string, booking: AdminBooking) => {
    if (!actionInFlight.current) setPendingAction({ id, status, name: booking.customer_name || 'הלקוח' });
  };

  const handleDelete = (id: string, name: string) => {
    if (!actionInFlight.current) setPendingAction({ id, name, status: 'delete' });
  };
  const performAction = async () => {
    if (!pendingAction || actionInFlight.current) return;
    const { id, status } = pendingAction;
    const deleting = status === 'delete';
    actionInFlight.current = true;
    setActingId(id);
    if (deleting) setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, deleting ? { method: 'DELETE' } : {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(body.error || 'הפעולה לא הושלמה. נסו שוב.', false);
        return;
      }
      await mutateBookings(curr => deleting ? (curr ?? []).filter(b => b.id !== id)
        : (curr ?? []).map(b => b.id === id ? { ...b, status: body.booking?.status ?? status } : b), { revalidate: false });
      if (deleting) {
        closeBooking();
        toast('ההזמנה נמחקה');
      } else {
        const message = approvalResultMessage(status, body.confirmationEmailed);
        toast(message.text, message.ok);
      }
      setPendingAction(null);
    } catch {
      toast('הפעולה לא הושלמה עקב בעיית חיבור. בדקו את המצב לפני ניסיון נוסף.', false);
      void mutateBookings().catch(() => undefined);
    } finally {
      actionInFlight.current = false;
      setActingId(null);
      setDeletingId(null);
    }
  };

  const isDecided = (status: string) =>
    ['confirmed', 'rejected', 'REJECTED', 'cancelled', 'cancelled_by_customer',
     'CONFIRMED', 'CANCELLED', 'CANCELLED_BY_CUSTOMER',
     'completed', 'COMPLETED'].includes(status ?? '');

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">ניהול הזמנות</h1>
          <p className="text-gray-500 mt-1">{filtered.length} / {officeBookings.length} הזמנות</p>
        </div>
        <button
          onClick={() => mutateBookings()}
          disabled={refreshing}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-[#B8D8D8] bg-white px-4 py-2 text-sm font-bold text-[#2D5F5F] shadow-sm transition hover:bg-[#F4FAFA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      {/* Search bars – Issues 5 & 6 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchCustomer}
            onChange={e => setSearchCustomer(e.target.value)}
            placeholder="שם, טלפון, אימייל או מספר הזמנה…"
            aria-label="חיפוש הזמנה לפי פרטי לקוח או מספר הזמנה"
            className="w-full pe-10 ps-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white"
          />
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchCar}
            onChange={e => setSearchCar(e.target.value)}
            placeholder="חיפוש לפי יצרן / דגם רכב..."
            className="w-full pe-10 ps-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] bg-white"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setStatusFilter('')} aria-pressed={!statusFilter} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${!statusFilter ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>הכול</button>
        <button type="button" onClick={() => setStatusFilter('PENDING')} aria-pressed={statusFilter === 'PENDING'} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${statusFilter === 'PENDING' ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>ממתינות לאישור <span className="ms-1">{officeBookings.filter(b => b.status?.toUpperCase() === 'PENDING').length}</span></button>
        <button type="button" onClick={() => setFiltersOpen(true)} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#B8D8D8] bg-white px-3 text-sm font-bold text-[#2D5F5F]"><SlidersHorizontal className="h-4 w-4" />סינון{(statusFilter && statusFilter !== 'PENDING') || dateFrom || dateTo ? ' •' : ''}</button>
      </div>
      {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">לא הצלחנו לעדכן את רשימת ההזמנות. {bookings.length ? 'הנתונים האחרונים נשארו מוצגים.' : 'בדקו את החיבור או התחברו מחדש.'}<button type="button" onClick={() => mutateBookings()} className="ms-2 min-h-11 underline">ניסיון נוסף</button></div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            {loadError ? 'הרשימה אינה זמינה כרגע' : officeBookings.length === 0 ? 'אין הזמנות עדיין' : 'לא נמצאו תוצאות לסינון שנבחר'}
          </p>
        ) : (
          <>
          {/* Phone cards: key booking facts and decisions stay in one vertical
              view. The denser table remains for computer use. */}
          <div className="divide-y divide-gray-100 sm:hidden">
            {filtered.map((b) => {
              const pending = b.status === 'pending' || b.status === 'PENDING';
              const vehicle = b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : b.vehicle_id?.slice(0, 8);
              return (
                <article key={b.id} className="p-4">
                  <button type="button" onClick={() => openBooking(b.id)} aria-label={`פתיחת כל פרטי ההזמנה של ${b.customer_name || 'לקוח'}`} className="block w-full rounded-xl text-start outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#2D5F5F]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-black text-[#0D2B2B]">{b.customer_name || 'לא צוין'}</h2>
                      <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-[#2D5F5F]"><bdi>{vehicle || 'רכב לא צוין'}</bdi><ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" /></p>
                    </div>
                    <BookingStatusBadge status={b.status} locale={locale} size="md" variant="admin" />
                  </div>
                  <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-sm text-slate-600">
                    <p><span className="font-bold text-slate-800">איסוף:</span> {formatDate(b.pickup_date)} {b.pickup_time || ''}</p>
                    <p className="mt-1"><span className="font-bold text-slate-800">החזרה:</span> {formatDate(b.dropoff_date)} {b.return_time || ''}</p>
                    <p className="mt-1 font-black text-[#0D2B2B]">{formatPrice(b.total_price)}</p>
                  </div>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {pending && <button onClick={() => handleStatusChange(b.id, 'confirmed', b)} className="min-h-14 rounded-2xl bg-gradient-to-bl from-[#3A7A7A] to-[#164443] px-3 text-base font-black text-white shadow-[0_8px_18px_rgba(22,68,67,0.24)] transition active:scale-[0.98]">אישור הזמנה</button>}
                    {pending && <button onClick={() => handleStatusChange(b.id, 'rejected', b)} className="min-h-14 rounded-2xl border border-red-200 bg-gradient-to-bl from-red-50 to-[#FFF8F7] px-3 text-base font-black text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 active:scale-[0.98]">סירוב</button>}
                    {waLink(b.customer_phone) && <a href={waLink(b.customer_phone)!} target="_blank" rel="noopener noreferrer" className="col-span-2 flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-bl from-[#2ACB69] to-[#128C4A] text-sm font-black text-white shadow-[0_8px_18px_rgba(18,140,74,0.22)] transition hover:brightness-105 active:scale-[0.99]">פתיחת WhatsApp עם הלקוח</a>}
                    <a href={`/${locale}/admin/inspections/new?bookingId=${b.id}&type=pickup`} className="flex min-h-11 items-center justify-center rounded-2xl border border-[#F4C7A8] bg-[#FFF4EC] text-sm font-black text-[#B94C18] shadow-sm transition hover:bg-[#FFE7D7] active:scale-[0.99]">בדיקת מסירה</a>
                    <a href={`/${locale}/admin/inspections/new?bookingId=${b.id}&type=return`} className="flex min-h-11 items-center justify-center rounded-2xl border border-[#B8D8D8] bg-[#EAF4F4] text-sm font-black text-[#1F5A56] shadow-sm transition hover:bg-[#D9ECEC] active:scale-[0.99]">בדיקת החזרה</a>
                    {isDecided(b.status) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id, b.customer_name || 'לקוח')}
                        disabled={deletingId !== null}
                        aria-label={`מחיקת ההזמנה של ${b.customer_name || 'לקוח'}`}
                        aria-busy={deletingId === b.id}
                        className="col-span-2 mt-1 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-base font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {deletingId === b.id ? 'מוחק הזמנה…' : 'מחיקת הזמנה'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-semibold">לקוח</th>
                  <th className="p-4 font-semibold">טלפון</th>
                  <th className="p-4 font-semibold">רכב</th>
                  <th className="p-4 font-semibold">תאריכים</th>
                  <th className="p-4 font-semibold">תוספות</th>
                  <th className="p-4 font-semibold">סה&quot;כ</th>
                  <th className="p-4 font-semibold">סטטוס</th>
                  <th className="p-4 font-semibold">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <button type="button" onClick={() => openBooking(b.id)} className="min-h-11 text-start font-bold text-[#2D5F5F] underline-offset-4 hover:underline">{b.customer_name || 'לא צוין'}</button>
                      <div className="text-gray-400 text-xs">{b.customer_email}</div>
                      {b.source === 'driver' && (
                        <span className="mt-1 inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                          🚶 הזמנה שנוצרה ע&quot;י נהג במקום
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="text-gray-600">{b.customer_phone || '—'}</div>
                      {waLink(b.customer_phone) && (
                        <a
                          href={waLink(b.customer_phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center rounded-lg bg-[#E8FFF0] px-2 py-1 text-xs font-bold text-[#128C4A] transition hover:bg-[#D4F8E1]"
                        >
                          💬 וואטסאפ
                        </a>
                      )}
                    </td>
                    <td className="p-4 text-gray-700">
                      {b.vehicle
                        ? `${b.vehicle.make} ${b.vehicle.model}`
                        : b.vehicle_id?.slice(0, 8)}
                    </td>
                    <td className="p-4 text-gray-500 text-xs">
                      <div>איסוף: {formatDate(b.pickup_date)} {b.pickup_time || ''}</div>
                      <div>החזרה: {formatDate(b.dropoff_date)} {b.return_time || ''}</div>
                    </td>
                    <td className="p-4">
                      {b.extras && b.extras.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {b.extras.map((e: string) => (
                            <span key={e} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs whitespace-nowrap">
                              {e === 'insurance' ? '🛡️ ביטול השתתפות' :
                               e === 'gps'       ? '🗺️ GPS' :
                               e === 'baby_seat' ? '👶 כיסא בטיחות' :
                               e === 'driver'    ? '👤 נהג נוסף' : e}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                      {b.additional_driver_name && (
                        <div className="text-gray-500 text-xs mt-1">
                          נהג נוסף: {b.additional_driver_name}
                        </div>
                      )}
                      {b.match_status === 'MANUAL_MATCH_REQUIRED' && (
                        <div className="mt-1 inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                          ⚠️ נדרשת התאמה ידנית מהצי המלא
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-gray-700">{formatPrice(b.total_price)}</td>
                    <td className="p-4">
                      <BookingStatusBadge status={b.status} locale={locale} size="md" variant="admin" />
                      {formatDateTime(b.created_at) && (
                        <div className="text-gray-400 text-xs mt-1 whitespace-nowrap">
                          בוצעה: {formatDateTime(b.created_at)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={`/${locale}/admin/inspections/new?bookingId=${b.id}&type=pickup`}
                          className="rounded-lg border border-[#F4C7A8] bg-[#FFF4EC] px-3 py-1.5 text-xs font-bold text-[#B94C18] shadow-sm transition-colors hover:bg-[#FFE7D7] whitespace-nowrap"
                        >
                          🚗 בדיקת מסירה
                        </a>
                        <a
                          href={`/${locale}/admin/inspections/new?bookingId=${b.id}&type=return`}
                          className="rounded-lg border border-[#B8D8D8] bg-[#EAF4F4] px-3 py-1.5 text-xs font-bold text-[#1F5A56] shadow-sm transition-colors hover:bg-[#D9ECEC] whitespace-nowrap"
                        >
                          🔁 בדיקת החזרה
                        </a>
                        {(b.status === 'pending' || b.status === 'PENDING') && (
                          <>
                            <button
                              onClick={() => handleStatusChange(b.id, 'confirmed', b)}
                              className="rounded-lg bg-gradient-to-bl from-[#3A7A7A] to-[#164443] px-3 py-1.5 text-xs font-bold text-white shadow-[0_5px_12px_rgba(22,68,67,0.2)] transition hover:brightness-110"
                            >
                              ✅ אשר
                            </button>
                            <button
                              onClick={() => handleStatusChange(b.id, 'rejected', b)}
                              className="rounded-lg bg-gradient-to-bl from-[#F36A64] to-[#C9342D] px-3 py-1.5 text-xs font-bold text-white shadow-[0_5px_12px_rgba(201,52,45,0.18)] transition hover:brightness-105"
                            >
                              ❌ סרב
                            </button>
                          </>
                        )}
                        {/* Issue 8: delete only for decided orders */}
                        {isDecided(b.status) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id, b.customer_name || 'לקוח')}
                            disabled={deletingId !== null}
                            aria-label={`מחיקת ההזמנה של ${b.customer_name || 'לקוח'}`}
                            aria-busy={deletingId === b.id}
                            title="מחק הזמנה"
                            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            {deletingId === b.id ? 'מוחק…' : 'מחיקה'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
      <AdminSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="סינון הזמנות" description="בחרו סטטוס ותקופה. סוג התאריך מציין בדיוק לפי מה מסננים." footer={<div className="flex gap-2"><button type="button" onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); }} className="min-h-12 flex-1 rounded-xl border border-slate-200 font-bold">ניקוי סינון</button><button type="button" disabled={!!dateFrom && !!dateTo && dateTo < dateFrom} onClick={() => setFiltersOpen(false)} className="min-h-12 flex-1 rounded-xl bg-[#2D5F5F] font-bold text-white disabled:opacity-40">הצגת הזמנות</button></div>}>
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">סטטוס<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base">{[['', 'כל הסטטוסים'], ['PENDING', 'ממתינה לאישור'], ['CONFIRMED', 'אושרה'], ['ACTIVE', 'פעילה'], ['COMPLETED', 'הושלמה'], ['REJECTED', 'סורבה'], ['CANCELLED_BY_CUSTOMER', 'בוטלה על ידי הלקוח'], ['CANCELLED', 'בוטלה']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-sm font-bold text-slate-700">לפי איזה תאריך?<select value={dateField} onChange={e => setDateField(e.target.value as BookingFilters['dateField'])} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base"><option value="pickup_date">תאריך איסוף</option><option value="dropoff_date">תאריך החזרה</option><option value="created_at">תאריך קבלת ההזמנה</option></select></label>
          <label className="block text-sm font-bold text-slate-700">מתאריך<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-base" /></label>
          <label className="block text-sm font-bold text-slate-700">עד תאריך<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-base" /></label>
          {dateFrom && dateTo && dateTo < dateFrom && <p role="alert" className="text-sm text-red-700">תאריך הסיום חייב להיות לאחר תאריך ההתחלה.</p>}
        </div>
      </AdminSheet>
      <AdminSheet open={!!selectedBooking} onClose={closeBooking} title={selectedBooking ? `פרטי הזמנה #${numericOrderReference(selectedBooking.id)}` : 'פרטי הזמנה'} footer={selectedBooking && <div className="space-y-2">
        {selectedBooking.status?.toUpperCase() === 'PENDING' && <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!!actingId} onClick={() => handleStatusChange(selectedBooking.id, 'confirmed', selectedBooking)} className="min-h-12 rounded-xl bg-[#2D5F5F] font-black text-white disabled:opacity-40">אישור הזמנה</button><button type="button" disabled={!!actingId} onClick={() => handleStatusChange(selectedBooking.id, 'rejected', selectedBooking)} className="min-h-12 rounded-xl border border-red-200 bg-red-50 font-bold text-red-700 disabled:opacity-40">סירוב</button></div>}
        <div className="flex gap-2">
          {waLink(selectedBooking.customer_phone) && <a href={waLink(selectedBooking.customer_phone)!} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#128C4A] font-bold text-white"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
          {selectedBooking.customer_phone && <a href={`tel:${selectedBooking.customer_phone.replace(/[^+\d]/g, '')}`} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#B8D8D8] bg-[#EAF4F4] font-bold text-[#1F5A56]"><Phone className="h-4 w-4" />התקשרות</a>}
        </div>
      </div>}>
        {selectedBooking && <><BookingDetails booking={selectedBooking} /><div className="mt-5 grid grid-cols-2 gap-2"><a href={`/${locale}/admin/inspections/new?bookingId=${selectedBooking.id}&type=pickup`} className="flex min-h-12 items-center justify-center rounded-xl bg-orange-50 text-sm font-bold text-orange-800">בדיקת מסירה</a><a href={`/${locale}/admin/inspections/new?bookingId=${selectedBooking.id}&type=return`} className="flex min-h-12 items-center justify-center rounded-xl bg-[#EAF4F4] text-sm font-bold text-[#1F5A56]">בדיקת החזרה</a></div>
        {isDecided(selectedBooking.status) && <button type="button" disabled={!!actingId} onClick={() => handleDelete(selectedBooking.id, selectedBooking.customer_name || 'לקוח')} className="mt-4 min-h-12 w-full rounded-xl border border-red-200 text-sm font-bold text-red-700 disabled:opacity-40">מחיקת הזמנה</button>}</>}
      </AdminSheet>
      <AdminSheet open={!!pendingAction} onClose={() => setPendingAction(null)} busy={!!actingId} alert title={pendingAction?.status === 'delete' ? 'מחיקת הזמנה לצמיתות' : pendingAction?.status === 'confirmed' ? 'אישור הזמנה' : 'סירוב להזמנה'} description={pendingAction ? `הזמנה של ${pendingAction.name} · #${numericOrderReference(pendingAction.id)}` : undefined} footer={<div className="grid grid-cols-2 gap-2"><button type="button" disabled={!!actingId} onClick={() => setPendingAction(null)} className="min-h-12 rounded-xl border border-slate-200 font-bold disabled:opacity-40">חזרה</button><button type="button" disabled={!!actingId} onClick={performAction} className={`min-h-12 rounded-xl font-black text-white disabled:opacity-50 ${pendingAction?.status === 'confirmed' ? 'bg-[#2D5F5F]' : 'bg-red-700'}`}>{actingId ? 'מבצע…' : pendingAction?.status === 'delete' ? 'מחיקה לצמיתות' : pendingAction?.status === 'confirmed' ? 'אישור ההזמנה' : 'סירוב להזמנה'}</button></div>}>
        <p className="text-base leading-7 text-slate-700">{pendingAction?.status === 'delete' ? 'יימחקו גם משימות הנהג ובדיקות הרכב המשויכות להזמנה, כולל סרטונים, תמונות ומסמכים חתומים. פעולה זו אינה ניתנת לביטול.' : pendingAction?.status === 'confirmed' ? 'הזמינות תיבדק שוב לפני האישור. לאחר האישור תתבצע שליחת מייל ללקוח בשפת ההזמנה.' : 'ההזמנה תסומן כסורבה על ידי המשרד. פעולה זו אינה ביטול על ידי הלקוח.'}</p>
      </AdminSheet>
    </div>
  );
}
