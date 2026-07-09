import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHe = locale === 'he';
  return {
    description: isHe
      ? 'SmartCar – השכרת רכב עם שירות עד בית הלקוח בכל ישראל. בחרו ממגוון רכבים: מיני, קומפקט, SUV וחשמלי. מחירים שקופים, הזמנה מהירה ותמיכה מלאה.'
      : 'SmartCar – car rental with home delivery across Israel. Choose from mini, compact, SUV and electric. Transparent pricing, fast booking, full support.',
    alternates: {
      canonical: `/${locale}`,
      languages: { he: '/he', en: '/en', 'x-default': '/he' },
    },
  };
}
import Image from 'next/image';
import { Suspense } from 'react';
import { getFeaturedVehicles } from '@/lib/db/vehicles';
import VehicleCard from '@/components/catalog/VehicleCard';
import HeroSection from '@/components/home/HeroSection';
import FaqSection from '@/components/home/FaqSection';
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
        { title: 'ביטוח מקיף', desc: 'ביטוח צד שלישי מלא כלול בכל הזמנה — נסיעה מוגנת בכל עת, ללא עלות נוספת' },
        { title: 'אמינות מוכחת', desc: 'כל רכב בצי שלנו עובר תחזוקה שוטפת ובדיקות בטיחות — מוכן לדרך בכל פעם' },
        { title: 'ציוד מלא', desc: 'כסאות ילדים, GPS, גגון ועוד — כל הנוחיות שתצטרכו, ללא הפתעות' },
        { title: 'שירות אישי', desc: 'נציגים זמינים לכל שאלה ובקשה — כי חווית הלקוח שלכם היא העדיפות שלנו' },
      ]
    : [
        { title: 'Full Insurance', desc: 'Comprehensive insurance included with every booking — drive protected, every time' },
        { title: 'Proven Reliability', desc: 'Every vehicle in our fleet is regularly serviced and road-tested — always ready when you need it' },
        { title: 'Complete Accessories', desc: 'Child seats, GPS, roof carriers and more — every comfort for every journey' },
        { title: 'Personal Service', desc: 'Our team is available around the clock — because your journey matters to us' },
      ];

  const BRANCHES_DATA = [
    {
      name: isHe ? 'סניף הרצליה' : 'Herzliya',
      image: '/images/branch-herzliya.webp',
      address: isHe ? 'רחוב רמת ים 122 (מלון דן אכדיה)' : '122 Ramat Yam St (Dan Accadia Hotel)',
      phone: '09-9509757',
      wazeUrl: 'https://www.waze.com/live-map/directions/il/tel-aviv-district/herzliya/smart-car?navigate=yes&to=place.ChIJJXb_-pRIHRURHCc4EPqsxxE',
    },
    {
      name: isHe ? 'סניף תל אביב' : 'Tel Aviv',
      image: '/images/branch-telaviv.webp',
      address: isHe ? 'מאפו 2 פינת הירקון 112' : '2 Mapu St, corner of HaYarkon 112',
      phone: '03-5233073',
      wazeUrl: 'https://waze.com/ul?ll=32.0853,34.7818&navigate=yes',
    },
    {
      name: isHe ? 'סניף ירושלים' : 'Jerusalem',
      image: '/images/branch-jerusalem.webp',
      address: isHe ? 'המלך דוד 8' : '8 King David St',
      phone: '02-6221150',
      wazeUrl: 'https://waze.com/ul?ll=31.7767,35.2345&navigate=yes',
    },
    {
      name: isHe ? 'נתב"ג' : 'Ben Gurion Airport',
      image: '/images/branch-airport.webp',
      address: isHe ? 'נמל התעופה בן גוריון' : 'Ben Gurion International Airport',
      phone: '09-9509757',
      wazeUrl: 'https://waze.com/ul?ll=32.0055,34.8854&navigate=yes',
    },
  ];

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
    openingHours: 'Su-Th 08:00-20:00',
    address: {
      '@type': 'PostalAddress',
      streetAddress: isHe ? 'רמת ים 122' : '122 Ramat Yam St',
      addressLocality: isHe ? 'הרצליה' : 'Herzliya',
      addressCountry: 'IL',
    },
    hasMap: 'https://maps.google.com/?q=רמת+ים+122+הרצליה',
    sameAs: ['https://wa.me/97299509757'],
  };

  return (
    <div dir={isHe ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
                  <span className="w-7 h-7 rounded-full bg-[#E8743B] flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </span>
                  <span className="font-bold text-[#0D2B2B] text-sm">{item.title}</span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ הסניפים שלנו ════════════════════════════════════════ */}
      <section className="py-10 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-[#0D2B2B] text-center mb-8">
            {isHe ? 'הסניפים שלנו' : 'Our Locations'}
          </h2>
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
                  <p className="text-xs text-gray-500 mb-2 leading-snug" style={{ minHeight: '33px' }}>📍 {b.address}</p>
                  <a href={`tel:${b.phone}`} className="text-xs text-[#E8743B] font-semibold block mb-2">
                    📞 {b.phone}
                  </a>
                  <a
                    href={b.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1 text-xs bg-[#2D5F5F] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#1a3f3f] transition-colors"
                  >
                    🗺 Waze
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
              className="text-sm text-[#2D5F5F] font-semibold hover:text-[#E8743B] transition-colors"
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
              className="inline-block px-8 py-3 bg-[#E8743B] hover:bg-[#d4632a] text-white font-bold rounded-full transition-colors shadow-md"
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
            {isHe ? 'דברו איתנו' : 'Get in Touch'}
          </h2>
          <p className="text-gray-600 mb-8 text-sm">
            {isHe
              ? 'צרו קשר ונחזור אליכם בהקדם האפשרי'
              : 'Our team is ready to assist — reach out and we will respond promptly'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href="tel:09-9509757"
              className="flex items-center gap-2 px-6 py-3 bg-[#E8743B] hover:bg-[#d4632a] text-white font-bold rounded-full transition-colors shadow-md"
            >
              📞 09-9509757
            </a>
            <a
              href="https://wa.me/97299509757"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white font-bold rounded-full transition-colors"
            >
              {isHe ? 'שלח הודעה' : 'Send a Message'}
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
