export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };


import { getTranslations } from 'next-intl/server';
import { Car, CalendarCheck, FileText, TrendingUp, Tag } from 'lucide-react';
import StatsCard from '@/components/admin/StatsCard';
import DashboardChart from '@/components/admin/DashboardChart';
import Link from 'next/link';

async function getAdminStats(locale: string) {
  try {
    const { getVehicles } = await import('@/lib/db/vehicles');
    const { getActiveBookingsCount, getRecentBookings, getMonthlyRevenue, getWeeklyBookingCounts } =
      await import('@/lib/db/bookings');
    const { getPendingLeasingCount } = await import('@/lib/db/leasing');

    const [vehicles, activeBookings, pendingLeasing, monthlyRevenue, recentBookings, weeklyBookings] =
      await Promise.all([
        getVehicles(),
        getActiveBookingsCount(),
        getPendingLeasingCount(),
        getMonthlyRevenue(),
        getRecentBookings(5),
        getWeeklyBookingCounts(),
      ]);

    return {
      totalVehicles: vehicles.length,
      activeBookings,
      pendingLeasing,
      monthlyRevenue,
      recentBookings,
      weeklyBookings,
    };
  } catch {
    return {
      totalVehicles: 0,
      activeBookings: 0,
      pendingLeasing: 0,
      monthlyRevenue: 0,
      recentBookings: [],
      weeklyBookings: [],
    };
  }
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('admin');
  const stats = await getAdminStats(locale);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">
          {locale === 'he' ? 'ברוך הבא לפאנל הניהול' : 'Welcome to the admin panel'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <StatsCard
          title={t('total_vehicles')}
          value={stats.totalVehicles}
          icon={Car}
          color="blue"
        />
        <StatsCard
          title={t('active_bookings')}
          value={stats.activeBookings}
          icon={CalendarCheck}
          color="green"
        />
        <StatsCard
          title={t('pending_leasing')}
          value={stats.pendingLeasing}
          icon={FileText}
          color="yellow"
        />
        <StatsCard
          title={t('monthly_revenue')}
          value={`₪${stats.monthlyRevenue.toLocaleString()}`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {[
          {
            href: `/${locale}/admin/vehicles`,
            label: t('manage_vehicles'),
            icon: Car,
            color: 'bg-blue-600',
          },
          {
            href: `/${locale}/admin/bookings`,
            label: t('manage_bookings'),
            icon: CalendarCheck,
            color: 'bg-green-600',
          },
          {
            href: `/${locale}/admin/leasing-requests`,
            label: t('manage_leasing'),
            icon: FileText,
            color: 'bg-purple-600',
          },
          {
            href: `/${locale}/admin/cars-for-sale`,
            label: locale === 'he' ? 'ניהול רכבים למכירה' : 'Manage Cars for Sale',
            icon: Tag,
            color: 'bg-[#E8743B]',
          },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center gap-3 p-5 ${action.color} text-white rounded-2xl hover:opacity-90 transition-opacity shadow-sm`}
            >
              <Icon className="w-6 h-6" />
              <span className="font-semibold">{action.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bookings Chart – 7/30 day filter */}
      <DashboardChart locale={locale} />

      {/* Recent Bookings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {locale === 'he' ? 'הזמנות אחרונות' : 'Recent Bookings'}
          </h2>
          <Link
            href={`/${locale}/admin/bookings`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {locale === 'he' ? 'הצג הכל' : 'View all'}
          </Link>
        </div>
        {stats.recentBookings.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {stats.recentBookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{b.customerName ?? '—'}</p>
                  <p className="text-xs text-gray-400">
                    {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—'} ·{' '}
                    {b.pickupDate ? new Date(b.pickupDate).toLocaleDateString('he-IL') : ''}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold text-[#2D5F5F]">₪{Number(b.totalPrice ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{b.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">
            {locale === 'he' ? 'אין הזמנות עדיין' : 'No bookings yet'}
          </p>
        )}
      </div>
    </div>
  );
}
