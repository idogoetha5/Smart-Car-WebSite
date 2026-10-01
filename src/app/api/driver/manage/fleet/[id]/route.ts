import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

/** Delete an unused vehicle. Historical rentals deliberately prevent deletion. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) {
    console.error('[driver/manage/fleet] delete failed:', error.message);
    return NextResponse.json(
      { error: error.code === '23503' ? 'לא ניתן למחוק רכב עם היסטוריית הזמנות. אפשר לסמן אותו כלא זמין במערכת הניהול.' : 'לא הצלחנו למחוק את הרכב' },
      { status: error.code === '23503' ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
