import { cookies } from 'next/headers';
import { verifyAdminToken, verifyDriverToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

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

/** Role of a logged-in driver row: 'manager' = branch manager (assigns tasks). */
export async function driverRole(driverId: string): Promise<'driver' | 'manager' | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('drivers').select('role, active').eq('id', driverId).maybeSingle();
  if (error) {
    // Before the add-driver-role migration runs there is no role column.
    console.error('[driver-route-auth] role lookup failed:', error.message);
    return null;
  }
  if (!data || data.active === false) return null;
  return data.role === 'manager' ? 'manager' : 'driver';
}

/**
 * Branch-manager routes (/api/driver/manage/*): a driver cookie whose
 * driver row has role 'manager', or an admin cookie.
 */
export async function requireManagerOrAdmin(): Promise<{ ok: boolean; managerId: string | null }> {
  const cookieStore = await cookies();
  const driverId = await verifyDriverToken(cookieStore.get('driver_auth')?.value);
  if (driverId) {
    return { ok: (await driverRole(driverId)) === 'manager', managerId: driverId };
  }
  const isAdmin = await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
  return { ok: isAdmin, managerId: null };
}
