import { createSign } from 'crypto';

type SearchConsoleRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type SearchConsoleOverview = {
  connected: boolean;
  fetchedAt: string;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  queriesLimited?: boolean;
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function getAccessToken(clientEmail: string, privateKey: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const encodedPayload = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
  }));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${signer.sign(privateKey, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('Search Console authentication failed');
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error('Search Console token missing');
  return body.access_token;
}

async function querySearchConsole(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) throw new Error('Search Console report failed');
  return response.json() as Promise<{ rows?: SearchConsoleRow[] }>;
}

/**
 * Reads only aggregate Search Console performance and top search queries.
 * The service account is server-only and must be added as a restricted user
 * for the exact site property in Search Console.
 */
export async function getSearchConsoleOverview({ days = 28, allQueries = false }: { days?: 7 | 28 | 90; allQueries?: boolean } = {}): Promise<SearchConsoleOverview | null> {
  const clientEmail = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
  if (!clientEmail || !privateKey || !siteUrl) return null;

  const endDate = isoDateDaysAgo(3);
  const startDate = isoDateDaysAgo(days + 2);
  try {
    const token = await getAccessToken(clientEmail, privateKey);
    const baseQuery = { startDate, endDate, type: 'web' };
    const [summary, queryReport] = await Promise.all([
      querySearchConsole(token, siteUrl, baseQuery),
      querySearchConsole(token, siteUrl, { ...baseQuery, dimensions: ['query'], rowLimit: allQueries ? 25_000 : 5 }),
    ]);
    const rows = queryReport.rows ?? [];
    let lastPageLength = rows.length;
    // Exhaust Google's pages, with a bounded safety cap for very large properties.
    while (allQueries && lastPageLength === 25_000 && rows.length < 100_000) {
      const next = await querySearchConsole(token, siteUrl, { ...baseQuery, dimensions: ['query'], rowLimit: 25_000, startRow: rows.length });
      lastPageLength = next.rows?.length ?? 0;
      rows.push(...(next.rows ?? []));
    }
    const totals = summary.rows?.[0] ?? {};
    return {
      connected: true,
      fetchedAt: new Date().toISOString(),
      startDate,
      endDate,
      clicks: Math.round(totals.clicks ?? 0),
      impressions: Math.round(totals.impressions ?? 0),
      ctr: totals.ctr ?? 0,
      position: totals.position ?? 0,
      queriesLimited: allQueries && lastPageLength === 25_000,
      queries: rows.map((row) => ({
        query: row.keys?.[0] || '—',
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      })),
    };
  } catch {
    // A dashboard must never expose Google errors or block office work.
    return null;
  }
}
