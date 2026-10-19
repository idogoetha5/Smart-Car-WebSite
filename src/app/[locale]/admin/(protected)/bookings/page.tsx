'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/lib/swr';
import { useParams } from 'next/navigation';
import { Search, Trash2, RefreshCw } from 'lucide-react';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';

function formatDate(val: string) {
  if (!val) return 'לא צוין';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'לא צוין';
  return d.toLocaleDateString('he-IL');
}

function formatDateTime(val: string) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatPrice(price: number) {
  if (!price || isNaN(price)) return '—';
  return `₪${price.toLocaleString()}`;
}


function waLink(phone: string): string | null {
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

  const {
    items: bookings,
    isLoading: loading,
    isValidating: refreshing,
    mutate: mutateBookings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useApiList<any>('/api/bookings');

  const filtered = useMemo(() => {
    const cust = searchCustomer.toLowerCase();
    const car = searchCar.toLowerCase();
    return bookings.filter(b => {
      // Driver-app field jobs aren't reservations (placeholder dates/prices);
      // they live under נהגים → עבודות שבוצעו ונחתמו.
      if (b.source === 'driver' || b.source === 'phone') return false;
      if (cust) {
        const name = (b.customer_name ?? '').toLowerCase();
        const email = (b.customer_email ?? '').toLowerCase();
        if (!name.includes(cust) && !email.includes(cust)) return false;
      }
      if (car) {
        const vehicleStr = b.vehicle
          ? `${b.vehicle.make} ${b.vehicle.model}`.toLowerCase()
          : '';
        if (!vehicleStr.includes(car)) return false;
      }
      return true;
    });
  }, [bookings, searchCustomer, searchCar]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStatusChange = async (bookingId: string, status: string, booking: any) => {
    const customerName = booking.customer_name || booking.name || 'הלקוח';
    const msg = status === 'confirmed'
      ? `לאשר הזמנה של ${customerName}?`
      : `לסרב להזמנה של ${customerName}?`;
    if (!window.confirm(msg)) return;

    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('שגיאה: ' + (data?.error || 'נסה שנית'));
      return;
    }

    // Applied locally without a refetch: the PATCH already returned the new
    // status, so re-reading the whole list would only cost a round trip.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutateBookings(curr => (curr ?? []).map((b: any) => b.id === bookingId ? { ...b, status } : b), { revalidate: false });

    // Confirmation email is sent server-side by the PATCH route above
    // (sendConfirmationEmail in api/admin/bookings/[id]/route.ts) — do not
    // also send one from here. This used to fire a second email with a
    // different hardcoded template every time an admin confirmed a
    // booking, so customers could get two different-looking confirmations.
    alert(status === 'confirmed' ? '✅ הזמנה אושרה ומייל אישור נשלח ללקוח' : '❌ הזמנה סורבה');
  };

  const handleDelete = async (id: string, customerName: string) => {
    if (!window.confirm(`למחוק לצמיתות את ההזמנה של ${customerName}?\nיימחקו גם משימות הנהג ובדיקות הרכב של ההזמנה (סרטונים, תמונות ומסמכים חתומים).\nפעולה זו אינה ניתנת לביטול.`)) return;
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json?.error || 'שגיאה במחיקה');
      return;
    }
    mutateBookings(curr => (curr ?? []).filter(b => b.id !== id), { revalidate: false });
  };

  const isDecided = (status: string) =>
    ['confirmed', 'cancelled', 'cancelled_by_customer',
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
          <p className="text-gray-500 mt-1">{filtered.length} / {bookings.length} הזמנות</p>
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
            placeholder="חיפוש לפי שם לקוח / אימייל..."
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            {bookings.length === 0 ? 'אין הזמנות עדיין' : 'לא נמצאו תוצאות'}
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-black text-[#0D2B2B]">{b.customer_name || 'לא צוין'}</h2>
                      <p className="mt-0.5 text-sm font-bold text-[#2D5F5F]">{vehicle || 'רכב לא צוין'}</p>
                    </div>
                    <BookingStatusBadge status={b.status} locale={locale} size="md" variant="admin" />
                  </div>
                  <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-sm text-slate-600">
                    <p><span className="font-bold text-slate-800">איסוף:</span> {formatDate(b.pickup_date)} {b.pickup_time || ''}</p>
                    <p className="mt-1"><span className="font-bold text-slate-800">החזרה:</span> {formatDate(b.dropoff_date)} {b.return_time || ''}</p>
                    <p className="mt-1 font-black text-[#0D2B2B]">{formatPrice(b.total_price)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {pending && <button onClick={() => handleStatusChange(b.id, 'confirmed', b)} className="min-h-14 rounded-2xl bg-gradient-to-bl from-[#3A7A7A] to-[#164443] px-3 text-base font-black text-white shadow-[0_8px_18px_rgba(22,68,67,0.24)] transition active:scale-[0.98]">אישור הזמנה</button>}
                    {pending && <button onClick={() => handleStatusChange(b.id, 'cancelled', b)} className="min-h-14 rounded-2xl border border-red-200 bg-gradient-to-bl from-red-50 to-[#FFF8F7] px-3 text-base font-black text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 active:scale-[0.98]">סירוב</button>}
                    {waLink(b.customer_phone) && <a href={waLink(b.customer_phone)!} target="_blank" rel="noopener noreferrer" className="col-span-2 flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-bl from-[#2ACB69] to-[#128C4A] text-sm font-black text-white shadow-[0_8px_18px_rgba(18,140,74,0.22)] transition hover:brightness-105 active:scale-[0.99]">פתיחת WhatsApp עם הלקוח</a>}
                    <a href={`/${locale}/admin/inspections/new?bookingId=${b.id}&type=pickup`} className="flex min-h-11 items-center justify-center rounded-2xl border border-[#F4C7A8] bg-[#FFF4EC] text-sm font-black text-[#B94C18] shadow-sm transition hover:bg-[#FFE7D7] active:scale-[0.99]">בדיקת מסירה</a>
                    <a href={`/${locale}/admin/inspections/new?bookingId=${b.id}&type=return`} className="flex min-h-11 items-center justify-center rounded-2xl border border-[#B8D8D8] bg-[#EAF4F4] text-sm font-black text-[#1F5A56] shadow-sm transition hover:bg-[#D9ECEC] active:scale-[0.99]">בדיקת החזרה</a>
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
                      <div className="font-medium text-gray-900">{b.customer_name || 'לא צוין'}</div>
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
                              onClick={() => handleStatusChange(b.id, 'cancelled', b)}
                              className="rounded-lg bg-gradient-to-bl from-[#F36A64] to-[#C9342D] px-3 py-1.5 text-xs font-bold text-white shadow-[0_5px_12px_rgba(201,52,45,0.18)] transition hover:brightness-105"
                            >
                              ❌ סרב
                            </button>
                          </>
                        )}
                        {/* Issue 8: delete only for decided orders */}
                        {isDecided(b.status) && (
                          <button
                            onClick={() => handleDelete(b.id, b.customer_name || 'לקוח')}
                            title="מחק הזמנה"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
