import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('id, name, rating, text, date')
    .eq('approved', true)
    .order('date', { ascending: false });

  if (error) return NextResponse.json({ data: [] });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: rlOk } = await checkRateLimit(`reviews:${ip}`, 5, 60 * 60 * 1000);
  if (!rlOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await request.json();

  if (body._hp) return NextResponse.json({ ok: true }, { status: 201 });

  if (!await verifyTurnstile(body.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const text = String(body.text ?? '').trim();
  const rating = Number(body.rating);

  if (!name || !text || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'שם, טקסט ודירוג הם שדות חובה' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('reviews')
    .insert([{ name, text, rating, approved: false, date: new Date().toISOString() }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
