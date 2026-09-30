import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyInspectionToken } from '@/lib/inspection-link';
import { createAdminClient } from '@/lib/supabase/server';
import { INSPECTION_BUCKET } from '@/lib/inspection-storage';

export const runtime = 'nodejs';

/**
 * Gives a holder of a valid inspection token access to the private
 * inspection video by redirecting to a 1-hour Supabase signed URL. The
 * bucket stays private; the token is still the gate. A GET here never
 * changes inspection status.
 */
function message(text: string, status: number) {
  return new NextResponse(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit } = await checkRateLimit(`insp-video:${ip}`, 60, 60 * 60 * 1000);
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
    .select('video_path')
    .eq('id', link.inspectionId!)
    .maybeSingle();

  if (error || !inspection?.video_path) {
    return message('הסרטון אינו זמין.', 404);
  }

  // Vercel functions cap response bodies at 4.5MB, so streaming a phone
  // video through here fails. Instead hand the holder of a valid token a
  // short-lived signed URL straight from Storage (supports seeking/Range).
  const { data: signed, error: signError } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .createSignedUrl(inspection.video_path, 60 * 60);
  if (signError || !signed?.signedUrl) {
    console.error('[insp-video] signed url failed:', signError?.message);
    return message('לא ניתן לטעון את הסרטון כרגע.', 500);
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
