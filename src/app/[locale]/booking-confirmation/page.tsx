'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { Suspense, useSyncExternalStore } from 'react';
import Link from 'next/link';

interface StoredRequest {
  ref?: string;
  vehicle?: string;
  start?: string;
  end?: string;
  emailSent?: boolean;
}

/** The value never changes after mount, so there is nothing to subscribe to. */
const subscribeNoop = () => () => {};

// getSnapshot must be referentially stable or React loops, so the parsed
// object is cached after the first read.
let cachedRequest: StoredRequest | null = null;
let hasRead = false;

function readStoredRequest(): StoredRequest | null {
  if (hasRead) return cachedRequest;
  hasRead = true;
  try {
    const raw = sessionStorage.getItem('smartcar:last-request');
    cachedRequest = raw ? (JSON.parse(raw) as StoredRequest) : null;
  } catch {
    cachedRequest = null;
  }
  return cachedRequest;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';

  // Read from sessionStorage rather than the query string, so no booking id,
  // vehicle or dates end up in the URL. Falls back to a generic confirmation
  // when the entry is missing — a refresh in a new tab, or private mode.
  //
  // useSyncExternalStore rather than an effect: the server snapshot is null,
  // the client snapshot is the stored value, and hydration is correct without
  // a setState-in-effect cascade.
  const details = useSyncExternalStore(subscribeNoop, readStoredRequest, () => null);

  const vehicleName = details?.vehicle ?? null;
  const startDate = details?.start ?? null;
  const endDate = details?.end ?? null;
  const emailSent = details?.emailSent !== false;
  const confirmationNumber = details?.ref ?? (searchParams.get('id')?.slice(0, 8).toUpperCase() ?? 'PENDING');

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(isHe ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full text-start">

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-3xl font-bold text-[#0D2B2B]">
            {isHe ? 'בקשת ההשכרה התקבלה' : 'Your rental request has been received'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isHe
              ? 'שלחנו אליכם אישור על קבלת הבקשה. נציג SmartCar יבדוק את הזמינות בצי המלא ויחזור אליכם עם אישור ופרטים סופיים.'
              : 'We sent you a receipt confirming that the request reached us. A SmartCar representative will check the full fleet and contact you with final confirmation and details.'}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-5 text-sm text-amber-800 text-center">
          {isHe
            ? 'עד לקבלת אישור בכתב, הרכב והמחיר עדיין אינם מאושרים.'
            : 'The vehicle and price are not confirmed until you receive written confirmation.'}
        </div>

        <div className="bg-[#f0f7f7] border-s-4 border-[#2D5F5F] rounded-xl p-5 mb-6">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600">{isHe ? 'מספר בקשה' : 'Request number'}</p>
            <p className="text-3xl font-bold text-[#B64916]">#{confirmationNumber}</p>
          </div>
          <div className="space-y-2 text-sm">
            {vehicleName && (
              <div className="flex justify-between">
                <span className="text-gray-600">{isHe ? 'רכב' : 'Vehicle'}</span>
                <span className="font-medium">{vehicleName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">{isHe ? 'תאריך איסוף' : 'Pickup date'}</span>
              <span className="font-medium">{formatDate(startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{isHe ? 'תאריך החזרה' : 'Return date'}</span>
              <span className="font-medium">{formatDate(endDate)}</span>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-[#B64916] rounded-xl p-4 mb-6 text-center">
          <p className="text-sm text-gray-600">
            📧 {emailSent
              ? (isHe ? 'שלחנו לך אישור למייל' : 'We sent a confirmation to your email')
              : (isHe ? 'שמרנו את הבקשה שלך — אם לא קיבלת אישור למייל, ניתן ליצור קשר' : "We've saved your request — if you don't receive an email confirmation, feel free to reach out")}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            📞 {isHe ? 'לשאלות:' : 'Questions:'} <strong>09-9509757</strong>
          </p>
        </div>

        <Link
          href={`/${locale}`}
          className="block w-full bg-[#0D2B2B] text-white text-center py-3 rounded-xl font-bold hover:bg-[#1a3f3f] transition-colors"
        >
          {isHe ? 'חזרה לדף הבית' : 'Back to home'}
        </Link>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#2D5F5F] border-t-transparent rounded-full" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
