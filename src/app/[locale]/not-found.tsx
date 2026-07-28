'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Locale-aware 404 for everything under /[locale].
 *
 * The root not-found.tsx shows Hebrew and English together, which is right
 * when there is no locale to read — but a visitor already on /he should not be
 * handed English, and neither page offered a way onward. An error page is a
 * trust moment, especially for someone arriving from an old link or an ad.
 *
 * not-found.tsx does not receive params, so the locale is read from the path.
 */
export default function LocaleNotFound() {
  const pathname = usePathname();
  const isHe = !pathname?.startsWith('/en');
  const locale = isHe ? 'he' : 'en';

  const t = isHe
    ? {
        title: 'הדף לא נמצא',
        body: 'ייתכן שהקישור ישן או שהעמוד הוסר. אפשר להמשיך מכאן:',
        fleet: 'לצי הרכבים',
        home: 'לדף הבית',
        contact: 'צרו קשר',
      }
    : {
        title: 'Page not found',
        body: 'The link may be out of date or the page may have moved. You can continue from here:',
        fleet: 'Browse the fleet',
        home: 'Home',
        contact: 'Contact us',
      };

  return (
    <div className="min-h-[70vh] bg-[#F5F0E8] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg viewBox="0 0 80 48" fill="none" className="w-32 h-20 text-[#2D5F5F] mx-auto" aria-hidden="true">
            <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15" />
            <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
            <circle cx="20" cy="38" r="6" fill="currentColor" />
            <circle cx="60" cy="38" r="6" fill="currentColor" />
          </svg>
        </div>
        <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-7xl font-black text-[#0D2B2B] mb-3">404</h1>
        <p className="text-xl text-gray-900 mb-2">{t.title}</p>
        <p className="text-gray-600 text-sm mb-8">{t.body}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/${locale}/rental`}
            className="px-6 py-3 bg-[#2D5F5F] text-white font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors"
          >
            {t.fleet}
          </Link>
          <Link
            href={`/${locale}`}
            className="px-6 py-3 border-2 border-[#2D5F5F] text-[#2D5F5F] font-bold rounded-xl hover:bg-[#2D5F5F]/5 transition-colors"
          >
            {t.home}
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="px-6 py-3 border-2 border-transparent text-[#2D5F5F] font-bold rounded-xl hover:bg-[#2D5F5F]/5 transition-colors"
          >
            {t.contact}
          </Link>
        </div>
      </div>
    </div>
  );
}
