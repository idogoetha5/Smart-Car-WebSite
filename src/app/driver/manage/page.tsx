'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { LogOut } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import DriversBoard from '@/components/drivers/DriversBoard';

/**
 * Branch-manager page (smartcar.co.il/manager → here): the same drivers +
 * tasks board as the admin "נהגים" page, without admin access. Managers are
 * added in the admin under "נהגים → מנהלים" and log in at
 * /driver/manager-login with their name and 4-digit code.
 */
export default function BranchManagerPage() {
  const router = useRouter();
  const { data: me, isLoading } = useSWR<{ role: string; canManage: boolean }>('/api/driver/me', fetcher);

  const logout = async () => {
    await fetch('/api/driver/login', { method: 'DELETE' });
    router.push('/driver/manager-login');
  };

  if (isLoading) return <div className="min-h-screen" aria-busy="true" />;

  if (!me?.canManage) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir="rtl">
        <h1 className="text-xl font-black text-gray-900 mb-2">אין הרשאה</h1>
        <p className="text-gray-600 mb-6">הדף הזה מיועד למנהלים. כניסה עם שם המנהל והקוד.</p>
        <button onClick={logout} className="min-h-14 w-full rounded-2xl bg-[#2D5F5F] text-base font-black text-white">כניסת מנהלים</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]" dir="rtl">
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-4 sm:px-8">
        <button onClick={logout} className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-base font-bold text-gray-500 active:bg-gray-100" aria-label="יציאה">
          <LogOut className="h-5 w-5" aria-hidden="true" />
          יציאה
        </button>
      </div>
      <DriversBoard mode="manager" />
    </div>
  );
}
