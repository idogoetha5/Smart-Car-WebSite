import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { digits, formatPlate } from '@/lib/accident-report/schema';

/** Plate → model of a SmartCar vehicle. Returns { model: null } when the plate isn't in the fleet table. */
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = await checkRateLimit(`accident-lookup:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ model: null }, { status: 429 });

  const plate = new URL(request.url).searchParams.get('plate') ?? '';
  const d = digits(plate);
  if (d.length < 5 || d.length > 8) return NextResponse.json({ model: null });

  const { data } = await createAdminClient()
    .from('vehicles')
    .select('make, model, year')
    .in('license_plate', [d, formatPlate(d)])
    .limit(1)
    .maybeSingle();

  const model = data ? [data.make, data.model, data.year].filter(Boolean).join(' ') : null;
  return NextResponse.json({ model });
}
