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
      <div className="space-y-6">
        {advice.sections.map((section) => (
          <div key={section.heading.en}>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0D2B2B] mb-2">{rentalCopy(section.heading, locale)}</h2>
            <p className="text-gray-700 leading-relaxed">{rentalCopy(section.text, locale)}</p>
          </div>
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
