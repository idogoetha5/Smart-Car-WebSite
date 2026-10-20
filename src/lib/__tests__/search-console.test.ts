import { generateKeyPairSync } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { getSearchConsoleOverview } from '../search-console';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('loads the remaining API pages and keeps overall totals independent of query totals', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  vi.stubEnv('GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL', 'test@example.invalid');
  vi.stubEnv('GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
  vi.stubEnv('GOOGLE_SEARCH_CONSOLE_SITE_URL', 'sc-domain:example.invalid');
  const reportRequests: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    if (url.includes('oauth2')) return Response.json({ access_token: 'test-token' });
    const body = JSON.parse(String(options.body));
    reportRequests.push(body);
    if (!body.dimensions) return Response.json({ rows: [{ clicks: 42, impressions: 1000 }] });
    if (body.startRow) return Response.json({ rows: [{ keys: ['last query'], clicks: 1 }] });
    return Response.json({ rows: Array.from({ length: 25_000 }, (_, index) => ({ keys: [`query ${index}`], clicks: 0, impressions: 1 })) });
  });
  vi.stubGlobal('fetch', fetchMock);
  const result = await getSearchConsoleOverview({ days: 7, allQueries: true });
  expect(result?.queries).toHaveLength(25_001);
  expect(result?.clicks).toBe(42);
  expect(result?.queriesLimited).toBe(false);
  expect(result?.startDate).toBe('2026-10-11');
  expect(result?.endDate).toBe('2026-10-17');
  expect(reportRequests.at(-1)).toMatchObject({ startRow: 25_000, rowLimit: 25_000 });
});
