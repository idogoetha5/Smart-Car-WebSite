import ManagerShell from '@/components/app/ManagerShell';
import type { Metadata } from 'next';

// Own title/preview for the branch managers' pages (the link is shared on
// WhatsApp as smartcar.co.il/manager).
export const metadata: Metadata = {
  title: 'SmartCar מנהלים',
  description: 'הקצאת משימות לנהגים ומעקב',
  manifest: '/driver/manifest-manager',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SmartCar מנהלים' },
  openGraph: {
    title: 'SmartCar מנהלים',
    description: 'הקצאת משימות לנהגים ומעקב',
    images: [{ url: '/images/logo.png' }],
    locale: 'he_IL',
    type: 'website',
  },
};

export default function ManagerSectionLayout({ children }: { children: React.ReactNode }) {
  return <ManagerShell>{children}</ManagerShell>;
}
