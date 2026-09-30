'use client';

/**
 * Shrinks a phone photo to a JPEG (long side ≤ maxSide) before upload —
 * a 12MP photo (4–8MB) becomes ~200–500KB, which uploads fast on mobile
 * data and keeps the signed PDF light. Honours EXIF orientation. Falls back
 * to the original file if the browser can't decode it.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
