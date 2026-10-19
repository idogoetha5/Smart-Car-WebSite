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

  const requestedMonth = request.nextUrl.searchParams.get('month');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
    ? requestedMonth
    : currentMonth;
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('bookings')
    .select('created_at')
    .or('source.is.null,source.not.in.(driver,phone)')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }

  const counts: Record<string, number> = {};
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(Date.UTC(year, monthIndex - 1, i));
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
