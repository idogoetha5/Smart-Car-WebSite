import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

const ALLOWED_STATUSES = ['PENDING', 'IN_REVIEW', 'REJECTED', 'APPROVED'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Allowlist known editable fields — never pass raw body to Supabase
  const allowedFields: Record<string, unknown> = {};
  const LEASING_FIELDS = ['status', 'notes', 'estimated_monthly', 'down_payment', 'duration_months', 'mileage_package'];
  for (const field of LEASING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      allowedFields[field] = body[field];
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('leasing_requests')
    .update(allowedFields)
    .eq('id', id)
    .select()
    .single();

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('leasing_requests').delete().eq('id', id);
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
