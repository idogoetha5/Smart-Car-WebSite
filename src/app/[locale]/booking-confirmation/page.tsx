import { Suspense } from 'react';
import Link from 'next/link';
import RequestDetails, { RequestDetailsBox } from './RequestDetails';

// Server component: the whole page is in the pre-rendered HTML, so the
// customer sees the confirmation at once. Only the request-specific box
// (number, vehicle, dates — read from sessionStorage and the URL in the
// browser) waits for the page script; until then it shows placeholders of
// the same size, so nothing jumps when it fills in.
export default async function BookingConfirmationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale !== 'en';

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

        <Suspense
          fallback={
            <RequestDetailsBox isHe={isHe} confirmationNumber="…" vehicleName={null} startDate={null} endDate={null} emailSent />
          }
        >
          <RequestDetails isHe={isHe} />
        </Suspense>

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
