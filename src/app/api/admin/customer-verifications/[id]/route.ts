import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { CV_BUCKET, NO_STORE, logAccess, type VerificationRow } from '@/lib/customer-verification/server';

export const runtime = 'nodejs';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('customer_verifications').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const row = data as VerificationRow;

  // Short-lived links: the photos are visible for ten minutes after opening.
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: s } = await supabase.storage.from(CV_BUCKET).createSignedUrl(path, 600);
    return s?.signedUrl ?? null;
  };
  const [licenseFront, licenseBack] = await Promise.all([sign(row.license_front_path), sign(row.license_back_path)]);

  const { data: log } = await supabase
    .from('customer_verification_access_log')
    .select('action, ip, created_at')
    .eq('verification_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (row.status === 'COMPLETED') await logAccess(request, id, 'VIEW');

  // Never send the ciphertext or the token back to the browser.
  const { card_ciphertext, token, ...safe } = row;
  void token;
  return NextResponse.json(
    { ...safe, has_card: !!card_ciphertext, files: { licenseFront, licenseBack }, access_log: log ?? [] },
    { headers: NO_STORE },
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.internal_notes === 'string') update.internal_notes = body.internal_notes.slice(0, 5000);
  if (typeof body.booking_ref === 'string') update.booking_ref = body.booking_ref.trim().slice(0, 60) || null;
  if (body.status === 'CANCELLED') update.status = 'CANCELLED';
  if (!Object.keys(update).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  let q = createAdminClient().from('customer_verifications').update(update).eq('id', id);
  // Only a link that was never filled in can be cancelled.
  if (update.status === 'CANCELLED') q = q.eq('status', 'SENT');
  const { error } = await q;
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
