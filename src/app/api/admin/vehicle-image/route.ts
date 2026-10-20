import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES + 65536) {
    return NextResponse.json({ error: 'התמונה גדולה מדי. יש לבחור תמונה עד 3MB לאחר הקטנה.' }, { status: 413 });
  }
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return NextResponse.json({ error: 'לא התקבלה תמונה תקינה' }, { status: 400 });
  }
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'יש לבחור תמונה עד 3MB לאחר הקטנה' }, { status: 400 });
  }
  let image: Buffer;
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 });
    const metadata = await input.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'heif', 'avif'].includes(metadata.format)) {
      return NextResponse.json({ error: 'יש לבחור צילום בפורמט JPG, PNG או WebP' }, { status: 400 });
    }
    // Decode/re-encode instead of trusting the filename or MIME type. EXIF
    // orientation is applied and private camera metadata is not retained.
    image = await input.rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    return NextResponse.json({ error: 'לא ניתן לקרוא את התמונה. נסה לשמור אותה כ־JPG ולבחור שוב.' }, { status: 400 });
  }
  const storage = createAdminClient().storage.from('vehicles');
  const path = `admin-uploads/${randomUUID()}.webp`;
  const { error } = await storage.upload(path, image, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) {
    console.error('Vehicle image upload failed:', error.message);
    return NextResponse.json({ error: 'העלאת התמונה נכשלה. נסה שוב.' }, { status: 500 });
  }
  return NextResponse.json({ url: storage.getPublicUrl(path).data.publicUrl });
}
