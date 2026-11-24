import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminToken } from '@/lib/admin-auth';
import { emailDeclaration } from '@/lib/rental-declaration-server';
import { createAdminClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

async function getRecord({ params }: Context) {
  const cookie = (await cookies()).get('admin_auth')?.value ?? '';
  if (!await verifyAdminToken(cookie)) return { response: NextResponse.json({}, { status: 401, headers }) };
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { response: NextResponse.json({}, { status: 404, headers }) };
  const { data, error } = await createAdminClient().from('rental_declarations')
    .select('id, pdf_base64, office_email_sent_at').eq('id', id).maybeSingle();
  if (error) return { response: NextResponse.json({}, { status: 503, headers }) };
  if (!data) return { response: NextResponse.json({}, { status: 404, headers }) };
  return { data };
}

export async function GET(_request: Request, context: Context) {
  const record = await getRecord(context);
  if (record.response) return record.response;
  return new Response(new Uint8Array(Buffer.from(record.data.pdf_base64, 'base64')), { headers: {
    ...headers,
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="SmartCar-declaration-' + record.data.id + '.pdf"',
  } });
}

export async function POST(request: Request, context: Context) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({}, { status: 403, headers });
  const record = await getRecord(context);
  if (record.response) return record.response;
  const sent = await emailDeclaration(record.data);
  return NextResponse.json({ sent }, { status: sent ? 200 : 502, headers });
}
