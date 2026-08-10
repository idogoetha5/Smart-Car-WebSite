import { BRANCHES, branchAddress, branchName, getBranch, mapsUrl, wazeUrl } from '@/lib/branches';
import NewTabHint from '@/components/ui/NewTabHint';
import { localeAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { FACEBOOK_PAGE_URL } from '@/lib/constants';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHe = locale === 'he';
  return {
    // `absolute` bypasses the layout's "%s | SmartCar" template, which
    // would otherwise append a second "| SmartCar" to a title that already
    // carries the brand.
    title: {
      absolute: isHe
        ? 'SmartCar | השכרת רכב עד הבית, בכל הארץ'
        : 'SmartCar | Car Rental Delivered Across Israel',
    },
    description: isHe
      ? 'יותר מ־400 רכבים, ארבעה סניפים, מסירה והחזרה בתיאום מראש ומענה אנושי 24/7. שלחו בקשת השכרה ונציג SmartCar יתאים לכם רכב מהצי המלא.'
      : 'More than 400 vehicles, four branches, coordinated delivery and return, and 24/7 human support. Send a rental request and our team will match you with a vehicle from the full fleet.',
    alternates: localeAlternates(locale),
  };
}
import Image from 'next/image';
import { Suspense } from 'react';
import { getFeaturedVehicles } from '@/lib/db/vehicles';
import VehicleCard from '@/components/catalog/VehicleCard';
import HeroSection from '@/components/home/HeroSection';
import FaqSection, { FAQ_HE, FAQ_EN } from '@/components/home/FaqSection';
import NewsletterSection from '@/components/home/NewsletterSection';
import ReviewsSection from '@/components/home/ReviewsSection';

/* ─── Skeleton ────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-52 bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="grid grid-cols-2 gap-2">
          {[0,1,2,3].map(i => <div key={i} className="h-4 bg-gray-200 rounded" />)}
        </div>
        <div className="h-8 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

async function FeaturedVehicles() {
  let vehicles: Awaited<ReturnType<typeof getFeaturedVehicles>> = [];
  try { vehicles = await getFeaturedVehicles(); } catch {}

  if (vehicles.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[0,1,2].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.slice(0, 3).map(v => <VehicleCard key={v.id} vehicle={v} />)}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHe = locale === 'he';

  const WHY_US = isHe
    ? [
        { title: 'צי רחב ומגוון', desc: 'יותר מ־400 רכבים פרטיים, משפחתיים, מסחריים ורכבי יוקרה.' },
        { title: 'שירות עד הבית', desc: 'מסירה והחזרה בכל כתובת בארץ, בתיאום מראש.' },
        { title: 'זמינים 24/7', desc: 'מענה אנושי להזמנות, לשאלות ולשירות לאורך הדרך.' },
        { title: 'שירות אישי', desc: 'צוות מקצועי שמלווה אתכם מבחירת הרכב ועד ההחזרה.' },
      ]
    : [
        { title: 'A broad and varied fleet', desc: 'More than 400 private, family, commercial and luxury vehicles.' },
        { title: 'Door-to-door service', desc: 'Coordinated delivery and return at addresses across Israel.' },
        { title: 'Available 24/7', desc: 'Human support for requests, questions and assistance along the way.' },
        { title: 'Personal service', desc: 'A professional team that supports you from vehicle selection to return.' },
      ];

  const BRANCHES_DATA = BRANCHES.map((b) => ({
    name: branchName(b, locale),
    image: b.image,
    address: branchAddress(b, locale),
    phone: b.phone,
    wazeUrl: wazeUrl(b),
  }));

  const herzliya = getBranch('herzliya');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: 'SmartCar',
    description: isHe ? 'השכרת רכב עד בית הלקוח – צי רכבים איכותי בכל ישראל' : 'Car rental delivered to your door – quality fleet across Israel',
    url: `${baseUrl}/${locale}`,
    telephone: '+972-9-9509757',
    email: 'office@smartcar.co.il',
    priceRange: '₪₪',
    currenciesAccepted: 'ILS',
    paymentAccepted: 'Cash, Credit Card',
    openingHours: 'Su-Th 08:00-18:00',
    address: {
      '@type': 'PostalAddress',
      streetAddress: isHe ? herzliya.streetHe : herzliya.streetEn,
      addressLocality: isHe ? herzliya.cityHe : herzliya.cityEn,
      addressCountry: 'IL',
    },
    hasMap: mapsUrl(herzliya),
    sameAs: ['https://wa.me/97299509757', FACEBOOK_PAGE_URL],
  };

  // Sourced from the exact Q&A pairs FaqSection renders below — this must
  // never drift from what a visitor actually sees on the page.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (isHe ? FAQ_HE : FAQ_EN).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div dir={isHe ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />

      {/* ══ HERO + CATEGORIES ════════════════════════════════════ */}
      <HeroSection locale={locale} />

      {/* ══ כאן בשבילכם ══════════════════════════════════════════ */}
      <section className="py-14 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0D2B2B] text-center mb-10">
            {isHe ? 'למה SmartCar?' : 'Why SmartCar?'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {WHY_US.map(item => (
              <div key={item.title} className="text-start">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-[#C24E17] flex items-center justify-center flex-shrink-0">
                    <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </span>
                  <span className="font-bold text-[#0D2B2B] text-sm">{item.title}</span>
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ הסניפים שלנו ════════════════════════════════════════ */}
      <section className="py-10 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[#0D2B2B] text-center mb-3">
            {isHe ? 'הסניפים שלנו' : 'Our Locations'}
          </h2>
          <p className="text-sm text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            {isHe
              ? 'ארבעה סניפים ומסירה בתיאום מראש בכל הארץ. בחרו סניף או כתובת, ונציג יתאם את הפרטים.'
              : 'Four branches and coordinated delivery across Israel. Choose a branch or address, and our team will arrange the details.'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BRANCHES_DATA.map(b => (
              <div key={b.name} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow flex flex-col">
                <Link href={`/${locale}/branches`} className="block shrink-0">
                  <div className="relative w-full h-36">
                    <Image src={b.image} alt={b.name} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
                  </div>
                </Link>
                <div className="p-4 text-start flex flex-col flex-1">
                  <h3 className="font-bold text-[#0D2B2B] text-sm mb-1">{b.name}</h3>
                  <p className="text-xs text-gray-600 mb-2 leading-snug" style={{ minHeight: '33px' }}>📍 {b.address}</p>
                  <a href={`tel:${b.phone}`} className="text-xs text-[#B64916] font-semibold block mb-2">
                    📞 {b.phone}
                  </a>
                  <a
                    href={b.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1 text-xs bg-[#2D5F5F] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#1a3f3f] transition-colors"
                  >
                    🗺 Waze<NewTabHint isHe={isHe} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ שאלות נפוצות ════════════════════════════════════════ */}
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[#0D2B2B] text-center mb-10">
            {isHe ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
          </h2>
          <FaqSection locale={locale} />
        </div>
      </section>

      {/* ══ ביקורות לקוחות ══════════════════════════════════════ */}
      <ReviewsSection locale={locale} />

      {/* ══ רכבים נבחרים ════════════════════════════════════════ */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <Link
              href={`/${locale}/catalog`}
              className="text-sm text-[#2D5F5F] font-semibold hover:text-[#B64916] transition-colors"
            >
              {isHe ? '← כל הרכבים' : 'View full fleet →'}
            </Link>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? 'רכבים נבחרים' : 'Featured Vehicles'}
            </h2>
          </div>

          <Suspense fallback={
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[0,1,2].map(i => <SkeletonCard key={i} />)}
            </div>
          }>
            <FeaturedVehicles />
          </Suspense>

          <div className="mt-8 text-center">
            <Link
              href={`/${locale}/catalog`}
              className="inline-block px-8 py-3 bg-[#C24E17] hover:bg-[#d4632a] text-white font-bold rounded-full transition-colors shadow-md"
            >
              {isHe ? 'לכל הרכבים' : 'View All Vehicles'}
            </Link>
          </div>
        </div>
      </section>

      <NewsletterSection locale={locale} />

      {/* ══ דברו איתנו ══════════════════════════════════════════ */}
      <section className="py-14 bg-[#D6EFF7]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0D2B2B] mb-3">
            {isHe ? 'צריכים עזרה בבחירת רכב?' : 'Need help choosing a vehicle?'}
          </h2>
          <p className="text-gray-600 mb-8 text-sm">
            {isHe
              ? 'ספרו לנו מה אתם צריכים, ונחזור אליכם בהקדם האפשרי.'
              : 'Tell us what you need, and we will get back to you as soon as possible.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href="tel:09-9509757"
              className="flex items-center gap-2 px-6 py-3 bg-[#C24E17] hover:bg-[#d4632a] text-white font-bold rounded-full transition-colors shadow-md"
            >
              📞 09-9509757
            </a>
            <a
              href="https://wa.me/97299509757"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white font-bold rounded-full transition-colors"
            >
              {isHe ? 'שלח הודעה' : 'Send a Message'}<NewTabHint isHe={isHe} />
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
