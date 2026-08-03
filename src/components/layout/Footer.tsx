'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Mail, MapPin } from 'lucide-react';
import { branchAddress, getBranch, wazeUrl } from '@/lib/branches';
import { openCookiePreferences } from '@/lib/cookie-consent';
import { isAdminArea } from '@/lib/site-chrome';
import { FACEBOOK_PAGE_URL } from '@/lib/constants';

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

  // The public footer — marketing links, branches, legal pages — has no place
  // in the staff admin area, where on a phone it was simply a long block of
  // customer navigation under every screen.
  if (isAdminArea(pathname, locale)) return null;

  return (
    <footer className="bg-[#0D2B2B] text-[#B8D8D8]">
      {/* pb-28 on mobile only: below `sm` the legal-links row right above
          this padding stacks into a tall vertical list (flex-col), and the
          fixed WhatsApp button sitting at bottom-6 right-6 would otherwise
          land directly on top of its last one or two links once scrolled to
          the very bottom — confirmed by measuring real overlap at 320/390/430px.
          `sm:pb-12` restores the original spacing once the legal row goes
          horizontal and is no longer flush with the page's bottom edge. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-28 sm:pb-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href={`/${locale}`} className="flex items-center mb-4">
              {/* Same asset as the header logo. It's dark-teal-on-transparent
                  (there is no separate light/white variant), so brightness-0
                  + invert recolors it to a white silhouette that reads
                  against this dark footer background. */}
              <Image
                src="/images/logo.png"
                alt="SmartCar"
                width={120}
                height={40}
                className="h-9 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-[#7fb09f] mb-4">
              {locale === 'he'
                ? 'השכרת רכב, ליסינג ושירות אישי בכל הארץ.'
                : 'Car rental, leasing and personal service across Israel.'}
            </p>
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={toggleLanguage}
                className="text-xs px-3 py-1.5 rounded-full border border-[#2D5F5F] hover:border-[#B8D8D8] transition-colors text-[#B8D8D8]"
              >
                {locale === 'he' ? 'Switch to English' : 'עבור לעברית'}
              </button>
              <a
                href={FACEBOOK_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={locale === 'he' ? 'עמוד SmartCar בפייסבוק, נפתח בחלון חדש' : 'SmartCar on Facebook, opens in a new tab'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D8D8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D2B2B]"
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 fill-white"
                >
                  <path d="M13.6 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.4H7.4v3.2h2.8V21h3.4Z" />
                </svg>
              </a>
            </div>
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
                // Finding 95: this said "ליסינג עסקי" but pointed at
                // /services/business, whose heading is "רכב לעסק, מהשכרה קצרה
                // ועד צי קבוע" and whose CTAs mostly lead into the RENTAL
                // funnel. Someone asking for business leasing was sent
                // somewhere else. /leasing covers business explicitly, so the
                // label now matches where it goes.
                { href: `/${locale}/leasing`,          labelHe: 'ליסינג עסקי',       labelEn: 'Business Leasing' },
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
            {/* The site-wide route to the accessibility statement now that
                the floating button is homepage-only, so it has to show focus
                like any other control. */}
            <Link
              href={`/${locale}/accessibility`}
              className="rounded hover:text-[#B8D8D8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D8D8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D2B2B]"
            >
              {locale === 'he' ? 'נגישות' : 'Accessibility'}
            </Link>
            {/* The standalone link to the cookie policy is deliberately not
                here: the banner sentence links to it, and the privacy policy
                links to it. Three routes to one page is duplication, not
                availability.

                This control stays, and has to. The policy says preferences
                can be changed at any time, and the banner disappears once a
                choice is made — without this there would be no way back to
                withdraw consent. Kept small and quiet so it does not compete
                with the real actions. */}
            <button
              type="button"
              onClick={openCookiePreferences}
              className="hover:text-[#B8D8D8] transition-colors underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D8D8] rounded"
            >
              {locale === 'he' ? 'העדפות עוגיות' : 'Cookie Preferences'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
