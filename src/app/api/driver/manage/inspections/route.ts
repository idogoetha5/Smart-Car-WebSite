import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { listSignedInspections } from '@/lib/signed-inspections';

/** Branch manager: signed inspections ("עבודות שבוצעו ונחתמו"). */
export async function GET() {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return listSignedInspections();
}
