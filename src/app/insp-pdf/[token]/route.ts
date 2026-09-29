import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyInspectionToken } from '@/lib/inspection-link';
import { createAdminClient } from '@/lib/supabase/server';
import { INSPECTION_BUCKET } from '@/lib/inspection-storage';

export const runtime = 'nodejs';

function message(text: string, status: number) {
  return new NextResponse(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit } = await checkRateLimit(`insp-pdf:${ip}`, 60, 60 * 60 * 1000);
  if (!withinLimit) return message('יותר מדי בקשות. נסו שוב בעוד כמה דקות.', 429);

  const { token } = await context.params;
  const link = verifyInspectionToken(token);
  if (!link.valid) {
    return message(
      link.reason === 'expired' ? 'הקישור פג תוקף.' : 'הקישור אינו תקין.',
      link.reason === 'expired' ? 410 : 404
    );
  }

  const supabase = createAdminClient();
  const { data: inspection, error } = await supabase
    .from('vehicle_inspections')
    .select('signed_pdf_path, status')
    .eq('id', link.inspectionId!)
    .maybeSingle();

  if (error || !inspection || inspection.status !== 'signed' || !inspection.signed_pdf_path) {
    return message('המסמך החתום עדיין אינו זמין.', 404);
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .download(inspection.signed_pdf_path);
  if (downloadError || !file) {
    console.error('[insp-pdf] download failed:', downloadError?.message);
    return message('לא ניתן לטעון את המסמך כרגע.', 500);
  }

  return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="SmartCar_Inspection.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
