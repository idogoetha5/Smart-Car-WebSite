import Link from 'next/link';
import type { Vehicle } from '@/types';
import { RELATED_PAGES, SERVICE_QUESTIONS, serviceVehicles } from '@/lib/service-page-content';
import { vehicleType } from '@/lib/vehicle-search-metadata';
import JsonLd from '@/components/seo/JsonLd';

/** Matching cars, common questions and related pages under a service page. */
export default function ServiceExtras({ type, locale, fleet }: { type: string; locale: string; fleet: readonly Vehicle[] }) {
  const isHe = locale === 'he';
  const lang = isHe ? 'he' : 'en';
  const vehicles = serviceVehicles(type, fleet);
  const questions = SERVICE_QUESTIONS[type] ?? [];
  const related = RELATED_PAGES.filter(page => page.path !== `services/${type}` && !(type === 'leasing' && page.path === 'leasing'));

  return (
    <>
      {vehicles.length > 0 && (
        <section className="bg-white py-14 px-6" aria-labelledby="service-vehicles">
          <div className="max-w-4xl mx-auto">
            <h2 id="service-vehicles" className="text-2xl font-bold text-[#0D2B2B] mb-6 text-start">
              {type === 'commercial'
                ? (isHe ? 'רכבים מסחריים בצי' : 'Commercial vehicles in our fleet')
                : type === 'new-driver'
                  ? (isHe ? 'רכבים קטנים שמתאימים לנהגים חדשים' : 'Small cars that suit new drivers')
                  : (isHe ? 'דוגמאות מהצי' : 'Examples from our fleet')}
            </h2>
            <p className="mb-4 text-start text-gray-700 leading-relaxed">
              {isHe ? 'אלה רק כמה דוגמאות מתוך הצי. את כל הרכבים אפשר לראות בדף הרכבים.' : 'These are only a few examples from the fleet. All the cars are on the cars page.'}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vehicles.map(vehicle => {
                const name = `${vehicle.make} ${vehicle.model}`;
                const kind = vehicleType(vehicle, isHe);
                return (
                  <li key={vehicle.id}>
                    <Link
                      href={`/${locale}/rental/${vehicle.id}`}
                      className="flex h-full min-h-14 flex-col justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-start hover:border-[#2D5F5F] hover:bg-white transition-colors"
                    >
                      <span className="font-bold text-[#0D2B2B]">{isHe ? `${name} להשכרה` : `${name} rental`}</span>
                      <span className="text-sm text-gray-600">
                        {[kind, vehicle.seats ? `${vehicle.seats} ${isHe ? 'מושבים' : 'seats'}` : ''].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-start">
              <Link href={`/${locale}/${type === 'commercial' ? 'rental?category=COMMERCIAL' : 'rental'}`} className="font-semibold text-[#2D5F5F] underline underline-offset-4">
                {isHe ? 'לכל הרכבים בצי' : 'See the whole fleet'}
              </Link>
            </p>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section className="bg-gray-50 py-14 px-6" aria-labelledby="service-questions">
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: questions.map(item => ({
                '@type': 'Question',
                name: item.q[lang],
                acceptedAnswer: { '@type': 'Answer', text: item.a[lang] },
              })),
            }}
          />
          <div className="max-w-3xl mx-auto">
            <h2 id="service-questions" className="text-2xl font-bold text-[#0D2B2B] mb-6 text-start">
              {isHe ? 'שאלות נפוצות' : 'Frequently asked questions'}
            </h2>
            <div className="space-y-3">
              {questions.map(item => (
                <details key={item.q.en} className="group rounded-xl bg-white p-4 shadow-sm text-start">
                  <summary className="cursor-pointer list-none font-semibold text-[#0D2B2B] min-h-11 flex items-center justify-between gap-3">
                    {item.q[lang]}
                    <span aria-hidden="true" className="text-[#2D5F5F] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-gray-700">
                    {item.a[lang]}
                    {item.href && (
                      <>
                        {' '}
                        <Link href={`/${locale}/${item.href}`} className="font-semibold text-[#2D5F5F] underline underline-offset-4">
                          {isHe ? 'לפרטים נוספים' : 'More details'}
                        </Link>
                      </>
                    )}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <nav className="bg-white py-12 px-6" aria-labelledby="service-related">
        <div className="max-w-4xl mx-auto">
          <h2 id="service-related" className="text-xl font-bold text-[#0D2B2B] mb-4 text-start">
            {isHe ? 'עוד ב-SmartCar' : 'More from SmartCar'}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {related.map(page => (
              <li key={page.path}>
                <Link href={`/${locale}/${page.path}`} className="inline-flex min-h-11 items-center rounded-full border border-gray-200 px-4 text-sm text-[#0D2B2B] hover:border-[#2D5F5F] transition-colors">
                  {page[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
