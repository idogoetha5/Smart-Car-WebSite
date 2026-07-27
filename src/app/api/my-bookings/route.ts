import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { normalizeEmail, escapeLikePattern } from '@/lib/email';

const SELECT_COLUMNS = `
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
`;

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success, retryAfter } = await checkRateLimit(`my-bookings:${ip}`, 10, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  // Require authenticated session — email comes from the session, not from a query param
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const email = normalizeEmail(user.email);

  const { data, error } = await supabase
    .from('bookings')
    .select(SELECT_COLUMNS)
    .eq('customer_email', email)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });

  // Bookings created before scripts/normalize-existing-emails.sql runs may
  // be stored with different casing and would not match the exact lookup
  // above. Fall back to a case-insensitive match with the like
  // metacharacters escaped — a literal comparison, so `%` or `_` inside an
  // address still cannot widen the match to another customer's bookings.
  // This fallback becomes dead once the normalization migration has run.
  if (!data || data.length === 0) {
    const { data: legacy } = await supabase
      .from('bookings')
      .select(SELECT_COLUMNS)
      .ilike('customer_email', escapeLikePattern(email))
      .order('created_at', { ascending: false })
      .limit(20);
    return NextResponse.json({ data: legacy ?? [] });
  }

  return NextResponse.json({ data });
}
