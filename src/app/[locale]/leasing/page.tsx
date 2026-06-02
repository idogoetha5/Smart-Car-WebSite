export const revalidate = 60;

import { getTranslations } from 'next-intl/server';

const CATEGORY_ORDER: Record<string, number> = {
  MINI: 0, ECONOMY: 1, COMPACT: 2, SEDAN: 3,
  CROSSOVER: 4, SUV: 5, LUXURY: 6, VAN: 7, COMMERCIAL: 8, ELECTRIC: 9,
};
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Phone, Mail } from 'lucide-react';
import { getVehicles } from '@/lib/db/vehicles';
import { calcMinLeasingPrice } from '@/lib/pricing';
import type { Vehicle } from '@/types';
import { LeasingInquirySection } from './LeasingInquirySection';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'leasing' });
  const isHe = locale === 'he';
  return {
    title: t('title'),
    description: isHe
      ? 'ליסינג פרטי ועסקי – רכבים חדשים עם תנאים גמישים, כולל ביטוח ותחזוקה. קבל הצעת מחיר תוך 24 שעות.'
      : 'Private and business leasing – new cars with flexible terms including insurance and maintenance.',
    alternates: { canonical: `/${locale}/leasing` },
  };
}

function VehicleLeaseCard({ vehicle, locale }: { vehicle: Vehicle; locale: string }) {
  const isHe = locale === 'he';
  const img = vehicle.imageUrls?.[0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-[#B8D8D8] transition-all duration-300 flex flex-col">
      {/* Image */}
      <div className="relative h-44 bg-[#eef6f6] overflow-hidden">
        {img ? (
          <Image
            src={img}
            alt={`${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 80 48" fill="none" className="w-24 h-16 text-[#2D5F5F]">
              <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15"/>
              <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
              <circle cx="20" cy="38" r="6" fill="currentColor"/>
              <circle cx="60" cy="38" r="6" fill="currentColor"/>
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-1 mb-1">
          <h3 className="font-bold text-[#0D2B2B] text-base leading-tight">
            {vehicle.make} {vehicle.model}
          </h3>
          {(vehicle.colorHe || vehicle.colorEn) && (
            <span className="text-xs text-gray-400 shrink-0">
              {isHe ? vehicle.colorHe : vehicle.colorEn}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mb-3 flex gap-3">
          <span>{vehicle.seats} {isHe ? 'מושבים' : 'seats'}</span>
          <span>|</span>
          <span>{vehicle.transmission === 'AUTOMATIC' ? (isHe ? 'אוטומטי' : 'Auto') : (isHe ? 'ידני' : 'Manual')}</span>
        </div>

        <div className="mt-auto">
          <div className="text-xs text-gray-400 mb-1">{isHe ? 'ממחיר' : 'From'}</div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-black text-[#2D5F5F]">
              ₪{calcMinLeasingPrice(vehicle.category).toLocaleString()}
            </span>
            <span className="text-sm text-gray-400">/{isHe ? 'חודש' : 'month'}</span>
          </div>
          <div className="text-xs text-gray-400 mb-3">
            {isHe ? 'מינימום 12 חודשים' : 'Min. 12 months'}
          </div>
          <Link
            href={`/${locale}/leasing?vehicle=${vehicle.id}#calculator`}
            className="block w-full py-2.5 text-center bg-[#E8743B] hover:bg-[#d4632a] text-white font-bold rounded-xl transition-colors text-sm"
          >
            {isHe ? 'לפרטים' : 'Details'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function LeasingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === 'he';

  let allVehicles: Vehicle[] = [];
  try { allVehicles = await getVehicles({ isAvailable: true }); } catch {}

  // Deduplicate: one card per make/model/year, prefer white color
  const seen = new Map<string, Vehicle>();
  for (const v of allVehicles) {
    const key = `${v.make}|${v.model}|${v.year}`;
    if (!seen.has(key)) {
      seen.set(key, v);
    } else {
      const existing = seen.get(key)!;
      const isWhite = (s?: string | null) => s?.toLowerCase().includes('לבן') || s?.toLowerCase().includes('white');
      if (isWhite(v.colorHe) || isWhite(v.colorEn)) seen.set(key, v);
      else if (!isWhite(existing.colorHe) && !isWhite(existing.colorEn)) seen.set(key, v);
    }
  }
  const vehicles = Array.from(seen.values())
    .sort((a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99));

  const benefits = isHe
    ? [
        'תנאי ליסינג גמישים לכל צורך',
        'תחזוקה שוטפת כלולה בחבילה',
        'ביטוח מקיף ללא עלות נוספת',
        'שירות דרך ותמיכה 24/7',
      ]
    : [
        'Flexible leasing terms for any need',
        'Routine maintenance included',
        'Full insurance at no extra cost',
        '24/7 roadside service and support',
      ];

  return (
    <div>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="bg-[#0D2B2B] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex flex-col lg:flex-row items-center gap-12 ${isHe ? 'lg:flex-row-reverse' : ''}`}>

            {/* Text */}
            <div className={`flex-1 ${isHe ? 'text-right' : 'text-left'}`}>
              <p className="text-[#B8D8D8] text-sm font-semibold uppercase tracking-widest mb-4">
                {isHe ? 'ליסינג עסקי ופרטי' : 'Business & Private Leasing'}
              </p>
              <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
                {isHe ? (
                  <>ליסינג עסקי<br /><span className="text-[#E8743B]">חכם יותר</span></>
                ) : (
                  <>Business leasing<br /><span className="text-[#E8743B]">made smarter</span></>
                )}
              </h1>
              <p className="text-[#B8D8D8] text-lg mb-3">
                {isHe
                  ? 'תוכניות ליסינג מותאמות אישית לעסקים וללקוחות פרטיים, עם מגוון רכבים וגמישות מלאה'
                  : 'Tailored leasing plans for businesses and private customers, with a wide range of vehicles and full flexibility'}
              </p>
              <p className="text-[#E8743B] text-base font-semibold mb-8">
                {isHe ? 'קבל הצעת מחיר עוד היום!' : 'Get a quote today!'}
              </p>
              <div className={`flex gap-4 ${isHe ? 'justify-end flex-row-reverse' : ''}`}>
                <a
                  href="tel:09-9509757"
                  className="flex items-center gap-2 px-7 py-3.5 bg-[#E8743B] hover:bg-[#d4632a] text-white font-bold rounded-xl transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  09-9509757
                </a>
                <Link
                  href={`/${locale}/contact`}
                  className="px-7 py-3.5 border-2 border-white/40 hover:border-white text-white font-bold rounded-xl transition-colors"
                >
                  {isHe ? 'השאר פרטים' : 'Leave Details'}
                </Link>
              </div>
            </div>

            {/* Icon — fixed dimensions to avoid layout shift */}
            <div className="flex-shrink-0">
              <Image
                src="/images/icon-leasing.png"
                alt="Business Leasing"
                width={288}
                height={288}
                className="bg-white/10 rounded-3xl p-6"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ──────────────────────────────────────────── */}
      <section className="py-14 bg-[#2D5F5F] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div key={b} className={`flex items-start gap-3 ${isHe ? 'flex-row-reverse text-right' : ''}`}>
                <CheckCircle2 className="w-6 h-6 text-[#E8743B] shrink-0 mt-0.5" />
                <span className="text-[#B8D8D8] font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VEHICLE GRID ──────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`mb-10 ${isHe ? 'text-right' : 'text-left'}`}>
            <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">
              {isHe ? 'הצי שלנו' : 'Our Fleet'}
            </p>
            <h2 className="text-3xl font-black text-[#0D2B2B]">
              {isHe ? 'בחרו את הרכב שלכם' : 'Choose Your Vehicle'}
            </h2>
          </div>

          {vehicles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((v) => (
                <VehicleLeaseCard key={v.id} vehicle={v} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0,1,2,3,4,5].map((i) => (
                <div key={i} className="bg-white rounded-2xl h-72 animate-pulse border border-gray-100" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── INQUIRY SECTION (reads ?vehicle=id) ───────────────── */}
      <LeasingInquirySection vehicles={vehicles} locale={locale} />

      {/* ── LEASING TYPES ─────────────────────────────────────── */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(isHe
              ? [
                  { title: 'ליסינג פרטי', desc: 'תוכנית ליסינג לרכב פרטי עם תנאים גמישים ומחיר תחרותי', icon: '🚗' },
                  { title: 'ליסינג עסקי', desc: 'פתרונות ליסינג לעסקים עם אפשרות לניהול צי כלי רכב', icon: '🏢' },
                  { title: 'ליסינג מנהלים', desc: 'רכבי יוקרה עם תנאי ליסינג בלעדיים למנהלי חברות', icon: '⭐' },
                ]
              : [
                  { title: 'Private Leasing', desc: 'Personal leasing plan with flexible terms and competitive pricing', icon: '🚗' },
                  { title: 'Business Leasing', desc: 'Fleet leasing solutions for businesses of all sizes', icon: '🏢' },
                  { title: 'Executive Leasing', desc: 'Luxury vehicles with exclusive leasing terms for executives', icon: '⭐' },
                ]
            ).map((item) => (
              <div
                key={item.title}
                className={`p-7 rounded-2xl border-2 border-[#B8D8D8] bg-[#eef6f6] ${isHe ? 'text-right' : 'text-left'}`}
              >
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-black text-[#0D2B2B] text-xl mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT BAR ───────────────────────────────────────── */}
      <section className="py-12 bg-[#E8743B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 ${isHe ? 'sm:flex-row-reverse' : ''}`}>
            <div className={isHe ? 'text-right' : 'text-left'}>
              <h3 className="text-2xl font-black mb-1">
                {isHe ? 'מוכן להתחיל?' : 'Ready to start?'}
              </h3>
              <p className="text-white/80">
                {isHe ? 'צרו קשר ונדאג לכל השאר' : "Contact us and we'll take care of the rest"}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href="tel:09-9509757"
                className="flex items-center gap-2 px-7 py-3.5 bg-white text-[#E8743B] font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-md"
              >
                <Phone className="w-4 h-4" />
                09-9509757
              </a>
              <a
                href="mailto:office@smartcar.co.il"
                className="flex items-center gap-2 px-7 py-3.5 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-colors"
              >
                <Mail className="w-4 h-4" />
                office@smartcar.co.il
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
