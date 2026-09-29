import { cookies } from 'next/headers';
import { verifyAdminToken, verifyDriverToken } from '@/lib/admin-auth';

/**
 * Every /api/driver/* route (except login) and every /driver/* page is
 * reachable by a driver_auth cookie OR an admin_auth cookie — proxy.ts
 * enforces this at the edge already, this is the same check repeated
 * per-route as defense-in-depth, matching how every /api/admin/* route in
 * this app re-checks verifyAdminToken itself rather than trusting the
 * proxy alone.
 */
export async function requireDriverOrAdmin(): Promise<{ ok: boolean; driverId: string | null }> {
  const cookieStore = await cookies();
  const driverId = await verifyDriverToken(cookieStore.get('driver_auth')?.value);
  if (driverId) return { ok: true, driverId };

  const isAdmin = await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
  return { ok: isAdmin, driverId: null };
}
