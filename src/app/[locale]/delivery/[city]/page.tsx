import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { localeAlternates, ogImage } from '@/lib/seo';
import { DELIVERY_CITIES, deliverySearchCopy, getDeliveryCity, hePrefix, isDeliveryRegion } from '@/lib/delivery-cities';
import { BRANCHES, branchAddress, branchName, mapsUrl, wazeUrl } from '@/lib/branches';
import { WHATSAPP_NUMBER } from '@/lib/constants';

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
  const { title, description } = deliverySearchCopy(c, locale);
  return {
    title: { absolute: title },
    description,
    alternates: localeAlternates(locale, `delivery/${c.slug}`),
    openGraph: { title, description, url: `/${locale}/delivery/${c.slug}`, type: 'website', siteName: 'SmartCar', locale: isHe ? 'he_IL' : 'en_US', images: [ogImage(locale)] },
    twitter: { card: 'summary_large_image', title, description, images: ['/images/og-image.png'] },
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
    areaServed: { '@type': isDeliveryRegion(c) ? 'Place' : 'City', name },
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
        {deliverySearchCopy(c, locale).heading}
      </h1>

      <p className="text-gray-700 text-lg leading-relaxed mb-10">
        {isHe ? c.bodyHe : c.bodyEn}
      </p>

      <section aria-labelledby="delivery-arrangements" className="mb-10 space-y-4 text-gray-700 leading-relaxed">
        <h2 id="delivery-arrangements" className="text-xl font-bold text-[#0D2B2B]">
          {isHe ? 'איך מתאמים מסירה?' : 'How do you arrange delivery?'}
        </h2>
        <p>{isHe
          ? 'שלחו לנו את כתובות האיסוף וההחזרה ואת התאריכים והשעות הרצויים. נבדוק את זמינות הרכב ואת עלות המסירה וההחזרה, ונתאם את הפרטים לפני האישור. האומדן באתר אינו מחיר סופי.'
          : 'Send us your collection and return addresses, dates and preferred times. We will check vehicle availability and delivery and return costs, then agree the details before confirmation. The website estimate is not a final price.'}</p>
        <p>{isDeliveryRegion(c)
          ? (isHe ? 'ציינו גם את היישוב, ולא רק את האזור. אפשר לבחור מסירה לכתובת או איסוף מאחד הסניפים שלנו.' : 'Include the town as well as the region. You can request delivery to an address or collect from one of our branches.')
          : (isHe ? `אין לנו סניף ${hePrefix('ב', c.nameHe)}. אפשר לבקש מסירה לכתובת בעיר או לבחור איסוף מאחד הסניפים שלנו.` : `We do not have a branch in ${name}. You can request delivery to an address in the city or collect from one of our branches.`)}</p>
        <nav aria-label={isHe ? 'מידע לתכנון ההשכרה' : 'Rental planning links'} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
          {[
            { path: 'services/daily', label: isHe ? 'השכרה ליום או לסוף שבוע' : 'Daily and weekend rental' },
            { path: 'services/monthly', label: isHe ? 'השכרה לחודש' : 'Monthly rental' },
            { path: 'branches', label: isHe ? 'כל הסניפים' : 'All branches' },
          ].map(item => <Link key={item.path} href={`/${locale}/${item.path}`} className="min-h-12 flex items-center justify-center rounded-xl border border-[#D5E4E4] bg-white px-3 py-2 text-center text-sm font-semibold text-[#2D5F5F] hover:bg-[#EDF5F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F]">{item.label}</Link>)}
        </nav>
      </section>

      <div className="bg-white rounded-2xl shadow-sm p-6 mb-10">
        <p className="text-sm text-gray-600 mb-3">
          {isHe ? 'אפשר גם לאסוף בסניף:' : 'You can also collect from this branch:'}
        </p>
        <p className="text-[#0D2B2B] font-bold mb-1">{branchName(branch, locale)}</p>
        <p className="text-sm text-gray-600 mb-4">{branchAddress(branch, locale)}</p>
        <Link href={`/${locale}/branches/${branch.id}`} className="mb-3 min-h-12 inline-flex items-center text-sm font-semibold text-[#2D5F5F] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
          {isHe ? 'פרטי הסניף' : 'Branch details'}
        </Link>
        <div className="flex gap-2 flex-wrap">
          <a
            href={wazeUrl(branch)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-12 bg-[#007DAC] text-white py-2.5 px-4 rounded-xl text-center font-bold hover:bg-blue-500 transition-colors text-sm min-w-[100px]"
          >
            🧭 Waze
          </a>
          <a
            href={mapsUrl(branch)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-12 bg-[#2D5F5F] text-white py-2.5 px-4 rounded-xl text-center font-bold hover:bg-[#1a3f3f] transition-colors text-sm min-w-[100px]"
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
          {isHe ? 'שליחת בקשת השכרה' : 'Send a rental request'}
        </Link>
        <a
          href={`tel:${branch.phone}`}
          className="flex-1 text-center border-2 border-[#B64916] text-[#B64916] font-bold rounded-full px-6 py-3 hover:bg-orange-50 transition-colors"
        >
          📞 {branch.phone}
        </a>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center bg-[#25D366] hover:opacity-90 text-white font-bold rounded-full px-6 py-3 transition-opacity"
        >
          {isHe ? 'וואטסאפ' : 'WhatsApp'}
        </a>
      </div>
    </div>
  );
}
