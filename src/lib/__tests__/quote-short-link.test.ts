import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRentalQuoteLink } from '@/lib/quote-link';
import { createQuoteShortToken, isQuoteShortToken, resolveQuoteShortToken, shortenQuoteToken } from '@/lib/quote-short-link';
import { GET } from '@/app/q/[token]/route';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), read: vi.fn(), download: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }),
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: async () => ({ success: true }) }));
const alias = 'aB12Cd34Ef56Gh78';
const signed = (expiry = Date.parse('2040-02-18T20:00:00Z')) =>
  createRentalQuoteLink('113309', 'quote', expiry, 'slot0001').token;
const call = () => GET(new Request(`https://www.smartcar.co.il/q/${alias}`), { params: Promise.resolve({ token: alias }) });

beforeEach(() => {
  process.env.QUOTE_LINK_SECRET = 'unit-test-short-link-secret';
  vi.resetAllMocks();
});

describe('compact private quote links', () => {
  it('generates unique, URL-safe 96-bit aliases', () => {
    const tokens = Array.from({ length: 1000 }, createQuoteShortToken);
    expect(tokens.every(isQuoteShortToken)).toBe(true);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('stores the exact signed token without changing its validity', async () => {
    mocks.insert.mockResolvedValue({ error: null });
    const token = signed();
    const short = await shortenQuoteToken(token);
    expect(short).toHaveLength(16);
    expect(mocks.insert).toHaveBeenCalledWith({ token: short, signed_token: token });
  });

  it('retries a collision without overwriting a previous mapping', async () => {
    mocks.insert.mockResolvedValueOnce({ error: { code: '23505' } }).mockResolvedValue({ error: null });
    await shortenQuoteToken(signed());
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[0][0].token).not.toBe(mocks.insert.mock.calls[1][0].token);
  });

  it('fails closed if saving the alias fails', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '42501' } });
    await expect(shortenQuoteToken(signed())).rejects.toThrow('Could not save');
  });

  it('refuses to shorten an expired or forged signed token', async () => {
    await expect(shortenQuoteToken(signed(Date.now() - 60_000))).rejects.toThrow();
    await expect(shortenQuoteToken('forged')).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not look up malformed aliases', async () => {
    expect(await resolveQuoteShortToken('../secret')).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('streams the same private PDF from the compact URL', async () => {
    mocks.read.mockResolvedValue({ data: { signed_token: signed() }, error: null });
    mocks.download.mockResolvedValue({ data: new Blob(['%PDF-test']), error: null });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(mocks.download).toHaveBeenCalledWith('rental/113309-slot0001.pdf');
    expect(await response.text()).toBe('%PDF-test');
  });

  it('returns 404 for an unknown alias without reading a PDF', async () => {
    mocks.read.mockResolvedValue({ data: null, error: null });
    expect((await call()).status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('enforces the original expiry after resolving an alias', async () => {
    mocks.read.mockResolvedValue({ data: { signed_token: signed(Date.now() - 60_000) }, error: null });
    expect((await call()).status).toBe(410);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('rejects a corrupted mapping and hides lookup failures', async () => {
    mocks.read.mockResolvedValueOnce({ data: { signed_token: 'forged' }, error: null });
    expect((await call()).status).toBe(404);
    mocks.read.mockResolvedValueOnce({ data: null, error: { message: 'private DB diagnostic' } });
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private DB');
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
