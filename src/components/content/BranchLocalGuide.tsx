import Link from 'next/link';
import type { Vehicle } from '@/types';
import type { BranchLocal } from '@/lib/branch-local-content';
import { vehicleType } from '@/lib/vehicle-search-metadata';

/** Fleet examples, directions, driving distances and local tips on a branch page. */
export default function BranchLocalGuide({ local, city, locale, vehicles }: { local: BranchLocal; city: string; locale: string; vehicles: readonly Vehicle[] }) {
  const isHe = locale === 'he';
  const lang = isHe ? 'he' : 'en';
  return (
    <>
      {vehicles.length > 0 && (
        <section className="mb-8" aria-labelledby="branch-cars">
          <h2 id="branch-cars" className="text-2xl font-bold text-[#0D2B2B] mb-4">
            {isHe ? `רכבים להשכרה ב${city}` : `Cars to rent in ${city}`}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map(vehicle => {
              const name = `${vehicle.make} ${vehicle.model}`;
              return (
                <li key={vehicle.id}>
                  <Link
                    href={`/${locale}/rental/${vehicle.id}`}
                    className="flex h-full min-h-14 flex-col justify-center rounded-2xl bg-white px-4 py-3 shadow-sm text-start hover:ring-2 hover:ring-[#2D5F5F] transition"
                  >
                    <span className="font-bold text-[#0D2B2B]">{isHe ? `${name} להשכרה` : `${name} rental`}</span>
                    <span className="text-sm text-gray-600">
                      {[vehicleType(vehicle, isHe), vehicle.seats ? `${vehicle.seats} ${isHe ? 'מושבים' : 'seats'}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm">
            <Link href={`/${locale}/rental`} className="font-semibold text-[#2D5F5F] underline underline-offset-4">
              {isHe ? 'לכל הרכבים ובחירת תאריכים' : 'See all cars and choose dates'}
            </Link>
          </p>
        </section>
      )}

      <section className="mb-8" aria-labelledby="branch-arrival">
        <h2 id="branch-arrival" className="text-2xl font-bold text-[#0D2B2B] mb-3">
          {isHe ? (city === 'נתב"ג' ? 'איך מקבלים את הרכב בנתב״ג' : `איך מגיעים לסניף ב${city}`) : (city === 'Ben Gurion Airport' ? 'How you receive the car at the airport' : `Getting to the ${city} branch`)}
        </h2>
        <p className="text-gray-700 leading-relaxed">{local.arrival[lang]}</p>
      </section>

      <section className="mb-8" aria-labelledby="branch-distances">
        <h2 id="branch-distances" className="text-2xl font-bold text-[#0D2B2B] mb-3">
          {isHe ? `מרחקי נסיעה מ${city}` : `Driving distances from ${city}`}
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">{isHe ? 'מרחק נסיעה משוער בכבישים הראשיים' : 'Approximate driving distance on main roads'}</caption>
            <thead className="bg-[#F4F7F7] text-[#0D2B2B]">
              <tr>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{isHe ? 'יעד' : 'Destination'}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{isHe ? 'מרחק משוער' : 'Approx. distance'}</th>
              </tr>
            </thead>
            <tbody>
              {local.distances.map(row => (
                <tr key={row.to.en} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{row.to[lang]}</td>
                  <td className="px-4 py-2 text-gray-700">{isHe ? `כ-${row.km} ק״מ` : `about ${row.km} km`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {isHe ? 'מרחק נסיעה משוער בכבישים הראשיים. זמן הנסיעה משתנה לפי שעה ועומסי תנועה.' : 'Approximate driving distance on main roads. Travel time depends on the hour and traffic.'}
        </p>
      </section>

      <section className="mb-8" aria-labelledby="branch-tips">
        <h2 id="branch-tips" className="text-2xl font-bold text-[#0D2B2B] mb-3">
          {isHe ? `טיפים לנהיגה וחניה ב${city}` : `Driving and parking tips for ${city}`}
        </h2>
        <ul className="space-y-3">
          {local.tips.map(tip => (
            <li key={tip.en} className="rounded-2xl bg-white p-4 shadow-sm text-gray-700 leading-relaxed">{tip[lang]}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
