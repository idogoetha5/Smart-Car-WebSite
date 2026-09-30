import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { checkRateLimit } from '@/lib/ratelimit';

export const maxDuration = 30;

const MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_CHARS = 3_000_000; // ~2.2MB of base64 — the client sends a resized JPEG

/**
 * Reads the odometer from a photo of the dashboard (Gemini vision), so the
 * driver doesn't have to type it. Best effort: returns { km: null } when it
 * can't read a number, and the driver types it instead.
 */
export async function POST(request: NextRequest) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { success } = await checkRateLimit(`odometer-ocr:${driverId ?? 'admin'}`, 60, 60 * 60 * 1000);
  if (!success) return NextResponse.json({ km: null, error: 'Too many requests' }, { status: 429 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ km: null, error: 'OCR not configured' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const match = String(body?.image ?? '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match || match[2].length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ km: null, error: 'Invalid image' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'This is a photo of a car dashboard. Read the total odometer (total kilometres driven, not the trip meter). ' +
                    'Reply with the number only, digits only, no spaces or units. If you cannot read it with confidence, reply NONE.',
                },
                { inline_data: { mime_type: match[1], data: match[2] } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 20 },
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!res.ok) {
      console.error('[odometer-ocr] Gemini HTTP %s: %s', res.status, (await res.text()).slice(0, 300));
      return NextResponse.json({ km: null });
    }
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const digits = text.replace(/[^\d]/g, '');
    const km = digits.length >= 1 && digits.length <= 7 ? Number(digits) : null;
    return NextResponse.json({ km });
  } catch (err) {
    console.error('[odometer-ocr] failed:', err);
    return NextResponse.json({ km: null });
  }
}
