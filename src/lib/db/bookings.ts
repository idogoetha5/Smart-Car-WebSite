import { createAdminClient } from '@/lib/supabase/server';
import type { Booking } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBookingRow(row: any): Booking {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicle: row.vehicle ?? undefined,
    customerName: row.customer_name ?? '',
    customerEmail: row.customer_email ?? '',
    customerPhone: row.customer_phone ?? '',
    customerIdNumber: row.customer_id_number ?? undefined,
    pickupDate: row.pickup_date ?? '',
    dropoffDate: row.dropoff_date ?? '',
    pickupLocation: row.pickup_location ?? '',
    dropoffLocation: row.dropoff_location ?? '',
    totalDays: row.total_days ?? 0,
    pricePerDay: row.price_per_day ?? 0,
    totalPrice: row.total_price ?? 0,
    depositPaid: row.deposit_paid ?? false,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? '',
  };
}

export async function getBookings(): Promise<Booking[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, vehicle:vehicles(make, model, year)`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

export async function getActiveBookingsCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .in('status', ['PENDING', 'CONFIRMED', 'ACTIVE']);

  if (error) throw error;
  return count ?? 0;
}

export async function getRecentBookings(limit = 5): Promise<Booking[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, vehicle:vehicles(make, model, year)`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

export async function getWeeklyBookingCounts(): Promise<{ date: string; count: number }[]> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('bookings')
    .select('created_at')
    .gte('created_at', since.toISOString());

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    counts[d.toISOString().split('T')[0]] = 0;
  }
  for (const b of data ?? []) {
    const day = (b.created_at as string).split('T')[0];
    if (day in counts) counts[day]++;
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

export async function getMonthlyRevenue(): Promise<number> {
  const supabase = createAdminClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('bookings')
    .select('total_price')
    .in('status', ['CONFIRMED', 'ACTIVE', 'COMPLETED'])
    .gte('created_at', startOfMonth.toISOString());

  if (error) throw error;
  return (data ?? []).reduce(
    (sum, b) => sum + parseFloat(String(b.total_price ?? 0)),
    0
  );
}
