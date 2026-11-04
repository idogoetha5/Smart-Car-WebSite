import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import type { StoredReport } from '@/lib/accident-report/schema';

const BUCKET = 'accident-reports';
const STATUSES = ['NEW', 'IN_PROGRESS', 'SENT_TO_INSURANCE', 'CLOSED'];

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: row, error } = await supabase.from('accident_reports').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const r = row.data as StoredReport;
  const sign = async (path?: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
  const [photos, licensePhoto, docsPhoto, signature, pdf] = await Promise.all([
    Promise.all(r.photos.map(sign)),
    sign(r.driver.licensePhoto),
    sign(r.other.docsPhoto),
    sign(r.signaturePath),
    sign(row.pdf_path),
  ]);

  return NextResponse.json({
    ...row,
    files: { photos: photos.filter(Boolean), licensePhoto, docsPhoto, signature, pdf },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.status === 'string') {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    update.status = body.status;
  }
  if (typeof body.internal_notes === 'string') update.internal_notes = body.internal_notes.slice(0, 5000);
  if (!Object.keys(update).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const { error } = await createAdminClient().from('accident_reports').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
