import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { resolveVehicleImageUrl } from '@/lib/car-images';

const getAdminClient = () => createAdminClient();

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getAdminClient()
    .from('cars_for_sale')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  const cars = (data ?? []).map((car) => ({
    ...car,
    image_url: resolveVehicleImageUrl(car.image_url),
  }));
  return NextResponse.json({ data: cars });
}

export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await getAdminClient()
    .from('cars_for_sale')
    .insert([{
      make:      body.make,
      model:     body.model,
      year:      Number(body.year),
      price:     Number(body.price),
      km:        body.km ? Number(body.km) : null,
      color:     body.color || null,
      extras:    body.extras || null,
      image_url: resolveVehicleImageUrl(body.image_url),
    }])
    .select()
    .single();

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data }, { status: 201 });
}
