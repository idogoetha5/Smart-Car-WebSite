export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };


import { getTranslations } from 'next-intl/server';
import { ArrowLeft, CalendarCheck, Car, ExternalLink, FileText, MessageCircle, Plus, Table2, TrendingUp } from 'lucide-react';
import StatsCard from '@/components/admin/StatsCard';
import ContactLeadAction from '@/components/admin/ContactLeadAction';
import Link from 'next/link';
import BookingStatusBadge from '@/components/ui/BookingStatusBadge';
import { numericOrderReference } from '@/lib/order-reference';

async function getAdminStats() {
  try {
    const { getVehicles } = await import('@/lib/db/vehicles');
    const { getActiveBookingsCount, getPendingBookingsCount, getRecentBookings, getMonthlyRevenue } =
      await import('@/lib/db/bookings');
    const { getPendingLeasingCount } = await import('@/lib/db/leasing');

    const [vehicles, activeBookings, pendingLeasing, monthlyRevenue, recentBookings, pendingBookings] =
      await Promise.all([
        getVehicles(),
        getActiveBookingsCount(),
        getPendingLeasingCount(),
        getMonthlyRevenue(),
        getRecentBookings(5),
        getPendingBookingsCount(),
      ]);

    return {
      totalVehicles: vehicles.length,
      activeBookings,
      pendingLeasing,
      monthlyRevenue,
      recentBookings,
      pendingBookings,
      loadFailed: false,
    };
  } catch {
    return {
      totalVehicles: 0,
      activeBookings: 0,
      pendingLeasing: 0,
      monthlyRevenue: 0,
      recentBookings: [],
      pendingBookings: 0,
      loadFailed: true,
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
      {stats.loadFailed && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{locale === 'he' ? 'נתוני לוח הבקרה אינם זמינים כרגע. אפשר להמשיך לעבוד דרך דפי הניהול.' : 'Dashboard figures are temporarily unavailable. You can still use the management pages.'}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 mb-8">
        <StatsCard
          title={locale === 'he' ? 'דגמים בקטלוג' : 'Catalogue models'}
          value={stats.loadFailed ? '—' : stats.totalVehicles}
          href={`/${locale}/admin/vehicles`}
          icon={Car}
          color="blue"
        />
        <StatsCard
          title={locale === 'he' ? 'הזמנות פתוחות' : 'Open bookings'}
          value={stats.loadFailed ? '—' : stats.activeBookings}
          trend={locale === 'he' ? 'ממתינות, מאושרות ופעילות' : 'Pending, confirmed and active'}
          href={`/${locale}/admin/bookings`}
          icon={CalendarCheck}
          color="green"
        />
        <StatsCard
          title={t('pending_leasing')}
          value={stats.loadFailed ? '—' : stats.pendingLeasing}
          href={`/${locale}/admin/leasing-requests`}
          icon={FileText}
          color="yellow"
        />
        <StatsCard
          title={locale === 'he' ? 'שווי הזמנות החודש' : 'Monthly booking value'}
          value={stats.loadFailed ? '—' : `₪${stats.monthlyRevenue.toLocaleString()}`}
          trend={locale === 'he' ? 'מאושרות ומעלה · לא גבייה בפועל' : 'Confirmed or later · not payments collected'}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {!stats.loadFailed && stats.pendingBookings > 0 && <Link href={`/${locale}/admin/bookings?status=PENDING`} className="mb-6 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900"><span>{locale === 'he' ? `${stats.pendingBookings} הזמנות ממתינות לאישור` : `${stats.pendingBookings} bookings await approval`}</span><ArrowLeft className="h-5 w-5 shrink-0" /></Link>}

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
        <section className="relative overflow-hidden rounded-3xl border border-[#D7E8E8] bg-white p-5 shadow-[0_8px_24px_rgba(13,43,43,0.05)] sm:p-7">
          <div className="absolute -end-16 -top-16 h-40 w-40 rounded-full bg-[#E5F3F3] blur-2xl" />
          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E5F3F3] text-[#2D5F5F]">
                  <Table2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black tracking-wide text-[#2D5F5F]">{locale === 'he' ? 'מרכז לידים' : 'LEADS CENTRE'}</p>
                  <h2 className="mt-1 text-xl font-black text-[#0D2B2B]">{locale === 'he' ? 'לידים ומספרי טלפון' : 'Leads & phone numbers'}</h2>
                  <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                    {locale === 'he'
                      ? 'פניות חדשות מהאתר נוספות לגיליון כל 5 דקות: השכרה, ליסינג, צור קשר ו־WhatsApp. עריכות שלך בגיליון נשמרות.'
                      : 'New rental, leasing, contact and WhatsApp leads are added to the sheet every 5 minutes. Your edits in the sheet are preserved.'}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full border border-[#B8D8D8] bg-[#E5F3F3] px-3 py-1.5 text-xs font-black text-[#1F5A56]">
                {locale === 'he' ? 'הסנכרון פעיל' : 'Sync active'}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                locale === 'he' ? 'הזמנות' : 'Bookings',
                locale === 'he' ? 'פניות צור קשר' : 'Contact requests',
                locale === 'he' ? 'ליסינג וטלפונים' : 'Leasing & phone numbers',
              ].map((item, index) => index === 1 ? <ContactLeadAction key="contact" locale={locale} /> : (
                <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm font-black text-[#0D2B2B]">
                  <span className="block h-2 w-2 rounded-full bg-[#E8743B]" />
                  <span className="mt-2 block">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href={`/${locale}/admin/leads`}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#2D5F5F] px-4 py-3 text-center text-sm font-black text-white shadow-[0_10px_20px_rgba(45,95,95,0.22)] transition hover:bg-[#1F4C4C] active:scale-[0.98]"
              >
                <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
                {locale === 'he' ? 'פניות ולידים בממשק' : 'Leads workspace'}
              </Link>
              <a
                href="https://docs.google.com/spreadsheets/d/1Ve0QjN471GdNno0mxfRkHmigozjRoBdoOr84PFNZH04/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#B8D8D8] bg-[#EAF4F4] px-4 py-3 text-center text-sm font-black text-[#1F5A56] transition hover:bg-[#DCEDED] active:scale-[0.98]"
              >
                <Table2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                {locale === 'he' ? 'פתיחת גיליון Google Sheets' : 'Open Google Sheets'}
                <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
              </a>
            </div>

            <p className="mt-5 border-t border-[#E5F0F0] pt-4 text-xs font-semibold leading-5 text-slate-400">
              {locale === 'he'
                ? 'הגיליון נקי מרשומות בדיקה ומכיל פניות לקוחות בלבד. ההזמנות עצמן נשארות מנוהלות כאן בממשק.'
                : 'The sheet excludes test entries and contains customer leads only. Bookings remain managed here in the office dashboard.'}
            </p>
          </div>
        </section>

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
              <Link key={b.id} href={`/${locale}/admin/bookings?booking=${encodeURIComponent(b.id)}`} className="flex items-center justify-between gap-3 rounded-xl py-3.5 text-sm first:pt-0 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate font-black text-[#0D2B2B]">{b.customerName ?? '—'} <bdi className="text-xs text-slate-400">#{numericOrderReference(b.id)}</bdi></p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                    {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—'} ·{' '}
                    {b.pickupDate ? new Date(b.pickupDate).toLocaleDateString('he-IL') : ''}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="font-black text-[#2D5F5F]">₪{Number(b.totalPrice ?? 0).toLocaleString()}</p>
                  <div className="mt-1"><BookingStatusBadge status={b.status} locale={locale} variant="admin" /></div>
                </div>
              </Link>
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
