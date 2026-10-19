export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };


import { getTranslations } from 'next-intl/server';
import { ArrowLeft, CalendarCheck, Car, FileText, MessageCircle, Plus, TrendingUp } from 'lucide-react';
import StatsCard from '@/components/admin/StatsCard';
import DashboardChart from '@/components/admin/DashboardChart';
import Link from 'next/link';

async function getAdminStats() {
  try {
    const { getVehicles } = await import('@/lib/db/vehicles');
    const { getActiveBookingsCount, getRecentBookings, getMonthlyRevenue } =
      await import('@/lib/db/bookings');
    const { getPendingLeasingCount } = await import('@/lib/db/leasing');

    const [vehicles, activeBookings, pendingLeasing, monthlyRevenue, recentBookings] =
      await Promise.all([
        getVehicles(),
        getActiveBookingsCount(),
        getPendingLeasingCount(),
        getMonthlyRevenue(),
        getRecentBookings(5),
      ]);

    return {
      totalVehicles: vehicles.length,
      activeBookings,
      pendingLeasing,
      monthlyRevenue,
      recentBookings,
    };
  } catch {
    return {
      totalVehicles: 0,
      activeBookings: 0,
      pendingLeasing: 0,
      monthlyRevenue: 0,
      recentBookings: [],
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
  const stats = await getAdminStats();

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-[#0D2B2B] px-5 py-6 text-white shadow-[0_16px_40px_rgba(13,43,43,0.18)] sm:px-8 sm:py-8">
        <div className="absolute -end-12 -top-16 h-48 w-48 rounded-full bg-[#2D5F5F] opacity-70 blur-2xl" />
        <div className="absolute -bottom-20 start-1/3 h-40 w-40 rounded-full bg-[#E8743B] opacity-20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#B8D8D8]">{locale === 'he' ? 'מרכז השליטה של SmartCar' : 'SmartCar control centre'}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">{locale === 'he' ? 'הפעולות החשובות והעדכניות — במקום אחד.' : 'The latest activity and key actions, all in one place.'}</p>
          </div>
          <Link href={`/${locale}/admin/rental-quotes`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#0D2B2B] transition-transform active:scale-[0.98]">
            <Plus className="h-5 w-5" />{locale === 'he' ? 'הצעת מחיר חדשה' : 'New rental quote'}
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 mb-8">
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

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#0D2B2B]">{locale === 'he' ? 'פעולות מהירות' : 'Quick actions'}</h2>
          <span className="text-sm font-bold text-slate-400">{locale === 'he' ? 'ליום עבודה מהיר' : 'For a faster workday'}</span>
        </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            href: `/${locale}/admin/bookings`, label: t('manage_bookings'), icon: CalendarCheck,
          },
          {
            href: `/${locale}/admin/rental-quotes`, label: locale === 'he' ? 'הצעת מחיר' : 'Rental quote', icon: FileText,
          },
          {
            href: `/${locale}/admin/inbox`, label: 'WhatsApp', icon: MessageCircle,
          },
          {
            href: `/${locale}/admin/vehicles`, label: t('manage_vehicles'), icon: Car,
          },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-[#0D2B2B] shadow-[0_8px_24px_rgba(13,43,43,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#B8D8D8] hover:shadow-[0_12px_28px_rgba(13,43,43,0.10)]"
            >
              <Icon className="h-6 w-6 text-[#2D5F5F]" />
              <span className="flex w-full items-center justify-between gap-2 text-sm font-black"><span>{action.label}</span><ArrowLeft className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-x-1" /></span>
            </Link>
          );
        })}
      </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <DashboardChart locale={locale} />

      <section className="bg-white rounded-3xl shadow-[0_8px_24px_rgba(13,43,43,0.05)] border border-slate-100 p-4 sm:p-6 xl:mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-[#0D2B2B]">
            {locale === 'he' ? 'הזמנות אחרונות' : 'Recent Bookings'}
          </h2>
          <Link
            href={`/${locale}/admin/bookings`}
            className="text-sm text-[#2D5F5F] hover:text-[#0D2B2B] font-black"
          >
            {locale === 'he' ? 'הצג הכל' : 'View all'}
          </Link>
        </div>
        {stats.recentBookings.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {stats.recentBookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-3.5 text-sm first:pt-0">
                <div className="min-w-0">
                  <p className="truncate font-black text-[#0D2B2B]">{b.customerName ?? '—'}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                    {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—'} ·{' '}
                    {b.pickupDate ? new Date(b.pickupDate).toLocaleDateString('he-IL') : ''}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-black text-[#2D5F5F]">₪{Number(b.totalPrice ?? 0).toLocaleString()}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{b.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">
            {locale === 'he' ? 'אין הזמנות עדיין' : 'No bookings yet'}
          </p>
        )}
      </section>
      </div>
    </div>
  );
}
