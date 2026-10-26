import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { sendHandoffEmail } from '@/lib/whatsapp-incidents';

export async function POST() {
  const jar = await cookies();
  if (!await verifyAdminToken(jar.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accepted = await sendHandoffEmail(`test-v2-${Math.floor(Date.now() / 900000)}`, 'fictional', true);
  return NextResponse.json({ data: { accepted } }, { status: accepted ? 200 : 502, headers: { 'Cache-Control': 'private, no-store' } });
}
