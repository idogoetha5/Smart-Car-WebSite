import { createAdminClient } from '@/lib/supabase/server';
import type { LeasingRequest } from '@/types';

export async function getLeasingRequests(): Promise<LeasingRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('leasing_requests')
    .select(`*, vehicle:vehicles(make, model, year)`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as LeasingRequest[]) ?? [];
}

export async function getPendingLeasingCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('leasing_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');

  if (error) throw error;
  return count ?? 0;
}
