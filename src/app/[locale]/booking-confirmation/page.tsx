'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';

  const bookingId = searchParams.get('id');
  const vehicleName = searchParams.get('vehicle');
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  const confirmationNumber = bookingId?.slice(0, 8).toUpperCase() ?? 'PENDING';

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
            {isHe ? 'בקשתך התקבלה לבדיקה' : 'Your request is under review'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isHe
              ? 'ההזמנה תאושר רק לאחר שנציג יצור אתך קשר ויאשר את הזמינות והתשלום'
              : 'Booking is confirmed only after an agent contacts you to confirm availability and payment'}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-5 text-sm text-amber-800 text-center">
          {isHe
            ? '⚠️ זוהי בקשה בלבד — לא הסכם מחייב. ההזמנה תיכנס לתוקף לאחר אישור בכתב מנציג SmartCar.'
            : '⚠️ This is a request only — not a binding agreement. The booking takes effect only upon written confirmation from a SmartCar agent.'}
        </div>

        <div className="bg-[#f0f7f7] border-s-4 border-[#2D5F5F] rounded-xl p-5 mb-6">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500">{isHe ? 'מספר בקשה' : 'Request number'}</p>
            <p className="text-3xl font-bold text-[#E8743B]">#{confirmationNumber}</p>
          </div>
          <div className="space-y-2 text-sm">
            {vehicleName && (
              <div className="flex justify-between">
                <span className="text-gray-500">{isHe ? 'רכב' : 'Vehicle'}</span>
                <span className="font-medium">{vehicleName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">{isHe ? 'תאריך איסוף' : 'Pickup date'}</span>
              <span className="font-medium">{formatDate(startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isHe ? 'תאריך החזרה' : 'Return date'}</span>
              <span className="font-medium">{formatDate(endDate)}</span>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-[#E8743B] rounded-xl p-4 mb-6 text-center">
          <p className="text-sm text-gray-600">
            📧 {isHe ? 'שלחנו לך אישור למייל' : 'We sent a confirmation to your email'}
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
