import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('vehicles').select('*').order('make');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const ALLOWED_CATEGORIES = ['MINI','ECONOMY','COMPACT','SEDAN','CROSSOVER','SUV','LUXURY','VAN','ELECTRIC','COMMERCIAL'];
const ALLOWED_FUEL = ['GASOLINE','DIESEL','ELECTRIC','HYBRID'];
const ALLOWED_TRANSMISSION = ['AUTOMATIC','MANUAL'];

export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createAdminClient();
  const body = await request.json();
  if (body.category && !ALLOWED_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (body.fuel_type && !ALLOWED_FUEL.includes(body.fuel_type)) {
    return NextResponse.json({ error: 'Invalid fuel_type' }, { status: 400 });
  }
  if (body.transmission && !ALLOWED_TRANSMISSION.includes(body.transmission)) {
    return NextResponse.json({ error: 'Invalid transmission' }, { status: 400 });
  }
  const { data, error } = await supabase.from('vehicles').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath('/', 'layout');
  return NextResponse.json(data);
}
