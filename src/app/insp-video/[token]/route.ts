import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyInspectionToken } from '@/lib/inspection-link';
import { createAdminClient } from '@/lib/supabase/server';
import { INSPECTION_BUCKET } from '@/lib/inspection-storage';

export const runtime = 'nodejs';

/**
 * Streams the private inspection video to a holder of a valid signing
 * token — same "token resolves to a private storage object, streamed by
 * the service-role client, never a public/Supabase-signed URL" pattern as
 * src/app/q/[token]/route.ts. A GET here never changes inspection status.
 */
function message(text: string, status: number) {
  return new NextResponse(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

function contentTypeFor(path: string): string {
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
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

  const { data: file, error: downloadError } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .download(inspection.video_path);
  if (downloadError || !file) {
    console.error('[insp-video] download failed:', downloadError?.message);
    return message('לא ניתן לטעון את הסרטון כרגע.', 500);
  }

  return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
    headers: {
      'Content-Type': contentTypeFor(inspection.video_path),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Accept-Ranges': 'none',
    },
  });
}
