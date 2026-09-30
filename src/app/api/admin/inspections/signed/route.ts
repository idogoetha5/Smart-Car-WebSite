import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { listSignedInspections } from '@/lib/signed-inspections';

/** Signed inspections ("עבודות שבוצעו ונחתמו") for the admin drivers page. */
export async function GET() {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return listSignedInspections();
}
