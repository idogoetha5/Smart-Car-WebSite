import Link from 'next/link';
import { rentalCopy, type RentalAdvice } from '@/lib/public-rental-content';

/** Server-rendered editorial help: useful without JavaScript or a carousel. */
export default function PublicRentalAdvice({ advice, locale }: { advice: RentalAdvice; locale: string }) {
  const isHe = locale === 'he';
  const links = [
    { path: 'rental', he: 'בחירת רכב ובקשת השכרה', en: 'Choose a car and request a rental' },
    { path: 'services/monthly', he: 'השכרת רכב לחודש', en: 'Monthly car rental' },
    { path: 'leasing', he: 'ליסינג פרטי ועסקי', en: 'Private and business leasing' },
    { path: 'terms', he: 'תנאי ההשכרה', en: 'Rental terms' },
  ];
  return (
    <section aria-label={isHe ? 'תכנון ההשכרה' : 'Planning your rental'} className="my-8 text-start">
      <p className="text-lg leading-relaxed text-gray-700 mb-6">{rentalCopy(advice.description, locale)}</p>
      {/* Each topic opens on tap: long pages stay short on a phone, and the
          text is still in the HTML for search engines. The first topic starts
          open so the page never looks empty. */}
      <div className="space-y-3">
        {advice.sections.map((section, index) => (
          <details key={section.heading.en} open={index === 0} className="group rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <h2 className="text-lg sm:text-xl font-bold text-[#0D2B2B]">{rentalCopy(section.heading, locale)}</h2>
              <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F4F7F7] text-xl leading-none text-[#2D5F5F] transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-4 pb-4 text-gray-700 leading-relaxed">{rentalCopy(section.text, locale)}</p>
          </details>
        ))}
      </div>
      <nav aria-label={isHe ? 'מידע נוסף להשכרה' : 'More rental information'} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {links.map((link) => (
          <Link key={link.path} href={`/${locale}/${link.path}`} className="flex min-h-12 items-center rounded-xl border border-[#2D5F5F]/20 bg-white px-4 py-3 font-medium text-[#2D5F5F] hover:bg-[#F4F7F7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F]">
            {isHe ? link.he : link.en}
          </Link>
        ))}
      </nav>
    </section>
  );
}
