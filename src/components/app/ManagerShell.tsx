'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { CalendarDays, Car, FileCheck2, FileText, LayoutDashboard, LogOut, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { fetcher } from '@/lib/swr';
import PushBell from '@/components/app/PushBell';
import { brandIconButton } from '@/components/app/Brand';
import Avatar from '@/components/ui/Avatar';
import { ToastProvider } from '@/components/ui/AppToast';
import { ManagerDataProvider, useManager } from '@/components/manager/ManagerData';
import TaskSheet from '@/components/manager/TaskSheet';
import NewTaskSheet from '@/components/manager/NewTaskSheet';
import { PhoneActions, SidebarActions } from '@/components/manager/QuickActions';

const NAV = [
  { href: '/driver/manage', label: 'היום', icon: LayoutDashboard },
  { href: '/driver/manage/calendar', label: 'יומן', icon: CalendarDays },
  { href: '/driver/manage/vehicles', label: 'רכבים', icon: Car },
  { href: '/driver/manage/drivers', label: 'נהגים', icon: Users },
  { href: '/driver/manage/signed', label: 'מסמכים', icon: FileCheck2 },
  { href: '/driver/manage/quotes', label: 'הצעות מחיר', icon: FileText },
] as const;

function NavBadge({ href }: { href: string }) {
  const { alerts } = useManager();
  if (href !== '/driver/manage') return null;
  const n = alerts.late.length + alerts.unassigned.length;
  return n ? <span className="absolute -top-1 end-1 min-w-5 rounded-full bg-red-500 px-1.5 text-[11px] font-black leading-5 text-white lg:static lg:ms-auto">{n}</span> : null;
}

/**
 * Frame of the branch-manager app. Computer: a sidebar with the logo, the
 * pages and "משימה חדשה". Phone: a slim top bar, a bottom tab bar and a
 * floating "+" button. Holds the shared data, the task sheet and the
 * new-task sheet, so switching pages is instant.
 */
export default function ManagerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading } = useSWR<{ role: string; canManage: boolean; name?: string }>('/api/driver/me?as=manager', fetcher);

  const logout = async () => {
    await fetch('/api/driver/login?as=manager', { method: 'DELETE' });
    router.push('/driver/manager-login');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7F7]" aria-busy="true">
        <Image src="/images/logo.png" alt="SmartCar" width={140} height={62} className="h-12 w-auto animate-pulse object-contain" priority />
      </div>
    );
  }

  if (!me?.canManage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7F7] px-6 text-center" dir="rtl">
        <Image src="/images/logo.png" alt="SmartCar" width={140} height={62} className="mb-6 h-12 w-auto object-contain" priority />
        <h1 className="mb-2 text-xl font-black text-[#0D2B2B]">הדף הזה למנהלים</h1>
        <p className="mb-6 text-gray-600">כניסה עם שם המנהל והקוד שלך.</p>
        <button onClick={logout} className="min-h-14 w-full max-w-sm rounded-2xl bg-[#2D5F5F] text-base font-black text-white">כניסת מנהלים</button>
      </div>
    );
  }

  const name = me.name || 'מנהל';
  const quotesPage = pathname.startsWith('/driver/manage/quotes');

  return (
    <ToastProvider>
      <ManagerDataProvider mode="manager">
        <div className="min-h-screen bg-[#F4F7F7] lg:flex" dir="rtl">
          {/* Sidebar (computer) */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-gray-100 bg-white px-4 py-6 lg:flex">
            <div className="mb-8 flex items-center gap-2 px-2">
              <Link href="/driver/manage" aria-label="חזרה לדף היום" className="flex min-h-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F]">
                <Image src="/images/logo.png" alt="SmartCar" width={112} height={50} className="h-9 w-auto object-contain" priority />
              </Link>
              <span className="rounded-full bg-[#eef6f6] px-2.5 py-0.5 text-xs font-black text-[#2D5F5F]">מנהלים</span>
            </div>
            <SidebarActions />
            <nav className="flex flex-col gap-1" aria-label="ניווט">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = href === '/driver/manage' ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold transition ${
                      active ? 'bg-[#eef6f6] text-[#0D2B2B]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-[#2D5F5F]' : ''}`} aria-hidden="true" />
                    {label}
                    <NavBadge href={href} />
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto flex items-center gap-2 rounded-2xl bg-gray-50 p-2">
              <Avatar name={name} />
              <span className="min-w-0 flex-1 truncate text-sm font-black text-[#0D2B2B]">{name}</span>
              <PushBell audience="manager" />
              <button onClick={logout} className={brandIconButton} aria-label="יציאה">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Top bar (phone) */}
            <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
              <div className="flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <Link href="/driver/manage" aria-label="חזרה לדף היום" className="flex min-h-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F]">
                    <Image src="/images/logo.png" alt="SmartCar" width={96} height={43} className="h-8 w-auto object-contain" priority />
                  </Link>
                  <span className="rounded-full bg-[#eef6f6] px-2.5 py-0.5 text-xs font-black text-[#2D5F5F]">מנהלים</span>
                </div>
                <div className="flex items-center">
                  <PushBell audience="manager" />
                  <button onClick={logout} className={brandIconButton} aria-label="יציאה">
                    <LogOut className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </header>

            <main className={`mx-auto w-full px-4 pb-32 pt-5 sm:px-8 lg:pb-12 lg:pt-8 ${quotesPage ? 'max-w-[1500px]' : 'max-w-5xl'}`}>{children}</main>
          </div>

          {/* Floating "משימה חדשה" with a short menu (phone) */}
          <PhoneActions />

          {/* Tab bar (phone) */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="ניווט">
            <div className="mx-auto flex max-w-lg">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = href === '/driver/manage' ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-black ${active ? 'text-[#2D5F5F]' : 'text-gray-400'}`}
                  >
                    {active && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-[#2D5F5F]" aria-hidden="true" />}
                    <Icon className="h-6 w-6" aria-hidden="true" />
                    {label}
                    <NavBadge href={href} />
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
        <TaskSheet />
        <NewTaskSheet />
      </ManagerDataProvider>
    </ToastProvider>
  );
}
