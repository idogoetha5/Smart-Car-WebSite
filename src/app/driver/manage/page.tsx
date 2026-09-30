'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { LogOut } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import DriversBoard from '@/components/drivers/DriversBoard';
import InstallHint from '@/components/app/InstallHint';
import { BrandBar, brandIconButton } from '@/components/app/Brand';

/**
 * Branch-manager app (smartcar.co.il/manager → here): the same drivers +
 * tasks board as the admin "נהגים" page, without admin access. Managers are
 * added in the admin under "נהגים → מנהלים" and log in at
 * /driver/manager-login with their name and 4-digit code. Works on a phone
 * and on a computer, and installs as an app (see /driver/manifest-manager).
 */
export default function BranchManagerPage() {
  const router = useRouter();
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
          <Link href="/driver/manager-login" onClick={(e) => { e.preventDefault(); void logout(); }} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#2D5F5F] text-base font-black text-white">
            כניסת מנהלים
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <BrandBar label="מנהלים">
        {me?.name && <span className="hidden text-sm font-bold text-gray-500 sm:inline">שלום, {me.name}</span>}
        <button onClick={logout} className={brandIconButton} aria-label="יציאה">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </button>
      </BrandBar>
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-8">
        <InstallHint appName="SmartCar מנהלים" />
      </div>
      <DriversBoard mode="manager" />
    </div>
  );
}
