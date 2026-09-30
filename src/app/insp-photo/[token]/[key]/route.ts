import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyInspectionToken } from '@/lib/inspection-link';
import { createAdminClient } from '@/lib/supabase/server';
import { INSPECTION_BUCKET } from '@/lib/inspection-storage';
import { photoKeyToPath, type DamageMark } from '@/lib/inspection-damage';

export const runtime = 'nodejs';

/**
 * Damage/side photos for a holder of a valid inspection token, same gate as
 * /insp-video: the token must be valid and the key must name a photo that
 * belongs to that inspection; the response is a redirect to a 1-hour
 * Supabase signed URL (bucket stays private).
 */
function message(text: string, status: number) {
  return new NextResponse(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET(request: Request, context: { params: Promise<{ token: string; key: string }> }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit } = await checkRateLimit(`insp-photo:${ip}`, 300, 60 * 60 * 1000);
  if (!withinLimit) return message('יותר מדי בקשות. נסו שוב בעוד כמה דקות.', 429);

  const { token, key } = await context.params;
  const link = verifyInspectionToken(token);
  if (!link.valid) {
    return message(link.reason === 'expired' ? 'הקישור פג תוקף.' : 'הקישור אינו תקין.', link.reason === 'expired' ? 410 : 404);
  }

  const supabase = createAdminClient();
  const { data: inspection, error } = await supabase
    .from('vehicle_inspections')
    .select('id, damage_marks, side_photos')
    .eq('id', link.inspectionId!)
    .maybeSingle();
  if (error || !inspection) return message('התמונה אינה זמינה.', 404);

  const path = photoKeyToPath(
    {
      id: inspection.id,
      damage_marks: (inspection.damage_marks ?? []) as DamageMark[],
      side_photos: (inspection.side_photos ?? {}) as Record<string, string>,
    },
    key
  );
  if (!path) return message('התמונה אינה זמינה.', 404);

  const { data: signed, error: signError } = await supabase.storage.from(INSPECTION_BUCKET).createSignedUrl(path, 60 * 60);
  if (signError || !signed?.signedUrl) {
    console.error('[insp-photo] signed url failed:', signError?.message);
    return message('לא ניתן לטעון את התמונה כרגע.', 500);
  }
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
