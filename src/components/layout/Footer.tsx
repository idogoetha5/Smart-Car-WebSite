'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Mail, MapPin } from 'lucide-react';
import { branchAddress, getBranch, wazeUrl } from '@/lib/branches';
import { openCookiePreferences } from '@/lib/cookie-consent';

const HERZLIYA = getBranch('herzliya');
const TELAVIV = getBranch('telaviv');

export default function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  return (
    <footer className="bg-[#0D2B2B] text-[#B8D8D8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href={`/${locale}`} className="flex items-center mb-4">
              <svg width="120" height="36" viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg" aria-label="SmartCar">
                <text x="0" y="24" fontFamily="'Nunito', 'Heebo', sans-serif" fontWeight="800" fontSize="20" fill="#B8D8D8" letterSpacing="1.5">SMART</text>
                <text x="0" y="40" fontFamily="'Nunito', 'Heebo', sans-serif" fontWeight="800" fontSize="20" fill="#B8D8D8" letterSpacing="1.5">C<tspan fill="#E8743B">A</tspan>R</text>
              </svg>
            </Link>
            <p className="text-sm text-[#7fb09f] mb-4">
              {locale === 'he'
                ? 'השכרת רכב חכמה – מגוון רכבים איכותיים לכל צורך'
                : 'Premium car rental, delivered — quality vehicles for every journey'}
            </p>
            <button
              onClick={toggleLanguage}
              className="text-xs px-3 py-1.5 rounded-full border border-[#2D5F5F] hover:border-[#B8D8D8] transition-colors text-[#B8D8D8]"
            >
              {locale === 'he' ? 'Switch to English' : 'עבור לעברית'}
            </button>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-[#F5F0E8] font-bold mb-4">
              {locale === 'he' ? 'קישורים מהירים' : 'Quick Links'}
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: `/${locale}`,         label: tNav('home') },
                { href: `/${locale}/catalog`, label: tNav('catalog') },
                { href: `/${locale}/rental`,  label: tNav('rental') },
                { href: `/${locale}/leasing`, label: tNav('leasing') },
                { href: `/${locale}/about`,   label: locale === 'he' ? 'אודות' : 'About' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[#B64916] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-[#F5F0E8] font-bold mb-4">
              {locale === 'he' ? 'שירותים' : 'Services'}
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: `/${locale}/rental`,           labelHe: 'השכרת רכב יומית',  labelEn: 'Daily Car Rental' },
                { href: `/${locale}/leasing`,          labelHe: 'ליסינג פרטי',       labelEn: 'Private Leasing' },
                { href: `/${locale}/services/business`,labelHe: 'ליסינג עסקי',       labelEn: 'Business Leasing' },
                { href: `/${locale}/services/new-driver`,labelHe: 'נהג חדש',         labelEn: 'New Driver' },
                { href: `/${locale}/cars-for-sale`,    labelHe: 'רכבים למכירה',      labelEn: 'Cars for Sale' },
              ].map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="text-[#7fb09f] hover:text-[#B64916] transition-colors">
                    {locale === 'he' ? s.labelHe : s.labelEn}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-[#F5F0E8] font-bold mb-4">
              {locale === 'he' ? 'יצירת קשר' : 'Contact'}
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#B64916] shrink-0" />
                <a href={`tel:${HERZLIYA.phone}`} className="hover:text-[#F5F0E8] transition-colors">{HERZLIYA.phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#B64916] shrink-0" />
                <a href={`tel:${TELAVIV.phone}`} className="hover:text-[#F5F0E8] transition-colors">{TELAVIV.phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#B64916] shrink-0" />
                <a href="mailto:office@smartcar.co.il" className="hover:text-[#F5F0E8] transition-colors">office@smartcar.co.il</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#B64916] shrink-0 mt-0.5" />
                <a href={wazeUrl(HERZLIYA)} target="_blank" rel="noopener noreferrer" className="hover:text-[#F5F0E8] transition-colors">
                  {branchAddress(HERZLIYA, locale)}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-[#1A3A3A] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[#7fb09f]">
          <p>© 2008 SmartCar. {t('rights')}.</p>
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/insurance`} className="hover:text-[#B8D8D8] transition-colors">
              {locale === 'he' ? 'ביטוח' : 'Insurance'}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-[#B8D8D8] transition-colors">{t('privacy')}</Link>
            <Link href={`/${locale}/terms`} className="hover:text-[#B8D8D8] transition-colors">{t('terms')}</Link>
            <Link href={`/${locale}/accessibility`} className="hover:text-[#B8D8D8] transition-colors">
              {locale === 'he' ? 'נגישות' : 'Accessibility'}
            </Link>
            <Link href={`/${locale}/cookies`} className="hover:text-[#B8D8D8] transition-colors">
              {locale === 'he' ? 'עוגיות' : 'Cookies'}
            </Link>
            {/* The cookies policy states, in both locales, that preferences
                can be changed at any time from a control at the bottom of
                every page. This is that control — the label matches the
                wording already published on that page. */}
            <button
              type="button"
              onClick={openCookiePreferences}
              className="hover:text-[#B8D8D8] transition-colors underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D8D8] rounded"
            >
              {locale === 'he' ? 'העדפות עוגיות' : 'Cookie Preferences'}
            </button>
            <a
              href={`/${locale}/admin/login`}
              className="text-gray-600 hover:text-gray-600 transition-colors text-xs"
              title="ניהול"
            >
              ⚙️
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
