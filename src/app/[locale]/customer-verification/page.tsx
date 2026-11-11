import type { Metadata } from 'next';
import VerificationForm from '@/components/customer-verification/VerificationForm';

/**
 * Unlisted page: reachable only through the personal link the office sends
 * on WhatsApp. Not in the menu, footer or sitemap, never indexed, and
 * without a valid token it shows only "link not valid".
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale !== 'en';
  // What WhatsApp shows in the link preview: title, one line, and the image.
  const title = isHe ? 'השלימו את ההזמנה – סמארט קאר' : 'Complete your booking – SmartCar';
  const description = isHe
    ? 'צילום רישיון ופרטי כרטיס בקישור אישי, מוצפן ומאובטח. כדקה אחת מהטלפון.'
    : 'Your licence photo and card details through a personal link, encrypted and secure. About a minute on your phone.';
  const image = {
    url: `/images/og-customer-verification-${isHe ? 'he' : 'en'}.png`,
    width: 1200,
    height: 630,
    alt: title,
    type: 'image/png',
  };
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: 'no-referrer',
    openGraph: {
      title,
      description,
      url: `/${locale}/customer-verification`,
      siteName: 'SmartCar',
      locale: isHe ? 'he_IL' : 'en_US',
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default async function CustomerVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(t) ? t : undefined;
  return <VerificationForm locale={locale === 'en' ? 'en' : 'he'} token={token} />;
}
