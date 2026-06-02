import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET(request: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days') ?? 7), 7), 30);
  const supabase = createAdminClient();

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('bookings')
    .select('created_at')
    .gte('created_at', since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    counts[d.toISOString().split('T')[0]] = 0;
  }
  for (const b of data ?? []) {
    const day = (b.created_at as string).split('T')[0];
    if (day in counts) counts[day]++;
  }

  const result = Object.entries(counts).map(([date, count]) => ({ date, count }));
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
