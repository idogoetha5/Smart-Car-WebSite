import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

async function isAuthorized() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await isAuthorized()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, quote_date, valid_until, customer_name, customer_email, company_name, company_id, vehicle_summary, pdf_path, pdf_size, status, provider_message_id, sent_at, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[quotes] list failed:', error.message);
    return NextResponse.json({ error: 'לא ניתן לטעון את היסטוריית ההצעות' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
