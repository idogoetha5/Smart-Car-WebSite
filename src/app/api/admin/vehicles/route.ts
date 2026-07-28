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
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
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
  // Explicit allowlist rather than insert(body). Passing the request body
  // straight through under the service role is mass assignment: any column
  // the table gains later becomes writable from this endpoint without anyone
  // deciding it should be, including ones the admin UI never exposes.
  const allowed = [
    'make', 'model', 'year', 'category', 'fuel_type', 'transmission',
    'price_per_day', 'seats', 'doors', 'image_urls', 'is_available',
    'is_featured', 'total_units', 'deposit_amount', 'color_he', 'color_en',
    'description_he', 'description_en', 'features', 'license_plate',
  ] as const;

  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  if (!payload.make || !payload.model) {
    return NextResponse.json({ error: 'make and model are required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('vehicles').insert(payload).select().single();
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  revalidatePath('/', 'layout');
  return NextResponse.json(data);
}
