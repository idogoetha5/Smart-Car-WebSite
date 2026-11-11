import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp, NO_STORE, openVerificationByToken } from '@/lib/customer-verification/server';

/** Is this personal link still open? Returns only the customer's first name for the greeting. */
export async function GET(request: Request) {
  const limit = await checkRateLimit(`cv-link:${clientIp(request)}`, 30, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ valid: false }, { status: 429, headers: NO_STORE });

  const token = new URL(request.url).searchParams.get('t') ?? '';
  const row = await openVerificationByToken(token);
  if (!row) return NextResponse.json({ valid: false }, { headers: NO_STORE });
  return NextResponse.json(
    { valid: true, name: (row.customer_name ?? '').split(/\s+/)[0] ?? '' },
    { headers: NO_STORE },
  );
}
