import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_details_forms')
    .select('id, branch_id, full_name, date_of_birth, passport_number, driver_license_number, country, city, address, postal_code, phone, israel_address, email, locale, status, invoice_notice_accepted_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/customer-details] list failed:', error.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
