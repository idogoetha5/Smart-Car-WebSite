import { timingSafeEqual } from 'node:crypto';
import { getCustomerLeads } from '@/lib/lead-export';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  const secret = process.env.LEADS_SHEETS_SYNC_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || Buffer.byteLength(provided) !== Buffer.byteLength(secret)
    || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    return Response.json({ ok: false }, { status: 401, headers });
  }
  try {
    const rows = await getCustomerLeads();
    return Response.json({ ok: true, rows, generatedAt: new Date().toISOString() }, { headers });
  } catch {
    console.error('[leads-sync] Could not read all lead sources');
    return Response.json({ ok: false, error: 'Lead sources unavailable' }, { status: 503, headers });
  }
}
