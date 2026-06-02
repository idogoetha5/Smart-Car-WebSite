import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
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
      image_url: body.image_url || null,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
