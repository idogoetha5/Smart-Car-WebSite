import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { localeAlternates } from '@/lib/seo';
import { DELIVERY_CITIES, getDeliveryCity, hePrefix } from '@/lib/delivery-cities';
import { BRANCHES, branchAddress, branchName, mapsUrl, wazeUrl } from '@/lib/branches';

export function generateStaticParams() {
  return DELIVERY_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}): Promise<Metadata> {
  const { locale, city } = await params;
  const c = getDeliveryCity(city);
  if (!c) return {};
  const isHe = locale === 'he';
  const name = isHe ? c.nameHe : c.nameEn;
  return {
    title: {
      absolute: isHe ? `השכרת רכב עד לביתך ${hePrefix('ב', c.nameHe)} | SmartCar` : `Car Rental Delivered to ${name} | SmartCar`,
    },
    description: isHe
      ? `השכרת רכב מ-SmartCar עם מסירה והחזרה ${hePrefix('ב', c.nameHe)}, בתיאום מראש. צי רחב, שירות אישי ומענה אנושי.`
      : `Rent a car from SmartCar with delivery and return in ${name}, by prior arrangement. A wide fleet and personal service.`,
    alternates: localeAlternates(locale, `delivery/${c.slug}`),
  };
}

export default async function DeliveryCityPage({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}) {
  const { locale, city } = await params;
  const c = getDeliveryCity(city);
  if (!c) notFound();
  const isHe = locale === 'he';
  const name = isHe ? c.nameHe : c.nameEn;
  const branch = BRANCHES.find((b) => b.id === c.nearestBranch)!;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: 'SmartCar',
    description: isHe
      ? `השכרת רכב מ-SmartCar עם מסירה והחזרה ${hePrefix('ב', c.nameHe)}`
      : `Car rental from SmartCar with delivery and return in ${name}`,
    url: `${baseUrl}/${locale}/delivery/${c.slug}`,
    areaServed: { '@type': 'City', name },
    telephone: branch.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: isHe ? branch.streetHe : branch.streetEn,
      addressLocality: isHe ? branch.cityHe : branch.cityEn,
      addressCountry: 'IL',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isHe ? 'ראשי' : 'Home', item: `${baseUrl}/${locale}` },
      { '@type': 'ListItem', position: 2, name: isHe ? 'סניפים' : 'Branches', item: `${baseUrl}/${locale}/branches` },
      { '@type': 'ListItem', position: 3, name: isHe ? hePrefix('ב', c.nameHe) : `Delivery to ${name}`, item: `${baseUrl}/${locale}/delivery/${c.slug}` },
    ],
  };

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }}
      />

      <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
      <h1 className="text-3xl sm:text-4xl font-black text-[#0D2B2B] mb-6">
        {isHe ? `השכרת רכב עד לביתך ${hePrefix('ב', c.nameHe)}` : `Car Rental Delivered to ${name}`}
      </h1>

      <p className="text-gray-700 text-lg leading-relaxed mb-10">
        {isHe ? c.bodyHe : c.bodyEn}
      </p>

      <div className="bg-white rounded-2xl shadow-sm p-6 mb-10">
        <p className="text-sm text-gray-600 mb-3">
          {isHe ? 'הסניף הקרוב ביותר:' : 'Nearest branch:'}
        </p>
        <p className="text-[#0D2B2B] font-bold mb-1">{branchName(branch, locale)}</p>
        <p className="text-sm text-gray-600 mb-4">{branchAddress(branch, locale)}</p>
        <div className="flex gap-2 flex-wrap">
          <a
            href={wazeUrl(branch)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#007DAC] text-white py-2.5 px-4 rounded-xl text-center font-bold hover:bg-blue-500 transition-colors text-sm min-w-[100px]"
          >
            🧭 Waze
          </a>
          <a
            href={mapsUrl(branch)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#2D5F5F] text-white py-2.5 px-4 rounded-xl text-center font-bold hover:bg-[#1a3f3f] transition-colors text-sm min-w-[100px]"
          >
            🗺 {isHe ? 'מפות' : 'Maps'}
          </a>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/${locale}/rental`}
          className="flex-1 text-center bg-[#C24E17] hover:bg-[#d4632a] text-white font-bold rounded-full px-6 py-3 transition-colors shadow-md"
        >
          {isHe ? 'השכר רכב עכשיו' : 'Book a Vehicle'}
        </Link>
        <a
          href={`tel:${branch.phone}`}
          className="flex-1 text-center border-2 border-[#B64916] text-[#B64916] font-bold rounded-full px-6 py-3 hover:bg-orange-50 transition-colors"
        >
          📞 {branch.phone}
        </a>
      </div>
    </div>
  );
}
