import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Nunito, Heebo } from 'next/font/google';
import { notFound } from 'next/navigation';
import { locales } from '../../../i18n';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import CookieBanner from '@/components/ui/CookieBanner';
import { Analytics } from '@vercel/analytics/react';
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';
import '../globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'hero' });

  return {
    title: {
      template: '%s | SmartCar',
      default: `SmartCar – ${t('title')}`,
    },
    description: t('subtitle'),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il'
    ),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        he: '/he',
        en: '/en',
        'x-default': '/he',
      },
    },
    openGraph: {
      siteName: 'SmartCar',
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      type: 'website',
      images: [
        {
          url: '/images/og-image.png',
          width: 1200,
          height: 630,
          alt: 'SmartCar – השכרת רכב עד בית הלקוח',
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/images/og-image.png'],
    },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as (typeof locales)[number])) notFound();

  const messages = await getMessages();
  const isRTL = locale === 'he';

  return (
    <html
      lang={locale}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${nunito.variable} ${heebo.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://iovpoxmdsgsstaduggvb.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://iovpoxmdsgsstaduggvb.supabase.co" />
      </head>
      <body
        className={`min-h-screen bg-gray-50 text-gray-900 antialiased flex flex-col ${
          isRTL ? 'font-[family-name:var(--font-heebo)]' : 'font-[family-name:var(--font-nunito)]'
        }`}
      >
        <NextIntlClientProvider messages={messages}>
          <a
            href={`/${locale}/accessibility`}
            className="fixed top-4 left-4 z-50 bg-[#2D5F5F] text-white p-3 rounded-full shadow-lg hover:bg-[#1A3A3A] transition-colors"
            aria-label={isRTL ? 'הצהרת נגישות' : 'Accessibility Statement'}
            title={isRTL ? 'נגישות' : 'Accessibility'}
          >
            <span aria-hidden="true">♿</span>
            <span className="sr-only">{isRTL ? 'נגישות' : 'Accessibility'}</span>
          </a>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <WhatsAppFloat />
          <CookieBanner />
          <Analytics />
          <GoogleAnalytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
