import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), upload: vi.fn(), publicUrl: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-session' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: mocks.auth }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.publicUrl }) } }) }));
import { POST } from '@/app/api/admin/vehicle-image/route';

function request(file?: Blob) {
  const form = new FormData();
  if (file) form.append('file', file, 'photo.png');
  return new Request('https://example.invalid/api/admin/vehicle-image', { method: 'POST', body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(true);
  mocks.upload.mockResolvedValue({ error: null });
  mocks.publicUrl.mockReturnValue({ data: { publicUrl: 'https://example.invalid/photo.webp' } });
});

describe('admin vehicle photo uploads', () => {
  it('requires an office session before reading or uploading files', async () => {
    mocks.auth.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rejects missing files, oversized requests and disguised SVGs', async () => {
    expect((await POST(request())).status).toBe(400);
    const huge = request();
    huge.headers.set('content-length', String(4 * 1024 * 1024));
    expect((await POST(huge)).status).toBe(413);
    expect((await POST(request(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'], { type: 'image/png' })))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('decodes a real photo, stores a fresh WebP and returns its public URL', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#2d5f5f' } }).png().toBuffer();
    const response = await POST(request(new Blob([new Uint8Array(png)], { type: 'image/png' })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://example.invalid/photo.webp' });
    const [path, image, options] = mocks.upload.mock.calls[0];
    expect(path).toMatch(/^admin-uploads\/[\w-]+\.webp$/);
    expect(options.upsert).toBe(false);
    expect((await sharp(image).metadata()).format).toBe('webp');
  });
  it('does not report a successful upload when storage refuses the write', async () => {
    mocks.upload.mockResolvedValue({ error: { message: 'Test storage refusal' } });
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
    expect((await POST(request(new Blob([new Uint8Array(png)])))) .status).toBe(500);
    expect(mocks.publicUrl).not.toHaveBeenCalled();
  });
});
