import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const jar = await cookies();
  if (!await verifyAdminToken(jar.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await createAdminClient().from('whatsapp_inbound_journal')
    .select('phone, status, updated_at')
    .in('status', ['preparing', 'prepared', 'sending', 'uncertain', 'rejected'])
    .order('updated_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  const cutoff = Date.now() - 60_000;
  const items = (data ?? []).filter(item =>
    ['prepared', 'uncertain', 'rejected'].includes(item.status) ||
    (['preparing', 'sending'].includes(item.status) && Date.parse(item.updated_at) < cutoff)
  );
  return NextResponse.json({ data: items }, { headers: { 'Cache-Control': 'private, no-store' } });
}
