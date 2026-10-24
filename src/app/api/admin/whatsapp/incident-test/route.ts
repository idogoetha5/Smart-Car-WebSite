import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { reportBotIncident } from '@/lib/whatsapp-incidents';

/** Owner-only probe. Recipient, content and provider idempotency stay server-side.
 * Acceptance by the email provider does not establish receipt in the inbox. */
export async function POST() {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accepted = await reportBotIncident('test').catch(() => false);
  return NextResponse.json({ data: { accepted } }, {
    status: accepted ? 200 : 502,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
