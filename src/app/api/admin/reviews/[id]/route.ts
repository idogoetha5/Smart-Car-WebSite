import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  // Allowlist known review fields — never pass raw body to Supabase
  const allowedFields: Record<string, unknown> = {};
  const REVIEW_FIELDS = ['approved', 'is_approved', 'reply', 'rating', 'text', 'name', 'date', 'source'];
  for (const field of REVIEW_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      allowedFields[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from('reviews')
    .update(allowedFields)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
