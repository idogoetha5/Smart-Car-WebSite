'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Car,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Tag,
  Star,
} from 'lucide-react';

export default function AdminSidebar() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push(`/${locale}/admin/login`);
  };

  const links = [
    {
      href: `/${locale}/admin`,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: `/${locale}/admin/vehicles`,
      label: t('manage_vehicles'),
      icon: Car,
    },
    {
      href: `/${locale}/admin/bookings`,
      label: t('manage_bookings'),
      icon: CalendarCheck,
    },
    {
      href: `/${locale}/admin/leasing-requests`,
      label: t('manage_leasing'),
      icon: FileText,
    },
    {
      href: `/${locale}/admin/cars-for-sale`,
      label: 'ניהול רכבים למכירה',
      icon: Tag,
    },
    {
      href: `/${locale}/admin/reviews`,
      label: 'ביקורות',
      icon: Star,
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-gray-900 text-gray-300 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2 text-white font-bold text-lg">
          <Car className="w-6 h-6 text-blue-400" />
          SmartCar Admin
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {locale === 'he' ? 'התנתק' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
