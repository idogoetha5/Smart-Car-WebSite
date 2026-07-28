import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Car, ChevronRight, ChevronLeft } from 'lucide-react';
import RentalResults from './RentalResults';

/**
 * Finding 41. The whole page used to be a client component behind
 * `Suspense fallback={null}`, so the initial HTML contained no H1 and no
 * copy at all — everything appeared only after hydration. Search engines can
 * usually render JavaScript, but it delays discovery, and anyone whose JS
 * fails or is slow gets a blank page on the highest-intent route on the site.
 *
 * The heading and the explanation are static, so they belong on the server.
 * Only the filters and the vehicle grid need the browser, because the filters
 * hold local state and the dates come from useSearchParams — and
 * useSearchParams is what forces the Suspense boundary in the first place.
 *
 * The fallback is a visible skeleton rather than null, so the page never
 * flashes empty beneath a heading that is already there.
 */
export default async function RentalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  const isHe = locale === 'he';

  const steps = isHe
    // "שלח בקשה", not "אשר הזמנה": the final step submits a request that a
    // representative confirms in writing. Nothing is reserved here.
    ? ['בחר רכב', 'בחר תאריכים', 'מלא פרטים', 'שלח בקשה']
    : ['Choose vehicle', 'Select dates', 'Fill details', 'Send request'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <div className="flex items-center gap-2 text-blue-600 mb-3">
          <Car className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            {isHe ? 'השכרת רכב' : 'Car Rental'}
          </span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-3">{t('title')}</h1>
        <p className="text-gray-600 text-lg">
          {isHe
            ? 'באתר מוצג מבחר מהצי. לאחר שליחת הבקשה נבדוק את הצי המלא ונאשר את הרכב או קבוצת הרכב המתאימה.'
            : 'The website shows a selection from our fleet. After you send the request, we will check the full fleet and confirm the available vehicle or vehicle group.'}
        </p>
      </div>

      <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
        <h2 className="font-bold text-gray-800 mb-2">
          {isHe ? 'איך זה עובד?' : 'How it works'}
        </h2>
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <span>{step}</span>
              {i < steps.length - 1 &&
                (isHe ? (
                  <ChevronLeft className="w-4 h-4 text-gray-600" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" aria-hidden="true" />
                ))}
            </div>
          ))}
        </div>
      </div>

      <Suspense
        fallback={
          <div className="animate-pulse" aria-hidden="true">
            <div className="h-20 bg-gray-100 rounded-2xl mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 bg-gray-100 rounded-2xl" />
              ))}
            </div>
          </div>
        }
      >
        <RentalResults />
      </Suspense>
    </div>
  );
}
