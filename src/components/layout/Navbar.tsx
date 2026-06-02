'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isRTL = locale === 'he';

  const navLinks = [
    { href: `/${locale}/catalog`,       label: t('catalog') },
    { href: `/${locale}/rental`,        label: t('rental') },
    { href: `/${locale}/leasing`,       label: t('leasing') },
    { href: `/${locale}/cars-for-sale`, label: t('cars_for_sale') },
    { href: `/${locale}/branches`,      label: isRTL ? 'סניפים' : 'Branches' },
    { href: `/${locale}/about`,         label: isRTL ? 'אודות' : 'About' },
    { href: `/${locale}/contact`,        label: t('contact') },
    { href: `/${locale}/my-bookings`,   label: t('my_bookings') },
  ];

  const toggleLanguage = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  const isActive = (href: string) =>
    pathname === href || (href !== `/${locale}` && pathname.startsWith(href));

  return (
    <nav dir={isRTL ? 'rtl' : 'ltr'} className="sticky top-0 z-50 bg-white/97 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo — sits on right in RTL, left in LTR */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/${locale}`} className="flex items-center">
              <Image src="/images/logo.png" alt="SmartCar" width={120} height={40} className="h-10 w-auto object-contain" priority />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold transition-all px-3 py-2 rounded-lg ${
                  isActive(link.href)
                    ? 'text-[#2D5F5F] bg-[#eef6f6]'
                    : 'text-gray-500 hover:text-[#2D5F5F] hover:bg-[#f0f7f7]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions — sits on left in RTL, right in LTR */}
          <div className="flex items-center gap-3">
            {/* Lang toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-colors"
              aria-label="Toggle language"
            >
              <span>{locale === 'he' ? '🇮🇱 עב' : '🇺🇸 EN'}</span>
              <span className="text-gray-400">→</span>
              <span>{locale === 'he' ? 'EN' : 'עב'}</span>
            </button>

            {/* CTA button */}
            <Link
              href={`/${locale}/rental`}
              className="hidden md:block px-5 py-2 bg-[#E8743B] text-white text-sm font-bold rounded-xl hover:bg-[#d4632a] transition-colors shadow-sm"
            >
              {t('rental')}
            </Link>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-4" dir={isRTL ? 'rtl' : 'ltr'}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                  isActive(link.href)
                    ? 'text-[#2D5F5F] bg-[#eef6f6]'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 px-4">
              <Link
                href={`/${locale}/rental`}
                className="block w-full py-3 text-center bg-[#E8743B] text-white font-bold rounded-xl hover:bg-[#d4632a] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('rental')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
