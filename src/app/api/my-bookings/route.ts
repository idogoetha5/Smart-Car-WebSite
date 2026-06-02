import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

const rateLimit = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: Request) {
  const ip =
    (request as Request & { headers: Headers }).headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    entry.count++;
  } else {
    rateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  // Require authenticated session — email comes from the session, not from a query param
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      status,
      pickup_date,
      dropoff_date,
      pickup_location,
      dropoff_location,
      total_price,
      total_days,
      extras,
      created_at,
      vehicle:vehicles(make, model, year, image_urls)
    `)
    .ilike('customer_email', user.email)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
