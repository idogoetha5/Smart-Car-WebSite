'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Car, MapPin, AlertCircle, LogOut } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';

type Booking = {
  id: string;
  status: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_location: string;
  dropoff_location: string;
  total_price: number;
  total_days: number;
  extras: string[];
  created_at: string;
  vehicle: { make: string; model: string; year: number; image_urls: string[] } | null;
};


function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

const EXTRA_LABELS: Record<string, { he: string; en: string }> = {
  insurance: { he: '🛡️ ביטול השתתפות', en: '🛡️ Damage Waiver' },
  highway6:  { he: '🛣️ כביש 6',        en: '🛣️ Highway 6' },
  baby_seat: { he: '👶 כיסא בטיחות',   en: '👶 Baby Seat' },
  driver:    { he: '👤 נהג נוסף',       en: '👤 Extra Driver' },
};

function mapAuthError(err: string, isHe: boolean): string {
  if (err.includes('Token has expired') || err.includes('expired'))
    return isHe ? 'הקוד פג תוקף, שלח מחדש' : 'Code expired, please resend';
  if (err.includes('Invalid') || err.includes('invalid') || err.includes('incorrect'))
    return isHe ? 'קוד שגוי, נסה שנית' : 'Incorrect code, please try again';
  if (err.includes('rate limit') || err.includes('too many'))
    return isHe ? 'יותר מדי ניסיונות, המתן מעט' : 'Too many attempts, please wait';
  return isHe ? 'שגיאה, נסה שנית' : 'An error occurred, please try again';
}

export default function MyBookingsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';

  const supabase = createClient();

  const [authEmail, setAuthEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');

  const [cancelState, setCancelState] = useState<Record<string, 'confirm' | 'loading'>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
      setSessionChecked(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError('');
    setBookings(null);
    try {
      const res = await fetch('/api/my-bookings');
      if (res.status === 401) {
        setUserEmail(null);
        return;
      }
      if (!res.ok) throw new Error('server');
      const { data } = await res.json();
      setBookings(data);
    } catch {
      setBookingsError(isHe ? 'שגיאה בטעינת ההזמנות, נסה שנית' : 'Failed to load bookings, please try again');
    } finally {
      setBookingsLoading(false);
    }
  }, [isHe]);

  useEffect(() => {
    if (userEmail) fetchBookings();
  }, [userEmail, fetchBookings]);

  const startCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: { shouldCreateUser: true },
      });
      if (error) { setAuthError(mapAuthError(error.message, isHe)); return; }
      setOtpSent(true);
      startCooldown();
    } catch {
      setAuthError(isHe ? 'שגיאה, נסה שנית' : 'An error occurred, please try again');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: authEmail,
        token: otpCode.trim(),
        type: 'email',
      });
      if (error) { setAuthError(mapAuthError(error.message, isHe)); return; }
      const email = data.user?.email;
      if (!email) { setAuthError(isHe ? 'שגיאה, נסה שנית' : 'An error occurred'); return; }
      setUserEmail(email);
    } catch {
      setAuthError(isHe ? 'שגיאה, נסה שנית' : 'An error occurred, please try again');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setBookings(null);
    setAuthEmail('');
    setOtpCode('');
    setOtpSent(false);
    setAuthError('');
  };

  const handleCancelClick = (id: string) =>
    setCancelState(prev => ({ ...prev, [id]: 'confirm' }));

  const handleCancelAbort = (id: string) =>
    setCancelState(prev => { const n = { ...prev }; delete n[id]; return n; });

  const handleCancelConfirm = async (bookingId: string) => {
    setCancelState(prev => ({ ...prev, [bookingId]: 'loading' }));
    try {
      const res = await fetch('/api/my-bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[cancel] API error:', json);
        throw new Error(json?.detail || json?.error || 'failed');
      }
      const newStatus = json?.status ?? 'CANCELLED_BY_CUSTOMER';
      setBookings(prev => prev?.map(b => b.id === bookingId ? { ...b, status: newStatus } : b) ?? null);
      setCancelState(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    } catch (err) {
      console.error('[cancel] caught:', err);
      setCancelState(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
      alert(isHe ? 'שגיאה בביטול, נסה שנית' : 'Cancellation failed, please try again');
    }
  };

  if (!sessionChecked) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D5F5F] mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-gray-900 mb-2">
          {isHe ? 'ההזמנות שלי' : 'My Bookings'}
        </h1>
        {!userEmail && (
          <p className="text-gray-500 text-sm">
            {isHe
              ? 'יש להתחבר לחשבון כדי לצפות בהזמנות'
              : 'Sign in to your account to view your bookings'}
          </p>
        )}
        {userEmail && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-gray-400 text-sm">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {isHe ? 'התנתק' : 'Sign out'}
            </button>
          </div>
        )}
      </div>

      {/* Auth form */}
      {!userEmail && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm mx-auto">

          {/* Step 1 — enter email */}
          {!otpSent && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-[#eef6f6] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">✉️</span>
                </div>
                <p className="text-sm text-gray-500">
                  {isHe
                    ? 'הכניסי את כתובת המייל שלך ונשלח לך קוד אימות'
                    : 'Enter your email address and we\'ll send you a verification code'}
                </p>
              </div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {isHe ? 'כתובת מייל' : 'Email address'}
                  </label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    required
                    dir="ltr"
                    placeholder="your@email.com"
                    className="w-full h-11 rounded-xl border-2 border-gray-200 px-4 text-sm focus:outline-none focus:border-[#2D5F5F] transition-colors"
                  />
                </div>
                {authError && (
                  <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-11 bg-[#2D5F5F] text-white text-sm font-bold rounded-xl hover:bg-[#1A3A3A] disabled:opacity-40 transition-colors"
                >
                  {authLoading ? '...' : (isHe ? 'שלח קוד אימות' : 'Send verification code')}
                </button>
              </form>
            </>
          )}

          {/* Step 2 — enter OTP */}
          {otpSent && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-[#eef6f6] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔑</span>
                </div>
                <p className="text-sm text-gray-700 font-medium mb-1">
                  {isHe ? 'בדוק את תיבת המייל שלך' : 'Check your inbox'}
                </p>
                <p className="text-xs text-gray-400">
                  {isHe
                    ? `שלחנו קוד אימות ל-${authEmail}`
                    : `We sent a verification code to ${authEmail}`}
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {isHe ? 'קוד אימות' : 'Verification code'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6,8}"
                    maxLength={8}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    dir="ltr"
                    placeholder="12345678"
                    className="w-full h-12 rounded-xl border-2 border-gray-200 px-4 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-[#2D5F5F] transition-colors"
                    autoFocus
                  />
                </div>
                {authError && (
                  <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{authError}</p>
                )}
                <button
                  type="submit"
                  disabled={authLoading || otpCode.length < 6}
                  className="w-full h-11 bg-[#2D5F5F] text-white text-sm font-bold rounded-xl hover:bg-[#1A3A3A] disabled:opacity-40 transition-colors"
                >
                  {authLoading ? '...' : (isHe ? 'אמת ← כנס' : 'Verify & sign in')}
                </button>
                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-gray-400">
                      {isHe ? `שלח שוב בעוד ${resendCooldown} שניות` : `Resend in ${resendCooldown}s`}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtpCode(''); setAuthError(''); }}
                      className="text-xs text-[#2D5F5F] hover:underline"
                    >
                      {isHe ? 'לא קיבלת? שנה מייל או שלח שוב' : 'Didn\'t receive it? Change email or resend'}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Bookings */}
      {userEmail && (
        <>
          {bookingsLoading && (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D5F5F] mx-auto" />
            </div>
          )}

          {bookingsError && (
            <div className="text-center py-16">
              <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
              <p className="text-red-500">{bookingsError}</p>
            </div>
          )}

          {!bookingsLoading && !bookingsError && bookings !== null && (
            bookings.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {isHe ? 'לא נמצאו הזמנות' : 'No bookings found'}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {isHe
                    ? 'וודא שנרשמת עם אותו מייל שבו השתמשת בהזמנה'
                    : 'Make sure you registered with the same email used when booking'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  {isHe ? `${bookings.length} הזמנות` : `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
                </p>
                {bookings.map((booking) => {
                  const img = booking.vehicle?.image_urls?.[0];
                  const cs = cancelState[booking.id];

                  return (
                    <div key={booking.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-4 p-5">
                        {img ? (
                          <div className="relative w-24 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-[#eef6f6]">
                            <Image src={img} alt={`${booking.vehicle?.make} ${booking.vehicle?.model}`} fill className="object-contain p-1" />
                          </div>
                        ) : (
                          <div className="w-24 h-16 flex-shrink-0 rounded-xl bg-[#eef6f6] flex items-center justify-center">
                            <Car className="w-8 h-8 text-[#2D5F5F]/40" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-bold text-gray-900">
                              {booking.vehicle
                                ? `${booking.vehicle.make} ${booking.vehicle.model}`
                                : (isHe ? 'רכב לא ידוע' : 'Unknown vehicle')}
                            </h3>
                            <BookingStatusBadge status={booking.status} locale={locale} />
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {formatDate(booking.pickup_date, locale)} → {formatDate(booking.dropoff_date, locale)}
                            </span>
                            <span>
                              {isHe ? `${booking.total_days} ימים` : `${booking.total_days} days`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="capitalize">{booking.pickup_location}</span>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <p className="text-xl font-black text-[#2D5F5F]">₪{booking.total_price.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">#{booking.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>

                      {booking.extras?.length > 0 && (
                        <div className="px-5 pb-3">
                          <div className="flex flex-wrap gap-2">
                            {booking.extras.map(ex => (
                              <span key={ex} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                                {isHe ? (EXTRA_LABELS[ex]?.he ?? ex) : (EXTRA_LABELS[ex]?.en ?? ex)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {booking.status === 'PENDING' && (
                        <div className="mx-5 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="text-xs text-amber-700 mb-2">
                            {isHe
                              ? '⏳ הזמנתך ממתינה לאישור. נציג SmartCar ייצור איתך קשר בקרוב.'
                              : '⏳ Your booking is awaiting confirmation. A SmartCar agent will contact you shortly.'}
                          </p>
                          {!cs && (
                            <button
                              onClick={() => handleCancelClick(booking.id)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 underline transition-colors"
                            >
                              {isHe ? 'בטל הזמנה' : 'Cancel booking'}
                            </button>
                          )}
                          {cs === 'confirm' && (
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-600 font-medium">
                                {isHe ? 'בטוח לבטל?' : 'Are you sure?'}
                              </span>
                              <button
                                onClick={() => handleCancelConfirm(booking.id)}
                                className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg transition-colors"
                              >
                                {isHe ? 'כן, בטל' : 'Yes, cancel'}
                              </button>
                              <button
                                onClick={() => handleCancelAbort(booking.id)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                {isHe ? 'לא' : 'No'}
                              </button>
                            </div>
                          )}
                          {cs === 'loading' && (
                            <p className="text-xs text-gray-400 mt-1">
                              {isHe ? 'מבטל...' : 'Cancelling...'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
