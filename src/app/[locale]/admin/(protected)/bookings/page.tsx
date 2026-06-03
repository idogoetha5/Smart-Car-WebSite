'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Search, Trash2, RefreshCw } from 'lucide-react';
import emailjs from '@emailjs/browser';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';

function formatDate(val: string) {
  if (!val) return 'לא צוין';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'לא צוין';
  return d.toLocaleDateString('he-IL');
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AdminBookingsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchCar, setSearchCar] = useState('');

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/bookings');
      if (!res.ok) return;
      const json = await res.json();
      setBookings(json.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filtered = useMemo(() => {
    const cust = searchCustomer.toLowerCase();
    const car = searchCar.toLowerCase();
    return bookings.filter(b => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBookings(prev => prev.map((b: any) => b.id === bookingId ? { ...b, status } : b));

    if (status === 'confirmed') {
      const extrasText = Array.isArray(booking.extras) && booking.extras.length > 0
        ? booking.extras.map((e: string) =>
            e === 'insurance' ? 'ביטול השתתפות עצמית' :
            e === 'gps'       ? 'ניווט GPS' :
            e === 'baby_seat' ? 'כיסא בטיחות' :
            e === 'driver'    ? 'נהג נוסף' : e
          ).join(', ')
        : 'ללא תוספות';

      const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = 'template_d6xkjjo';
      const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        console.warn('[admin/bookings] EmailJS env vars not configured — skipping confirmation email');
        alert('✅ הזמנה אושרה (EmailJS לא מוגדר — מייל לא נשלח)');
      } else {
        try {
          await emailjs.send(
            serviceId,
            templateId,
            {
              to_email:        booking.customer_email || booking.email,
              to_name:         booking.customer_name  || booking.name || 'לקוח',
              booking_type:    '✅ הזמנה מאושרת',
              vehicle_name:    booking.vehicle
                ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}`
                : '-',
              order_id:        bookingId.slice(0, 8).toUpperCase(),
              start_date:      formatDate(booking.pickup_date  || booking.start_date  || ''),
              end_date:        formatDate(booking.dropoff_date || booking.end_date    || ''),
              pickup_location: booking.pickup_location  || '-',
              return_location: booking.dropoff_location || booking.pickup_location || '-',
              customer_phone:  booking.customer_phone   || booking.phone || '-',
              total_price:     booking.total_price ? `₪${booking.total_price.toLocaleString()}` : '-',
              extras:          extrasText,
              pickup_time:     booking.pickup_time  || '09:00',
              return_time:     booking.return_time  || '09:00',
            },
            publicKey
          );
          alert('✅ הזמנה אושרה ומייל נשלח ללקוח!');
        } catch {
          alert('✅ הזמנה אושרה אך שליחת המייל נכשלה — בדוק EmailJS');
        }
      }
    } else {
      alert('❌ הזמנה סורבה');
    }
  };

  const handleDelete = async (id: string, customerName: string) => {
    if (!window.confirm(`למחוק לצמיתות את ההזמנה של ${customerName}?\nפעולה זו אינה ניתנת לביטול.`)) return;
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('שגיאה במחיקה'); return; }
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const isDecided = (status: string) =>
    ['confirmed', 'cancelled', 'cancelled_by_customer',
     'CONFIRMED', 'CANCELLED', 'CANCELLED_BY_CUSTOMER',
     'completed', 'COMPLETED'].includes(status ?? '');

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">ניהול הזמנות</h1>
          <p className="text-gray-500 mt-1">{filtered.length} / {bookings.length} הזמנות</p>
        </div>
        <button
          onClick={() => fetchBookings(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="overflow-x-auto">
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
                    </td>
                    <td className="p-4 text-xs">
                      <div className="text-gray-600">{b.customer_phone || '—'}</div>
                      {waLink(b.customer_phone) && (
                        <a
                          href={waLink(b.customer_phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 font-medium mt-0.5 inline-block"
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
                    </td>
                    <td className="p-4 font-semibold text-gray-700">{formatPrice(b.total_price)}</td>
                    <td className="p-4"><BookingStatusBadge status={b.status} locale={locale} size="md" variant="admin" /></td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(b.status === 'pending' || b.status === 'PENDING') && (
                          <>
                            <button
                              onClick={() => handleStatusChange(b.id, 'confirmed', b)}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                            >
                              ✅ אשר
                            </button>
                            <button
                              onClick={() => handleStatusChange(b.id, 'cancelled', b)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
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
        )}
      </div>
    </div>
  );
}
