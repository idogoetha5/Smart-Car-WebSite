import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
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
  const supabase = createAdminClient();
  const body = await request.json();

  // Allowlist known vehicle fields — never pass raw body to Supabase
  const allowedFields: Record<string, unknown> = {};
  const VEHICLE_FIELDS = [
    'make', 'model', 'year', 'category', 'transmission', 'fuel_type',
    'seats', 'doors', 'price_per_day', 'price_per_month', 'deposit_amount',
    'mileage_limit', 'image_urls', 'features', 'is_available', 'is_featured',
    'color_he', 'color_en', 'description_he', 'description_en', 'total_units',
  ];
  for (const field of VEHICLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      allowedFields[field] = body[field];
    }
  }

  const { data, error } = await supabase.from('vehicles').update(allowedFields).eq('id', id).select().single();
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  revalidatePath('/', 'layout');
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  revalidatePath('/', 'layout');
  return NextResponse.json({ success: true });
}
