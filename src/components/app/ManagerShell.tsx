'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { CalendarDays, LayoutList, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { fetcher } from '@/lib/swr';
import InstallHint from '@/components/app/InstallHint';
import PushSetup from '@/components/app/PushSetup';
import { BrandBar, brandIconButton } from '@/components/app/Brand';

const NAV = [
  { href: '/driver/manage', label: 'לוח משימות', icon: LayoutList },
  { href: '/driver/manage/calendar', label: 'לוח שנה', icon: CalendarDays },
] as const;

/**
 * Frame of the branch-manager app: brand bar, the two pages (task board and
 * calendar), install + notifications cards, and the manager-only guard.
 */
export default function ManagerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading } = useSWR<{ role: string; canManage: boolean; name?: string }>('/api/driver/me', fetcher);

  const logout = async () => {
    await fetch('/api/driver/login', { method: 'DELETE' });
    router.push('/driver/manager-login');
  };

  if (isLoading) return <div className="min-h-screen" aria-busy="true" />;

  if (!me?.canManage) {
    return (
      <div className="min-h-screen" dir="rtl">
        <BrandBar label="מנהלים" />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-black text-[#0D2B2B] mb-2">אין הרשאה</h1>
          <p className="text-gray-600 mb-6">הדף הזה מיועד למנהלים. כניסה עם שם המנהל והקוד.</p>
          <button onClick={logout} className="min-h-14 w-full rounded-2xl bg-[#2D5F5F] text-base font-black text-white">
            כניסת מנהלים
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <BrandBar label="מנהלים">
        {me.name && <span className="hidden text-sm font-bold text-gray-500 sm:inline">שלום, {me.name}</span>}
        <button onClick={logout} className={brandIconButton} aria-label="יציאה">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </button>
      </BrandBar>
      <nav className="mx-auto flex w-full max-w-5xl gap-2 px-4 pt-4 sm:px-8" aria-label="דפי המנהל">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 text-base font-black sm:flex-none sm:px-6 ${
                active ? 'border-[#2D5F5F] bg-[#2D5F5F] text-white' : 'border-[#B8D8D8] bg-white text-[#2D5F5F] hover:bg-[#eef6f6]'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-auto w-full max-w-5xl space-y-3 px-4 pt-3 empty:hidden sm:px-8">
        <PushSetup audience="manager" />
        <InstallHint appName="SmartCar מנהלים" />
      </div>
      {children}
    </div>
  );
}
