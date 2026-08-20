import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

const VEHICLES = new Set(['ECONOMY_COMPACT', 'SEDAN', 'SUV', 'VAN', 'LUXURY', 'ALL']);

async function authorised() {
  const store = await cookies();
  return verifyAdminToken(store.get('admin_auth')?.value ?? '');
}

/** Review queue only: no customer message, phone, name or address is exposed. */
export async function GET() {
  if (!await authorised()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await createAdminClient().from('whatsapp_language_candidates')
    .select('id, normalized_phrase, field, proposed_value, status, occurrences, first_seen_at, last_seen_at, reviewed_at, reviewed_by')
    .order('last_seen_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: 'Could not load candidates' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  if (!await authorised()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: number; action?: string; proposedValue?: string } | null;
  if (!body?.id || !['approve', 'reject', 'revoke'].includes(body.action ?? '')) return NextResponse.json({ error: 'Invalid review action' }, { status: 400 });
  const status = body.action === 'approve' ? 'APPROVED' : body.action === 'reject' ? 'REJECTED' : 'REVOKED';
  if (status === 'APPROVED' && !VEHICLES.has(body.proposedValue ?? '')) return NextResponse.json({ error: 'Choose a valid vehicle category' }, { status: 400 });
  const update: Record<string, unknown> = { status, reviewed_at: new Date().toISOString(), reviewed_by: 'admin' };
  if (status === 'APPROVED') update.proposed_value = body.proposedValue;
  const { error } = await createAdminClient().from('whatsapp_language_candidates').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: 'Could not update candidate' }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
