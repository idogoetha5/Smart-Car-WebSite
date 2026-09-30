import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import '../globals.css';

// /driver is a sibling of [locale], not nested inside it (see src/proxy.ts's
// matcher — it's explicitly excluded from next-intl's locale routing), so
// unlike every localized page it inherits no <html>/<body>, Navbar, Footer
// or cookie banner from anywhere — the root src/app/layout.tsx is a bare
// pass-through. Same reasoning as src/app/global-not-found.tsx. This is
// also exactly what "no site chrome on /driver" needs, for free.
const heebo = Heebo({ subsets: ['hebrew', 'latin'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.smartcar.co.il'),
  title: 'SmartCar נהגים',
  description: 'אפליקציית נהגים לבדיקות רכב',
  robots: { index: false, follow: false },
  manifest: '/driver/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SmartCar נהגים',
  },
  icons: {
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'SmartCar נהגים',
    description: 'אפליקציית נהגים לבדיקות רכב',
    images: [{ url: '/images/logo.png' }],
    locale: 'he_IL',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
