import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await createAdminClient().from('accident_report_settings').select('recipients').eq('id', 1).maybeSingle();
  return NextResponse.json({ recipients: data?.recipients ?? ['office@smartcar.co.il'] });
}

export async function PUT(request: Request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const list: string[] = Array.isArray(body.recipients) ? body.recipients : [];
  const clean = [...new Set(list.map((e) => String(e).trim().toLowerCase()))].filter((e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  );
  if (!clean.length || clean.length > 10) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { error } = await createAdminClient()
    .from('accident_report_settings')
    .upsert({ id: 1, recipients: clean, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  return NextResponse.json({ recipients: clean });
}
